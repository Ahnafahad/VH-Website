/**
 * Scanned-OMR results → official mock answers.
 *
 * File shape (our own; adapt parseOmrFile when the scanner's real export format is known):
 *   { "examCode": "9001",
 *     "results": [ { "studentId": "250123", "answers": ["B", "C", null, "A", ...] } ] }
 * `answers` is one entry per question in test order (section order, then question order). Anything that
 * isn't a single letter A–E (null, "", "*", a double-marked "AB") counts as blank.
 *
 * The scan is the official source: it overwrites any answers the student typed or took online, creating
 * the attempt (against the offline window) for students who never entered anything.
 */

import { db } from '@/lib/db';
import {
  tests, testSections, testQuestions, testWindows, testAttempts, testAnswers, users,
} from '@/lib/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { scoreAttempt } from '@/lib/tests/scoring';

export class OmrImportError extends Error {}

export interface OmrRow { studentId: string; answers: (string | null)[] }
export interface OmrFile { examCode: string | null; results: OmrRow[] }

export interface OmrReport {
  applied: boolean;
  expectedLength: number;
  total: number;
  /** rows that matched a student with a usable answer sheet */
  matched: number;
  created: number;
  overwritten: number;
  unknownStudents: string[];
  badLength: string[];
  duplicates: string[];
  /** students whose attempt is banned — left untouched, needs a human decision */
  skippedBanned: string[];
}

const LETTER = /^[A-E]$/;

export function cleanAnswer(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toUpperCase();
  return LETTER.test(v) ? v : null;
}

export function parseOmrFile(raw: unknown): OmrFile {
  const o = raw as { examCode?: unknown; results?: unknown } | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.results)) {
    throw new OmrImportError('Expected { "examCode"?, "results": [ { "studentId", "answers": [...] } ] }');
  }
  const results = o.results.map((r, i): OmrRow => {
    const row = r as { studentId?: unknown; answers?: unknown };
    const studentId = row?.studentId == null ? '' : String(row.studentId).trim();
    if (!studentId || !Array.isArray(row.answers)) {
      throw new OmrImportError(`results[${i}] needs "studentId" and an "answers" array`);
    }
    return { studentId, answers: row.answers.map(a => (typeof a === 'string' ? a : null)) };
  });
  return { examCode: o.examCode == null ? null : String(o.examCode).trim(), results };
}

export async function importOmr(testId: number, raw: unknown, apply: boolean): Promise<OmrReport> {
  const file = parseOmrFile(raw);

  const test = await db.select().from(tests).where(eq(tests.id, testId)).get();
  if (!test) throw new OmrImportError('Test not found');
  if (file.examCode && test.examCode && file.examCode !== test.examCode) {
    throw new OmrImportError(`Exam code mismatch: file says ${file.examCode}, mock is ${test.examCode}`);
  }

  const sections = await db.select().from(testSections)
    .where(eq(testSections.testId, testId)).orderBy(asc(testSections.order));
  const questions = sections.length
    ? await db.select().from(testQuestions).where(inArray(testQuestions.sectionId, sections.map(s => s.id)))
    : [];
  const ordered = sections.flatMap(s =>
    questions.filter(q => q.sectionId === s.id).sort((a, b) => a.order - b.order));
  const expectedLength = ordered.length;
  if (expectedLength === 0) throw new OmrImportError('This test has no questions');

  const windows = await db.select().from(testWindows).where(eq(testWindows.testId, testId));
  const offline = windows.filter(w => w.mode === 'offline').sort((a, b) => b.closesAt.getTime() - a.closesAt.getTime())[0];
  if (!offline) throw new OmrImportError('Add an offline window to this mock first — scanned sheets attach to it');

  const report: OmrReport = {
    applied: apply, expectedLength, total: file.results.length, matched: 0, created: 0, overwritten: 0,
    unknownStudents: [], badLength: [], duplicates: [], skippedBanned: [],
  };

  const ids = [...new Set(file.results.map(r => r.studentId))];
  const userRows = ids.length
    ? await db.select({ id: users.id, studentId: users.studentId }).from(users).where(inArray(users.studentId, ids))
    : [];
  const userByStudentId = new Map(userRows.map(u => [u.studentId!, u.id]));
  const attemptRows = userRows.length
    ? await db.select().from(testAttempts).where(and(
        eq(testAttempts.testId, testId), inArray(testAttempts.userId, userRows.map(u => u.id))))
    : [];
  const attemptByUser = new Map(attemptRows.map(a => [a.userId, a]));

  const seen = new Set<string>();
  const work: Array<{ userId: number; attemptId: number | null; answers: Map<number, string> }> = [];
  for (const row of file.results) {
    if (seen.has(row.studentId)) { report.duplicates.push(row.studentId); continue; }
    seen.add(row.studentId);
    const userId = userByStudentId.get(row.studentId);
    if (userId == null) { report.unknownStudents.push(row.studentId); continue; }
    if (row.answers.length !== expectedLength) { report.badLength.push(row.studentId); continue; }
    const existing = attemptByUser.get(userId);
    if (existing?.status === 'banned') { report.skippedBanned.push(row.studentId); continue; }

    const answers = new Map<number, string>();
    row.answers.forEach((a, i) => { const k = cleanAnswer(a); if (k) answers.set(ordered[i].id, k); });
    work.push({ userId, attemptId: existing?.id ?? null, answers });
    report.matched++;
    if (existing) report.overwritten++; else report.created++;
  }

  if (!apply) return report;

  for (const w of work) {
    const score = scoreAttempt(sections, ordered, w.answers);
    const scoreFields = {
      status: 'submitted',
      submittedAt: offline.closesAt,
      totalScore: score.totalScore,
      totalCorrect: score.totalCorrect,
      totalWrong: score.totalWrong,
      totalUnattempted: score.totalUnattempted,
      sectionScores: JSON.stringify(score.sections),
      resultSource: 'omr',
      bestSnapshot: null,
    };
    await db.transaction(async tx => {
      let attemptId = w.attemptId;
      if (attemptId == null) {
        const [created] = await tx.insert(testAttempts).values({
          testId, userId: w.userId, windowId: offline.id, mode: 'offline', ...scoreFields,
        }).returning({ id: testAttempts.id });
        attemptId = created.id;
      } else {
        await tx.update(testAttempts).set(scoreFields).where(eq(testAttempts.id, attemptId));
        await tx.delete(testAnswers).where(eq(testAnswers.attemptId, attemptId));
      }
      if (w.answers.size > 0) {
        await tx.insert(testAnswers).values(
          [...w.answers].map(([questionId, selectedKey]) => ({ attemptId: attemptId!, questionId, selectedKey })),
        );
      }
    });
  }
  return report;
}
