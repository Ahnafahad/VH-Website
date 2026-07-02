/**
 * GET /api/tests/[slug]/attempt
 * Full taking payload for the caller's in-progress attempt: sections, groups,
 * questions (no answer keys), saved answers, deadline, violation state.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAnswers } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireTestForUser } from '@/lib/tests/route-helpers';
import { getTestContent, getUserAttempt } from '@/lib/tests/service';
import { attemptDeadline } from '@/lib/tests/windows';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug } = await params;
    const { test, windows } = await requireTestForUser(slug, user);

    const attempt = await getUserAttempt(test.id, user.id);
    if (!attempt) throw new ApiException('No attempt started', 404, 'NO_ATTEMPT');
    if (attempt.status === 'banned') {
      throw new ApiException('You are banned from this test. Contact an admin.', 403, 'ATTEMPT_BANNED');
    }
    if (attempt.status === 'submitted') {
      throw new ApiException('Attempt already submitted', 409, 'ALREADY_SUBMITTED');
    }

    const window = windows.find(w => w.id === attempt.windowId);
    if (!window) throw new ApiException('Attempt window missing', 500);

    const deadline = attemptDeadline(attempt, window);
    if (deadline.getTime() <= Date.now()) {
      throw new ApiException('Time is up for this attempt', 409, 'TIME_UP');
    }

    const [sections, savedAnswers] = await Promise.all([
      getTestContent(test.id),
      db.select().from(testAnswers).where(eq(testAnswers.attemptId, attempt.id)),
    ]);

    return {
      test: {
        slug: test.slug,
        title: test.title,
        bucket: test.bucket,
        totalQuestions: test.totalQuestions,
        totalMarks: test.totalMarks,
      },
      attempt: {
        id: attempt.id,
        mode: attempt.mode,
        startedAt: attempt.startedAt.getTime(),
        deadline: deadline.getTime(),
        tabLeaveCount: attempt.tabLeaveCount,
        resetCount: attempt.resetCount,
      },
      sections,
      answers: savedAnswers.map(a => ({
        questionId: a.questionId,
        selectedKey: a.selectedKey,
        flagged: a.flagged,
      })),
    };
  });
}
