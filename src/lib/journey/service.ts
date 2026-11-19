/**
 * "Exorcise the Past" (IBA): builds each student's 60-minute set from the questions they missed in
 * their last 5 mocks, and stores progress so the timer can be paused. See ./pick for the selection rules.
 */

import { and, eq, inArray, ne, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  tests, testWindows, testAttempts, testAnswers, testSections, testQuestions, testQuestionGroups,
  ibaJourneys, users, userAccess, type IbaJourney, type UserWithProducts,
} from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';
import { isStaffRole } from '@/lib/auth/roles';
import { mockPhase } from '@/lib/mocks/state';
import { JOURNEY_MS, pickJourney, sectionOf, type Candidate, type JourneySection } from './pick';
import type {
  JourneyAdminRow, JourneyPayload, JourneyResult, JourneyReviewRow, JourneyStatus,
} from './types';
import type { TakingGroup } from '@/lib/tests/types';

const FLAG = 'journey_enabled';
const RECENT_MOCKS = 5;

export async function isJourneyEnabled(): Promise<boolean> {
  return (await getLmsSetting(FLAG)) === '1';
}
export const setJourneyEnabled = (on: boolean) => setLmsSetting(FLAG, on ? '1' : '0');

export function canUseJourney(user: Pick<UserWithProducts, 'role' | 'products' | 'mockAccess'>): boolean {
  return isStaffRole(user.role) || !!user.mockAccess || user.products.includes('iba');
}

// ─── Building the set ─────────────────────────────────────────────────────────

/** Missed questions of the student's last 5 visible IBA mocks, with class + top-5 stats. */
export async function missedCandidates(userId: number): Promise<Candidate[]> {
  const mocks = await db.select().from(tests)
    .where(and(eq(tests.isMock, true), eq(tests.bucket, 'iba'), eq(tests.status, 'published')))
    .orderBy(desc(tests.id));
  if (mocks.length === 0) return [];

  const [windows, mine] = await Promise.all([
    db.select().from(testWindows).where(inArray(testWindows.testId, mocks.map(m => m.id))),
    db.select().from(testAttempts).where(and(eq(testAttempts.userId, userId), inArray(testAttempts.testId, mocks.map(m => m.id)))),
  ]);
  const now = new Date();
  const sat = mocks.filter(m => {
    const a = mine.find(x => x.testId === m.id) ?? null;
    return a?.status === 'submitted' && mockPhase(m, windows.filter(w => w.testId === m.id), a, now) !== 'locked';
  }).slice(0, RECENT_MOCKS);

  const perMock = await Promise.all(sat.map(async (m): Promise<Candidate[]> => {
    // ponytail: cohort = everyone who submitted (incl. trial walk-ins); filter by batch if that skews the %.
    const attempts = await db.select().from(testAttempts).where(and(
      eq(testAttempts.testId, m.id), eq(testAttempts.status, 'submitted'),
    )).then(rows => rows.filter(a => a.omrStatus !== 'rejected'));
    const [questions, answers] = await Promise.all([
      db.select({ id: testQuestions.id, order: testQuestions.order, key: testQuestions.correctKey, title: testSections.title })
        .from(testQuestions).innerJoin(testSections, eq(testSections.id, testQuestions.sectionId))
        .where(eq(testSections.testId, m.id)),
      attempts.length ? db.select().from(testAnswers).where(inArray(testAnswers.attemptId, attempts.map(a => a.id))) : [],
    ]);

    const keyOf = new Map(questions.map(q => [q.id, q.key]));
    const right = new Map<number, Set<number>>(); // questionId -> attemptIds that got it right
    for (const a of answers) {
      if (a.selectedKey && a.selectedKey === keyOf.get(a.questionId)) {
        (right.get(a.questionId) ?? right.set(a.questionId, new Set()).get(a.questionId)!).add(a.attemptId);
      }
    }
    const top5 = [...attempts].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0) || a.id - b.id).slice(0, 5);
    const myAttempt = attempts.find(a => a.userId === userId);

    return questions.flatMap(q => {
      const section = sectionOf(q.title);
      const who = right.get(q.id) ?? new Set<number>();
      if (!section || !q.key || !myAttempt || who.has(myAttempt.id)) return []; // not a miss
      return [{
        id: q.id, section, mock: m.id, order: q.order,
        pct: attempts.length ? (who.size / attempts.length) * 100 : 0,
        topRight: top5.filter(a => who.has(a.id)).length * 2 > top5.length,
      }];
    });
  }));
  return perMock.flat();
}

export async function createJourney(userId: number): Promise<void> {
  const ids = pickJourney(await missedCandidates(userId));
  if (ids.length === 0) throw new ApiException('Not enough mock data to build your set yet', 409, 'JOURNEY_EMPTY');
  await db.insert(ibaJourneys).values({ userId, questionIds: JSON.stringify(ids) }).onConflictDoNothing();
}

// ─── Reading it back ──────────────────────────────────────────────────────────

const getRow = (userId: number) =>
  db.select().from(ibaJourneys).where(eq(ibaJourneys.userId, userId)).get().then(r => r ?? null);

export async function getJourneyPayload(userId: number): Promise<JourneyPayload | null> {
  const row = await getRow(userId);
  if (!row) return null;
  const ids = JSON.parse(row.questionIds) as number[];
  const done = row.status === 'done';

  const rows = await db.select({
    q: testQuestions, section: testSections.title, test: tests.title,
  }).from(testQuestions)
    .innerJoin(testSections, eq(testSections.id, testQuestions.sectionId))
    .innerJoin(tests, eq(tests.id, testSections.testId))
    .where(inArray(testQuestions.id, ids));
  const byId = new Map(rows.map(r => [r.q.id, r]));
  const ordered = ids.map(id => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);

  const groupIds = [...new Set(ordered.map(r => r.q.groupId).filter((g): g is number => g != null))];
  const groups: TakingGroup[] = groupIds.length
    ? (await db.select().from(testQuestionGroups).where(inArray(testQuestionGroups.id, groupIds))).map(g => ({
        id: g.id, order: g.order, kind: g.kind as TakingGroup['kind'], title: g.title, content: g.content,
        sharedOptions: g.sharedOptions ? JSON.parse(g.sharedOptions) : null,
      }))
    : [];

  const answers = JSON.parse(row.answers) as Record<number, string>;
  return {
    status: row.status as JourneyStatus,
    elapsedMs: row.elapsedMs,
    limitMs: JOURNEY_MS,
    answers,
    questions: ordered.map((r, i) => ({
      id: r.q.id, number: i + 1, order: i, groupId: r.q.groupId, type: r.q.type, stem: r.q.stem,
      options: JSON.parse(r.q.options), imageUrl: r.q.imageUrl, explanation: null,
      section: sectionOf(r.section)!,
    })),
    groups,
    result: row.result ? JSON.parse(row.result) : null,
    review: done ? ordered.map((r): JourneyReviewRow => ({
      id: r.q.id, section: sectionOf(r.section)!, source: `${r.test} · Q${r.q.number}`,
      selected: answers[r.q.id] ?? null, correct: r.q.correctKey,
    })) : null,
  };
}

// ─── Saving progress ──────────────────────────────────────────────────────────

async function scoreJourney(row: IbaJourney, answers: Record<number, string>): Promise<JourneyResult> {
  const ids = JSON.parse(row.questionIds) as number[];
  const rows = await db.select({ id: testQuestions.id, key: testQuestions.correctKey, title: testSections.title })
    .from(testQuestions).innerJoin(testSections, eq(testSections.id, testQuestions.sectionId))
    .where(inArray(testQuestions.id, ids));
  const bySection = { english: { correct: 0, total: 0 }, math: { correct: 0, total: 0 }, analytical: { correct: 0, total: 0 } } as JourneyResult['bySection'];
  let correct = 0, wrong = 0, skipped = 0;
  for (const r of rows) {
    const s = bySection[sectionOf(r.title) as JourneySection];
    s.total++;
    const picked = answers[r.id];
    if (!picked) skipped++;
    else if (picked === r.key) { correct++; s.correct++; }
    else wrong++;
  }
  return { correct, wrong, skipped, total: rows.length, marks: correct - wrong * 0.25, bySection };
}

export interface JourneyProgress { answers?: Record<string, string | null>; elapsedMs?: number; status?: 'running' | 'paused' | 'done' }

/** Trust boundary: the client only sends picks, elapsed time and a status; everything else is recomputed here. */
export async function saveJourney(userId: number, body: JourneyProgress): Promise<void> {
  const row = await getRow(userId);
  if (!row) throw new ApiException('No journey yet', 404, 'JOURNEY_NOT_FOUND');
  if (row.status === 'done') return;

  const valid = new Set(JSON.parse(row.questionIds) as number[]);
  const answers: Record<number, string> = {};
  for (const [qid, key] of Object.entries(body.answers ?? JSON.parse(row.answers))) {
    if (valid.has(Number(qid)) && typeof key === 'string' && /^[A-E]$/.test(key)) answers[Number(qid)] = key;
  }
  const elapsed = Number(body.elapsedMs);
  const elapsedMs = Number.isFinite(elapsed) ? Math.min(JOURNEY_MS, Math.max(row.elapsedMs, Math.round(elapsed))) : row.elapsedMs;
  const status = body.status && ['running', 'paused', 'done'].includes(body.status) ? body.status : (row.status as JourneyStatus);
  const now = new Date();

  await db.update(ibaJourneys).set({
    answers: JSON.stringify(answers), elapsedMs, status, updatedAt: now,
    startedAt: row.startedAt ?? (status === 'ready' ? null : now),
    ...(status === 'done' ? { finishedAt: now, result: JSON.stringify(await scoreJourney(row, answers)) } : {}),
  }).where(and(eq(ibaJourneys.id, row.id), ne(ibaJourneys.status, 'done')));
}

// ─── Admin ────────────────────────────────────────────────────────────────────

const ORDER = ['running', 'paused', 'ready', 'done', 'none'];

/** Every Mock Access student (plus anyone who has a set), with where they are. */
export async function listJourneysForAdmin(): Promise<JourneyAdminRow[]> {
  const [journeys, students] = await Promise.all([
    db.select({ j: ibaJourneys, name: users.name }).from(ibaJourneys).innerJoin(users, eq(users.id, ibaJourneys.userId)),
    db.select({ id: users.id, name: users.name }).from(userAccess)
      .innerJoin(users, eq(users.id, userAccess.userId))
      .where(and(eq(userAccess.product, 'mock'), eq(userAccess.active, true), eq(users.role, 'student'))),
  ]);
  const byUser = new Map(journeys.map(r => [r.j.userId, r]));
  const rows = journeys.map(({ j, name }): JourneyAdminRow => ({
    userId: j.userId, name, status: j.status as JourneyStatus,
    answered: Object.keys(JSON.parse(j.answers)).length,
    total: (JSON.parse(j.questionIds) as number[]).length,
    elapsedMs: j.elapsedMs,
    result: j.result ? JSON.parse(j.result) : null,
    startedAt: j.startedAt?.getTime() ?? null,
    finishedAt: j.finishedAt?.getTime() ?? null,
    updatedAt: j.updatedAt.getTime(),
  }));
  for (const st of students) {
    if (!byUser.has(st.id)) rows.push({ userId: st.id, name: st.name, status: 'none', answered: 0, total: 0, elapsedMs: 0, result: null, startedAt: null, finishedAt: null, updatedAt: 0 });
  }
  return rows.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.name.localeCompare(b.name));
}
