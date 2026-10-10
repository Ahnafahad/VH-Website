/**
 * POST /api/admin/essays/series/[id]/duplicate — new series with the same sections and audience.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { duplicateSeries, seriesDetailDTO } from '@/lib/essays/service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    return { series: seriesDetailDTO(await duplicateSeries(parseId((await params).id), user.id)) };
  });
}
