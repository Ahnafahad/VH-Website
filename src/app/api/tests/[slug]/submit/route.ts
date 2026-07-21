/**
 * POST /api/tests/[slug]/submit
 * Finalizes the caller's in-progress attempt: scores it server-side and marks
 * it submitted. Allowed slightly past the deadline (grace period) so an
 * auto-submit fired at 0:00 still lands.
 *
 * Staff diagnostic retakes: when the attempt carries a bestSnapshot (parked
 * by the /fbs-diagnosis/[slug]/start retake path), this submission's score is
 * compared against it. The higher of the two wins — its score+answers end up
 * on the row and bestSnapshot is cleared either way. Never set for regular
 * attempts, so this is a no-op for everyone else.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts, testAnswers } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireTestForUser } from '@/lib/tests/route-helpers';
import { getUserAttempt, scoreAttemptById } from '@/lib/tests/service';
import { attemptDeadline } from '@/lib/tests/windows';
import { parseChosenSections } from '@/lib/tests/diagnostic';
import { parseBestSnapshot } from '@/lib/tests/best-snapshot';

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

    const parked = parseBestSnapshot(attempt.bestSnapshot);
    if (parked && parked.totalScore > score.totalScore) {
      // The retake scored lower — restore the parked best instead of keeping it.
      await db.delete(testAnswers).where(eq(testAnswers.attemptId, attempt.id));
      if (parked.answers.length > 0) {
        await db.insert(testAnswers).values(
          parked.answers.map(a => ({
            attemptId: attempt.id,
            questionId: a.questionId,
            selectedKey: a.selectedKey,
            flagged: a.flagged,
          })),
        );
      }
      await db.update(testAttempts).set({
        status: 'submitted',
        submittedAt: new Date(parked.submittedAt),
        totalScore: parked.totalScore,
        totalCorrect: parked.totalCorrect,
        totalWrong: parked.totalWrong,
        totalUnattempted: parked.totalUnattempted,
        sectionScores: parked.sectionScores,
        bestSnapshot: null,
      }).where(eq(testAttempts.id, attempt.id));
    } else {
      // This attempt is the new best (or there was nothing parked).
      await db.update(testAttempts).set({
        status: 'submitted',
        submittedAt: new Date(),
        totalScore: score.totalScore,
        totalCorrect: score.totalCorrect,
        totalWrong: score.totalWrong,
        totalUnattempted: score.totalUnattempted,
        sectionScores: JSON.stringify(score.sections),
        bestSnapshot: null,
      }).where(eq(testAttempts.id, attempt.id));
    }

    // Score is NOT returned — results stay hidden until the windows close.
    return { submitted: true };
  });
}
