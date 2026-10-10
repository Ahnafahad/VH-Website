/**
 * POST   /api/admin/essays/scripts/[id]/lock — take/renew the marking lock (heartbeat).
 *        ?force=1 lets an admin take over someone else's lock.
 * DELETE /api/admin/essays/scripts/[id]/lock — release the caller's lock.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { acquireLock, releaseLock } from '@/lib/essays/service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    return acquireLock(parseId((await params).id), user, req.nextUrl.searchParams.get('force') === '1');
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    await releaseLock(parseId((await params).id), user);
    return { ok: true };
  });
}
