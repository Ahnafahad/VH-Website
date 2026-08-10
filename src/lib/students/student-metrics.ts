/**
 * DB fetch layer for the student progress metrics (DECISIONS.md §12). See
 * student-metrics-pure.ts for the 11 non-LexiCore metrics and their rules.
 *
 * Single entry point reused by both the admin progress page (progress.ts)
 * and the student-facing mirror (dashboard/progress) — see getStudentMetricsForUser.
 * FBS diagnostics (tests.isDiagnostic) are excluded from every metric.
 */

import { db } from '@/lib/db';
import { users, tests, testAttempts, testViolations, userAccess } from '@/lib/db/schema';
import type { UserProduct } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getTestResults } from '@/lib/tests/service';
import { canAccessTest } from '@/lib/tests/access';
import { getLexicoreBreakdown } from './lexicore-breakdown';
import {
  computeStudentMetrics,
  type StudentMetrics,
  type MetricsAttempt,
  type BatchSectionAgg,
} from './student-metrics-pure';
import type { LexicoreBreakdown } from './progress-types';

export {
  computeStudentMetrics,
  type StudentMetrics,
  type MetricsAttempt,
  type BatchSectionAgg,
} from './student-metrics-pure';

export interface StudentFullMetrics {
  /** the 11 non-LexiCore metrics */
  testMetrics: StudentMetrics;
  /** the 4 LexiCore metrics (total points, words mastered, quiz accuracy, streak) + supporting fields */
  lexicore:    LexicoreBreakdown;
}

/**
 * Computes all 15 metrics for one student. Returns null only if the user
 * row doesn't exist.
 */
export async function getStudentMetricsForUser(userId: number): Promise<StudentFullMetrics | null> {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;

  const submitted = await db.select().from(testAttempts)
    .where(and(eq(testAttempts.userId, userId), eq(testAttempts.status, 'submitted')));

  const testIds = Array.from(new Set(submitted.map(a => a.testId)));
  const testRows = testIds.length ? await db.select().from(tests).where(inArray(tests.id, testIds)) : [];
  const testById = new Map(testRows.map(t => [t.id, t]));

  // Non-diagnostic only — skip the getTestResults call entirely for diagnostics
  // rather than fetching then discarding.
  const nonDiagAttempts = submitted.filter(a => {
    const t = testById.get(a.testId);
    return t && !t.isDiagnostic && a.submittedAt;
  });

  const attempts: MetricsAttempt[] = [];
  for (const a of nonDiagAttempts) {
    const test = testById.get(a.testId)!;
    const results = await getTestResults(test.id, userId);
    const me = results?.me;
    if (!me || !a.submittedAt) continue;
    const totalQuestions = me.sections.reduce((s, sec) => s + sec.totalQuestions, 0);
    attempts.push({
      attemptId: a.id,
      testId: test.id,
      isDiagnostic: false,
      submittedAt: a.submittedAt,
      percentage: me.percentage,
      rank: me.rank,
      totalStudents: results!.classStats.totalStudents,
      percentile: me.percentile,
      totalUnattempted: me.totalUnattempted,
      totalQuestions,
      sections: me.sections.map(s => ({
        title: s.title,
        correct: s.correct,
        wrong: s.wrong,
        unattempted: s.unattempted,
        totalQuestions: s.totalQuestions,
      })),
    });
  }

  const batchSectionTotals = await getBatchSectionTotals(user.batch);

  const attemptIds = attempts.map(a => a.attemptId);
  const violationRows = attemptIds.length
    ? await db.select({ id: testViolations.id }).from(testViolations)
        .where(inArray(testViolations.attemptId, attemptIds))
    : [];

  const publishedTests = await db.select().from(tests)
    .where(and(eq(tests.status, 'published'), eq(tests.isDiagnostic, false)));
  const userProductRows = await db.select({ product: userAccess.product }).from(userAccess)
    .where(and(eq(userAccess.userId, userId), eq(userAccess.active, true)));
  const userWithProducts = { ...user, products: userProductRows.map(r => r.product as UserProduct) };
  const availableTestsCount = publishedTests.filter(t => canAccessTest(userWithProducts, t)).length;

  const testMetrics = computeStudentMetrics({
    attempts,
    batchSectionTotals,
    availableTestsCount,
    violationCount: violationRows.length,
  });

  const lexicore = await getLexicoreBreakdown(userId);

  return { testMetrics, lexicore };
}

/**
 * Aggregates correct/wrong totals per section title across every student who
 * shares `batch`, over their non-diagnostic submitted attempts. Reads the
 * `sectionScores` JSON snapshot already stored on each attempt — no need to
 * re-join test_answers/test_questions.
 */
async function getBatchSectionTotals(batch: string | null): Promise<BatchSectionAgg[]> {
  if (!batch) return [];

  const batchUsers = await db.select({ id: users.id }).from(users).where(eq(users.batch, batch));
  const userIds = batchUsers.map(u => u.id);
  if (userIds.length === 0) return [];

  const rows = await db.select({ sectionScores: testAttempts.sectionScores, testId: testAttempts.testId })
    .from(testAttempts)
    .where(and(inArray(testAttempts.userId, userIds), eq(testAttempts.status, 'submitted')));
  if (rows.length === 0) return [];

  const testIds = Array.from(new Set(rows.map(r => r.testId)));
  const testRows = await db.select({ id: tests.id, isDiagnostic: tests.isDiagnostic })
    .from(tests).where(inArray(tests.id, testIds));
  const diagnosticTestIds = new Set(testRows.filter(t => t.isDiagnostic).map(t => t.id));

  const agg = new Map<string, { correct: number; wrong: number }>();
  for (const r of rows) {
    if (diagnosticTestIds.has(r.testId) || !r.sectionScores) continue;
    const sections = JSON.parse(r.sectionScores) as { title: string; correct: number; wrong: number }[];
    for (const s of sections) {
      const a = agg.get(s.title) ?? { correct: 0, wrong: 0 };
      a.correct += s.correct;
      a.wrong += s.wrong;
      agg.set(s.title, a);
    }
  }

  return Array.from(agg.entries()).map(([title, v]) => ({ title, ...v }));
}
