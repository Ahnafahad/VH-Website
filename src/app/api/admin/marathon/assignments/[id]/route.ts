/**
 * PATCH /api/admin/marathon/assignments/[id]
 * Body: { startDate: number } — edits an existing assignment's Day-1 unlock
 * date after the fact (creation-time date doesn't need to be final).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireMarathonStaff } from '@/lib/marathon/route-helpers';
import { updateAssignmentStartDate } from '@/lib/marathon/service';

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
