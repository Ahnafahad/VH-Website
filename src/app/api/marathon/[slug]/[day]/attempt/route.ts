/**
 * GET /api/marathon/[slug]/[day]/attempt
 * Full taking payload for the caller's in-progress attempt on this day
 * (questions without correctKey/solution, plus their answers-so-far).
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireUnlockedDayForUser } from '@/lib/marathon/route-helpers';
import { getUserAttempt, buildAttemptPayload } from '@/lib/marathon/service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; day: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug, day } = await params;
    const dayNumber = Number(day);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) throw new ApiException('Invalid day', 400);

    const { chapter, day: dayRow } = await requireUnlockedDayForUser(slug, dayNumber, user);
    const attempt = await getUserAttempt(dayRow.id, user.id);
    if (!attempt || attempt.status !== 'in_progress') {
      throw new ApiException('No in-progress attempt — start the day first', 409, 'NO_ATTEMPT');
    }
    return buildAttemptPayload(chapter, dayRow, attempt);
  });
}
