/**
 * Solution sheet data for /mocks/[slug]/solutions: the stored content (mock_solutions, DB only) plus the
 * viewer's own answers and the cohort's per-question stats. Question ids are L1..L30 / M1..M25 / A1..A15:
 * section order 1/2/3 + the question's position in the section.
 */

import { db } from '@/lib/db';
import { mockSolutions, testAnswers, testAttempts, testQuestions, testSections } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export async function buildSolutionSheetData(test: { id: number; slug: string }, userId: number, name: string) {
  const row = await db.select().from(mockSolutions).where(eq(mockSolutions.testSlug, test.slug)).get();
  if (!row) return null;

  const qs = await db.select({ id: testQuestions.id, order: testQuestions.order, so: testSections.order })
    .from(testQuestions).innerJoin(testSections, eq(testSections.id, testQuestions.sectionId))
    .where(eq(testSections.testId, test.id));
  const qidOf = new Map(qs.map(q => [q.id, `${'LMA'[q.so - 1]}${q.order}`]));

  // A rejected OMR paper is excluded from the cohort, as in the leaderboard.
  const attempts = (await db.select().from(testAttempts)
    .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.status, 'submitted'))))
    .filter(a => a.omrStatus !== 'rejected');
  const mine = (await db.select({ id: testAttempts.id }).from(testAttempts)
    .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.userId, userId))).get())?.id;
  const attemptIds = [...new Set([...attempts.map(a => a.id), ...(mine ? [mine] : [])])];
  const answers = attemptIds.length
    ? await db.select().from(testAnswers).where(inArray(testAnswers.attemptId, attemptIds))
    : [];

  const data = JSON.parse(row.data) as { questions: { id: string; correctKey: string }[] };
  const correct = new Map(data.questions.map(q => [q.id, q.correctKey]));

  const myAnswers: Record<string, { picked: string | null; flagged: boolean }> = {};
  for (const id of correct.keys()) myAnswers[id] = { picked: null, flagged: false };
  const counts = new Map<string, Record<string, number>>();
  const inCohort = new Set(attempts.map(a => a.id));
  for (const a of answers) {
    const qid = qidOf.get(a.questionId);
    if (!qid) continue;
    if (a.attemptId === mine) myAnswers[qid] = { picked: a.selectedKey, flagged: a.flagged };
    if (a.selectedKey && inCohort.has(a.attemptId)) {
      const c = counts.get(qid) ?? {};
      c[a.selectedKey] = (c[a.selectedKey] ?? 0) + 1;
      counts.set(qid, c);
    }
  }

  const n = attempts.length;
  const frac = (x: number) => (n ? Math.round((x / n) * 1000) / 1000 : 0);
  const q: Record<string, unknown> = {};
  for (const [qid, key] of correct) {
    const c = counts.get(qid) ?? {};
    const answered = Object.values(c).reduce((s, x) => s + x, 0);
    q[qid] = {
      right: frac(c[key] ?? 0), wrong: frac(answered - (c[key] ?? 0)), skipped: frac(n - answered),
      picked: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, frac(v)])),
    };
  }

  return { ...data, student: { name, answers: myAnswers }, cohort: { attempts: n, q } };
}
