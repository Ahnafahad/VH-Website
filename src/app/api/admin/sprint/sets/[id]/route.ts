/**
 * PATCH /api/admin/sprint/sets/[id]
 * Body: { status: 'draft' | 'active' } — Activate/Deactivate.
 *
 * DELETE /api/admin/sprint/sets/[id]
 * Removes the set. Blocked (409) if any student already has an attempt on it.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireSprintStaff } from '@/lib/sprint/route-helpers';
import { setSetStatus, deleteSet } from '@/lib/sprint/service';

const bodySchema = z.object({ status: z.enum(['draft', 'active']) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireSprintStaff();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) throw new ApiException('Invalid set id', 400);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);

    await setSetStatus(id, parsed.data.status);
    return { updated: true };
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireSprintStaff();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) throw new ApiException('Invalid set id', 400);

    await deleteSet(id);
    return { deleted: true };
  });
}
