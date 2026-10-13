/**
 * Server-side per-test summary (score stats, last attempt, marking rule, answer-key
 * state, attempter batches) for the admin Tests library and the per-test page.
 * Grouped queries, one round per table regardless of how many tests.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts, testQuestions, testSections, users } from '@/lib/db/schema';
import { computeScoreStats, markingRuleLabel, type TestScoreStats } from './library';

export interface TestSummaryExtras {
  stats: TestScoreStats | null;
  /** Epoch ms of the most recent submission. */
  lastAttemptAt: number | null;
  markingRule: string | null;
  answerKey: { keyed: number; total: number };
  batches: string[];
  /** Raw submitted scores, for the histogram on the test page. */
  scores: number[];
}

export async function loadTestSummaryExtras(
  tests: Array<{ id: number; totalMarks: number }>,
): Promise<Map<number, TestSummaryExtras>> {
  const out = new Map<number, TestSummaryExtras>();
  if (tests.length === 0) return out;
  const ids = tests.map(t => t.id);

  const [attemptRows, sectionRows, keyRows] = await Promise.all([
    db.select({
      testId: testAttempts.testId,
      status: testAttempts.status,
      totalScore: testAttempts.totalScore,
      submittedAt: testAttempts.submittedAt,
      batch: users.batch,
    }).from(testAttempts)
      .innerJoin(users, eq(testAttempts.userId, users.id))
      .where(inArray(testAttempts.testId, ids)),
    db.select({
      testId: testSections.testId,
      marksPerCorrect: testSections.marksPerCorrect,
      penaltyPerWrong: testSections.penaltyPerWrong,
    }).from(testSections).where(inArray(testSections.testId, ids)),
    db.select({
      testId: testSections.testId,
      total: sql<number>`count(*)`.mapWith(Number),
      keyed: sql<number>`sum(case when ${testQuestions.correctKey} is not null and ${testQuestions.correctKey} != '' then 1 else 0 end)`.mapWith(Number),
    }).from(testQuestions)
      .innerJoin(testSections, eq(testQuestions.sectionId, testSections.id))
      .where(inArray(testSections.testId, ids))
      .groupBy(testSections.testId),
  ]);

  for (const t of tests) {
    const mine = attemptRows.filter(a => a.testId === t.id);
    const submitted = mine.filter(a => a.status === 'submitted' && a.totalScore !== null);
    const last = mine.reduce<number>((m, a) => Math.max(m, a.submittedAt?.getTime() ?? 0), 0);
    const key = keyRows.find(k => k.testId === t.id);
    out.set(t.id, {
      stats: computeScoreStats(submitted.map(a => a.totalScore as number), t.totalMarks),
      lastAttemptAt: last > 0 ? last : null,
      markingRule: markingRuleLabel(sectionRows.filter(s => s.testId === t.id)),
      answerKey: { keyed: key?.keyed ?? 0, total: key?.total ?? 0 },
      batches: [...new Set(mine.map(a => a.batch).filter((b): b is string => !!b))].sort(),
      scores: submitted.map(a => a.totalScore as number),
    });
  }
  return out;
}
