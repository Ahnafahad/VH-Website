/**
 * POST /api/marathon/[slug]/[day]/start
 * Starts (or resumes) the caller's attempt for this day. One attempt per
 * student per day — a submitted attempt blocks starting again.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireUnlockedDayForUser } from '@/lib/marathon/route-helpers';
import { startOrResumeAttempt } from '@/lib/marathon/service';

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
    const { attempt, resumed } = await startOrResumeAttempt(dayRow.id, user.id);
    return { attemptId: attempt.id, resumed, startedAt: attempt.startedAt.getTime() };
  });
}
