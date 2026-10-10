/**
 * GET  /api/admin/essays/series — every series with submission counts.
 * POST /api/admin/essays/series — create a series.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireEssayStaff } from '@/lib/essays/route-helpers';
import { createSeries, listSeriesForStaff, parseSeriesInput, seriesDetailDTO } from '@/lib/essays/service';

export async function GET() {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    return { series: await listSeriesForStaff() };
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    const input = parseSeriesInput(await req.json());
    return { series: seriesDetailDTO(await createSeries(input, user.id)) };
  });
}
