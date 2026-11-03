/**
 * Backend for the local OMR Station (see docs/omr-review/SPEC.md). Every route calls requireStation();
 * ordering/scoring/writing reuse omr-import.ts so a published sheet is scored exactly like an imported one.
 */

import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { tests, testAttempts, testAnswers, users } from '@/lib/db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { ApiException } from '@/lib/api-utils';
import { scoreAttempt } from '@/lib/tests/scoring';
import { r2PutStream } from '@/lib/storage/r2';
import { cleanAnswer, loadOmrContext, writeOmrAttempt, OmrImportError } from './omr-import';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Pure: does `header` carry `Bearer <secret>`? Constant-time. */
export function bearerMatches(header: string | null, secret: string): boolean {
  const m = header?.match(/^Bearer (.+)$/);
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireStation(req: Request) {
  const secret = process.env.OMR_STATION_SECRET;
  if (!secret) throw new ApiException('OMR station is not configured', 503, 'STATION_DISABLED');
  if (!bearerMatches(req.headers.get('authorization'), secret)) {
    throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
  }
}

export const imageKey = (testId: number, userId: number) => `omr-sheets/${testId}/${userId}.jpg`;

/** Pure: a station answers array → questionId → letter, rejecting wrong lengths. */
export function toAnswerMap(ordered: { id: number }[], answers: unknown): Map<number, string> {
  if (!Array.isArray(answers) || answers.length !== ordered.length) {
    throw new OmrImportError(`answers must have ${ordered.length} entries`);
  }
  const map = new Map<number, string>();
  answers.forEach((a, i) => { const k = cleanAnswer(a); if (k) map.set(ordered[i].id, k); });
  return map;
}

async function getMock(testId: number) {
  const test = await db.select().from(tests).where(eq(tests.id, testId)).get();
  if (!test || !test.isMock) throw new ApiException('Mock not found', 404, 'MOCK_NOT_FOUND');
  return test;
}

export async function listMocks() {
  const rows = await db.select().from(tests).where(eq(tests.isMock, true));
  return {
    mocks: rows.map(t => ({
      id: t.id, slug: t.slug, title: t.title, examCode: t.examCode, totalQuestions: t.totalQuestions, status: t.status,
    })),
  };
}

export async function buildBundle(testId: number) {
  const test = await getMock(testId);
  const ctx = await loadOmrContext(testId);
  const sectionTitle = new Map(ctx.sections.map(s => [s.id, s.title]));
  const noById = new Map(ctx.ordered.map((q, i) => [q.id, i]));

  const students = await db.select({ userId: users.id, studentId: users.studentId, name: users.name })
    .from(users).where(isNotNull(users.studentId));
  const attempts = await db.select().from(testAttempts).where(eq(testAttempts.testId, testId));
  const answerRows = await db
    .select({ attemptId: testAnswers.attemptId, questionId: testAnswers.questionId, key: testAnswers.selectedKey })
    .from(testAnswers).innerJoin(testAttempts, eq(testAttempts.id, testAnswers.attemptId))
    .where(eq(testAttempts.testId, testId));
  const blank = () => new Array<string | null>(ctx.expectedLength).fill(null);
  const byAttempt = new Map<number, (string | null)[]>();
  for (const r of answerRows) {
    const i = noById.get(r.questionId);
    if (i == null) continue;
    const arr = byAttempt.get(r.attemptId) ?? blank();
    arr[i] = r.key;
    byAttempt.set(r.attemptId, arr);
  }
  const studentIdOf = new Map(students.map(s => [s.userId, s.studentId]));

  return {
    test: { id: test.id, slug: test.slug, title: test.title, examCode: test.examCode, totalQuestions: ctx.expectedLength },
    questions: ctx.ordered.map((q, i) => ({ no: i + 1, id: q.id, section: sectionTitle.get(q.sectionId) ?? '' })),
    students,
    attempts: attempts.map(a => ({
      userId: a.userId, studentId: studentIdOf.get(a.userId) ?? null, mode: a.mode, status: a.status,
      resultSource: a.resultSource, omrStatus: a.omrStatus, totalScore: a.totalScore,
      answers: byAttempt.get(a.id) ?? blank(),
    })),
  };
}

export async function scoreSheets(testId: number, sheets: unknown) {
  await getMock(testId);
  if (!Array.isArray(sheets)) throw new ApiException('sheets must be an array', 400, 'BAD_REQUEST');
  const { sections, ordered } = await loadOmrContext(testId);
  return {
    results: sheets.map(s => {
      const sc = scoreAttempt(sections, ordered, toAnswerMap(ordered, s?.answers));
      return {
        ref: s.ref, totalScore: sc.totalScore, totalCorrect: sc.totalCorrect,
        totalWrong: sc.totalWrong, totalUnattempted: sc.totalUnattempted,
      };
    }),
  };
}

export async function storeImage(testId: number, userIdParam: string | null, body: ArrayBuffer, contentType: string | null) {
  await getMock(testId);
  const userId = Number(userIdParam);
  if (!Number.isInteger(userId) || userId <= 0) throw new ApiException('userId required', 400, 'BAD_REQUEST');
  if (!contentType?.startsWith('image/jpeg')) throw new ApiException('image/jpeg body required', 415, 'BAD_TYPE');
  if (body.byteLength === 0 || body.byteLength > MAX_IMAGE_BYTES) {
    throw new ApiException('Image must be 1 byte to 4 MB', 413, 'BAD_SIZE');
  }
  const key = imageKey(testId, userId);
  await r2PutStream(key, Buffer.from(body), 'image/jpeg', body.byteLength);
  return { key };
}

interface Decision { userId: number; status: 'accepted' | 'rejected'; answers: unknown; imageKey?: string; meta?: unknown }

export async function publish(testId: number, body: { dryRun?: boolean; decisions?: Decision[] }) {
  await getMock(testId);
  if (!Array.isArray(body.decisions)) throw new ApiException('decisions must be an array', 400, 'BAD_REQUEST');
  const ctx = await loadOmrContext(testId);
  const attempts = await db.select().from(testAttempts).where(eq(testAttempts.testId, testId));
  const attemptByUser = new Map(attempts.map(a => [a.userId, a]));

  const out = {
    applied: 0, created: 0, overwritten: 0,
    skippedOnline: [] as number[], skippedBanned: [] as number[],
    errors: [] as { userId: number; error: string }[],
  };
  for (const d of body.decisions) {
    try {
      if (d.status !== 'accepted' && d.status !== 'rejected') throw new OmrImportError('status must be accepted or rejected');
      const existing = attemptByUser.get(d.userId);
      if (existing?.mode === 'online') { out.skippedOnline.push(d.userId); continue; }
      if (existing?.status === 'banned') { out.skippedBanned.push(d.userId); continue; }
      const answers = toAnswerMap(ctx.ordered, d.answers);
      const user = await db.select({ id: users.id }).from(users).where(eq(users.id, d.userId)).get();
      if (!user) throw new OmrImportError('Unknown user');
      if (!body.dryRun) {
        await writeOmrAttempt(ctx, testId, { userId: d.userId, attemptId: existing?.id ?? null, answers }, {
          omrStatus: d.status,
          omrImageKey: d.imageKey ?? null,
          omrMeta: d.meta == null ? null : JSON.stringify(d.meta),
        });
      }
      out.applied++;
      if (existing) out.overwritten++; else out.created++;
    } catch (e) {
      out.errors.push({ userId: d.userId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
