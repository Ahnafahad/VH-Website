/**
 * POST /api/admin/essays/scripts/[id]/reference — { isReference, label } — pin/unpin as a marking reference.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { parseId, requireEssayStaff } from '@/lib/essays/route-helpers';
import { setReference } from '@/lib/essays/service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    const body = (await req.json()) as { isReference?: unknown; label?: unknown };
    await setReference(parseId((await params).id), body.isReference === true, body.label);
    return { ok: true };
  });
}
