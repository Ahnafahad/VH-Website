/**
 * GET /api/admin/tests/[id]/attempts
 * Staff: every attempt for a test with student info, violation counts, scores.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts, users } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const id = parseInt((await params).id, 10);
    if (Number.isNaN(id)) throw new ApiException('Invalid test id', 400);

    const rows = await db
      .select({
        attempt: testAttempts,
        userName: users.name,
        userEmail: users.email,
        studentId: users.studentId,
      })
      .from(testAttempts)
      .innerJoin(users, eq(testAttempts.userId, users.id))
      .where(eq(testAttempts.testId, id));

    return {
      attempts: rows.map(({ attempt, userName, userEmail, studentId }) => ({
        id: attempt.id,
        user: { name: userName, email: userEmail, studentId },
        mode: attempt.mode,
        status: attempt.status,
        startedAt: attempt.startedAt.getTime(),
        submittedAt: attempt.submittedAt?.getTime() ?? null,
        tabLeaveCount: attempt.tabLeaveCount,
        resetCount: attempt.resetCount,
        totalScore: attempt.totalScore,
        totalCorrect: attempt.totalCorrect,
        totalWrong: attempt.totalWrong,
        totalUnattempted: attempt.totalUnattempted,
      })),
    };
  });
}
