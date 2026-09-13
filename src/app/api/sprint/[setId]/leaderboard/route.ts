/**
 * GET /api/sprint/[setId]/leaderboard
 * Top 5 for this set (accuracy desc, then time asc), plus the caller's own
 * row if they fall outside the top 5.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireSprintAccess } from '@/lib/sprint/route-helpers';
import { getSet, getLeaderboard } from '@/lib/sprint/service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ setId: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireSprintAccess();
    const setId = Number((await params).setId);
    if (!Number.isInteger(setId)) throw new ApiException('Invalid set', 400);

    const set = await getSet(setId);
    if (!set) throw new ApiException('Set not found', 404, 'SET_NOT_FOUND');

    return { leaderboard: await getLeaderboard(setId, user.id) };
  });
}
