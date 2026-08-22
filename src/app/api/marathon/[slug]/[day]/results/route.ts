/**
 * GET /api/marathon/[slug]/[day]/results
 * Available immediately after the caller submits this day (no cohort window
 * to wait out, unlike the tests module) — per-question answer key + solution
 * (when authored) + live class stats (correct/wrong/skipped/median time) +
 * this student's own time-flags + a chapter-wide subtopic weakness rollup.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireUnlockedDayForUser } from '@/lib/marathon/route-helpers';
import { getDayResults } from '@/lib/marathon/service';

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
    const results = await getDayResults(chapter, dayRow, user.id);
    if (!results) throw new ApiException('Submit this day to see results', 409, 'NOT_SUBMITTED');
    return results;
  });
}
