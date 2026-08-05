/**
 * GET /api/admin/tests/[id]/analytics
 * Staff (admin/instructor) teacher overview for one test: participation,
 * score stats, per-section and per-question accuracy, top/bottom performers.
 * Excludes FBS diagnostic tests per spec (tests.isDiagnostic).
 */

import { NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  tests, testSections, testQuestions, testAttempts, testAnswers, testViolations, users, userAccess,
} from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import {
  computeTestAnalytics, computeViolationStats,
  type AnalyticsInput, type RawAttempt,
} from '@/lib/tests/analytics';
import type { SectionScore } from '@/lib/tests/scoring';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const id = parseInt((await params).id, 10);
    if (Number.isNaN(id)) throw new ApiException('Invalid test id', 400);

    const test = await db.select().from(tests).where(eq(tests.id, id)).get();
    if (!test) throw new ApiException('Test not found', 404);
    if (test.isDiagnostic) {
      throw new ApiException(
        'Analytics are not available for FBS diagnostic tests',
        400,
        'DIAGNOSTIC_EXCLUDED',
      );
    }

    const [sectionRows, questionRows, attemptRows] = await Promise.all([
      db.select().from(testSections).where(eq(testSections.testId, id)),
      db.select({
        questionId: testQuestions.id,
        sectionId: testQuestions.sectionId,
        number: testQuestions.number,
        correctKey: testQuestions.correctKey,
      }).from(testQuestions)
        .innerJoin(testSections, eq(testQuestions.sectionId, testSections.id))
        .where(eq(testSections.testId, id)),
      db.select({
        attempt: testAttempts,
        userName: users.name,
        userEmail: users.email,
      }).from(testAttempts)
        .innerJoin(users, eq(testAttempts.userId, users.id))
        .where(eq(testAttempts.testId, id)),
    ]);

    const attempts: RawAttempt[] = attemptRows.map(({ attempt, userName, userEmail }) => ({
      attemptId: attempt.id,
      userId: attempt.userId,
      userName,
      userEmail,
      status: attempt.status as RawAttempt['status'],
      totalScore: attempt.totalScore,
      submittedAt: attempt.submittedAt?.getTime() ?? null,
      sectionScores: attempt.sectionScores
        ? (JSON.parse(attempt.sectionScores) as SectionScore[])
        : null,
    }));

    const submittedAttemptIds = attempts
      .filter(a => a.status === 'submitted')
      .map(a => a.attemptId);
    const answerRows = submittedAttemptIds.length
      ? await db.select({
          attemptId: testAnswers.attemptId,
          questionId: testAnswers.questionId,
          selectedKey: testAnswers.selectedKey,
        }).from(testAnswers).where(inArray(testAnswers.attemptId, submittedAttemptIds))
      : [];

    // Eligible cohort: active students who can access this test (mirrors
    // src/lib/tests/access.ts canAccessTest — allowedProducts null = everyone).
    const allowedProducts = test.allowedProducts
      ? (JSON.parse(test.allowedProducts) as string[])
      : null;
    let eligibleCount: number;
    if (!allowedProducts || allowedProducts.length === 0) {
      const rows = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.role, 'student'), eq(users.status, 'active')));
      eligibleCount = rows.length;
    } else {
      const rows = await db.selectDistinct({ userId: userAccess.userId })
        .from(userAccess)
        .innerJoin(users, eq(userAccess.userId, users.id))
        .where(and(
          eq(users.role, 'student'),
          eq(users.status, 'active'),
          eq(userAccess.active, true),
          inArray(userAccess.product, allowedProducts),
        ));
      eligibleCount = rows.length;
    }

    const input: AnalyticsInput = {
      eligibleCount,
      testTotalMarks: test.totalMarks,
      attempts,
      sections: sectionRows.map(s => ({ sectionId: s.id, title: s.title, order: s.order })),
      questions: questionRows,
      answers: answerRows,
    };

    // Proctoring violations across every attempt at this test, any status.
    const allAttemptIds = attempts.map(a => a.attemptId);
    const violationRows = allAttemptIds.length
      ? await db.select({ action: testViolations.action })
          .from(testViolations).where(inArray(testViolations.attemptId, allAttemptIds))
      : [];

    return {
      analytics: computeTestAnalytics(input),
      violations: computeViolationStats(violationRows),
    };
  }, 'admin/tests/[id]/analytics');
}
