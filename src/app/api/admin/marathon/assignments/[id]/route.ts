/**
 * PATCH /api/admin/marathon/assignments/[id]
 * Body: { startDate: number } — edits an existing assignment's Day-1 unlock
 * date after the fact (creation-time date doesn't need to be final).
 *
 * DELETE /api/admin/marathon/assignments/[id]
 * Removes the assignment. Blocked (409) if any eligible student already has
 * an attempt on one of the chapter's days — mirrors the test-windows delete guard.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireMarathonStaff } from '@/lib/marathon/route-helpers';
import { updateAssignmentStartDate, deleteAssignment } from '@/lib/marathon/service';

const bodySchema = z.object({ startDate: z.number().int().positive() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    await requireMarathonStaff(user);
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) throw new ApiException('Invalid assignment id', 400);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    await updateAssignmentStartDate(id, new Date(parsed.data.startDate));
    return { updated: true };
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    await requireMarathonStaff(user);
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) throw new ApiException('Invalid assignment id', 400);
    await deleteAssignment(id);
    return { deleted: true };
  });
}
