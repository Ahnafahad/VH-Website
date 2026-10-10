/**
 * GET    /api/admin/essays/series/[id] — series details.
 * PUT    /api/admin/essays/series/[id] — edit (name, prompt, date, sections, audience, deadline).
 * PATCH  /api/admin/essays/series/[id] — { status: 'active' | 'archived' }.
 * DELETE /api/admin/essays/series/[id] — only when nobody has submitted.
 */

import { NextRequest } from 'next/server';
import { ApiException, safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { deleteSeries, getSeriesOr404, parseSeriesInput, seriesDetailDTO, setSeriesStatus, updateSeries } from '@/lib/essays/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    return { series: seriesDetailDTO(await getSeriesOr404(parseId((await params).id))) };
  });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    const id = parseId((await params).id);
    await updateSeries(id, parseSeriesInput(await req.json()));
    return { series: seriesDetailDTO(await getSeriesOr404(id)) };
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    const { status } = (await req.json()) as { status?: string };
    if (status !== 'active' && status !== 'archived') throw new ApiException('Invalid status', 400);
    await setSeriesStatus(parseId((await params).id), status);
    return { ok: true };
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    await deleteSeries(parseId((await params).id));
    return { ok: true };
  });
}
