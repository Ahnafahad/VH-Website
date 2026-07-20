/**
 * PATCH /api/lms/admin/submissions/[id]/check
 * Toggle the instructor's "checked" tracking mark for an offline-declared
 * submission (mode='offline'). Purely a tracking flag — does not gate the
 * student's access to the assignment solution.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assignmentSubmissions } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) throw new ApiException('Invalid id', 400);

    const body = (await req.json()) as { checked?: boolean };
    if (typeof body.checked !== 'boolean') {
      throw new ApiException('checked must be a boolean', 400);
    }

    const existing = await db
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.id, submissionId))
      .get();
    if (!existing) throw new ApiException('Submission not found', 404);

    const [updated] = await db
      .update(assignmentSubmissions)
      .set({ offlineChecked: body.checked })
      .where(eq(assignmentSubmissions.id, submissionId))
      .returning();

    return { id: updated.id, offlineChecked: updated.offlineChecked };
  });
}
