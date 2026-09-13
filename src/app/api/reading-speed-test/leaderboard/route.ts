/**
 * GET /api/reading-speed-test/leaderboard
 * Site-wide top 5 by best verified WPM, plus the caller's own row if outside it.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/reading-speed-test/route-helpers';
import { getLeaderboard } from '@/lib/reading-speed-test/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    return { leaderboard: await getLeaderboard(user.id) };
  });
}
