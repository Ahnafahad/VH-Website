/**
 * POST /api/tests/[slug]/submit
 * Finalizes the caller's in-progress attempt: scores it server-side and marks
 * it submitted. Allowed slightly past the deadline (grace period) so an
 * auto-submit fired at 0:00 still lands.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireTestForUser } from '@/lib/tests/route-helpers';
import { getUserAttempt, scoreAttemptById } from '@/lib/tests/service';
import { attemptDeadline } from '@/lib/tests/windows';
import { parseChosenSections } from '@/lib/tests/diagnostic';

const GRACE_MS = 2 * 60_000;

export async function POST(
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
      throw new ApiException('You are banned from this test', 403, 'ATTEMPT_BANNED');
    }
    if (attempt.status === 'submitted') {
      throw new ApiException('Already submitted', 409, 'ALREADY_SUBMITTED');
    }

    const window = windows.find(w => w.id === attempt.windowId);
    if (!window) throw new ApiException('Attempt window missing', 500);
    const deadline = attemptDeadline(attempt, window).getTime();
    if (Date.now() > deadline + GRACE_MS) {
      throw new ApiException('Submission window has passed', 409, 'TIME_UP');
    }

    // Diagnostic: score only the 4 chosen sections so the max is 40.
    const chosen = test.isDiagnostic ? parseChosenSections(attempt.chosenSections) : [];
    const restrictIds = chosen.length > 0 ? chosen : undefined;
    const score = await scoreAttemptById(attempt.id, test.id, restrictIds);

    await db.update(testAttempts).set({
      status: 'submitted',
      submittedAt: new Date(),
      totalScore: score.totalScore,
      totalCorrect: score.totalCorrect,
      totalWrong: score.totalWrong,
      totalUnattempted: score.totalUnattempted,
      sectionScores: JSON.stringify(score.sections),
    }).where(eq(testAttempts.id, attempt.id));

    // Score is NOT returned — results stay hidden until the windows close.
    return { submitted: true };
  });
}
