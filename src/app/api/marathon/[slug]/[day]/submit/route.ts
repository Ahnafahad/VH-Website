/**
 * POST /api/marathon/[slug]/[day]/submit
 * Finalizes the caller's attempt: scores it (plain correct-count, no negative
 * marking), computes active time (elapsed minus paused time), and marks the
 * day submitted. Idempotent-ish: calling again on an already-submitted
 * attempt is rejected, not double-scored.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireUnlockedDayForUser } from '@/lib/marathon/route-helpers';
import { requireInProgressAttempt, submitAttempt } from '@/lib/marathon/service';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string; day: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug, day } = await params;
    const dayNumber = Number(day);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) throw new ApiException('Invalid day', 400);

    const { day: dayRow } = await requireUnlockedDayForUser(slug, dayNumber, user);
    const attempt = await requireInProgressAttempt(dayRow.id, user.id);

    const score = await submitAttempt(attempt, dayRow);
    return { attemptId: attempt.id, ...score };
  });
}
