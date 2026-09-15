/**
 * GET /api/admin/sprint/sets/[id]/live
 * Live aggregate stats for the instructor monitor view: submission count,
 * per-question option-distribution breakdown, and a full (uncapped) leaderboard.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireSprintStaff } from '@/lib/sprint/route-helpers';
import { getLiveStats } from '@/lib/sprint/service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireSprintStaff();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) throw new ApiException('Invalid set id', 400);

    return getLiveStats(id);
  });
}
