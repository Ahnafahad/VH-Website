/**
 * PUT    /api/printdesk/[id] — { materialIds } — edit a request while it is still 'requested'.
 * DELETE /api/printdesk/[id] — cancel a request while it is still 'requested'.
 */

import { NextRequest } from 'next/server';
import { ApiException, safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { cancelRequest, updateRequest } from '@/lib/printdesk/service';

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiException('Invalid id', 400);
  return id;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { materialIds } = (await req.json()) as { materialIds?: unknown };
    return updateRequest(user, parseId((await params).id), materialIds);
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    await cancelRequest(user, parseId((await params).id));
    return { ok: true };
  });
}
