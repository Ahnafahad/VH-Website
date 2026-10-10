/**
 * GET /api/admin/essays/series/[id]/scripts — every script in the series with
 * status/lock/assignment, the students still missing an essay, and grading stats.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { getSeriesScripts } from '@/lib/essays/service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    return getSeriesScripts(parseId((await params).id), user);
  });
}
