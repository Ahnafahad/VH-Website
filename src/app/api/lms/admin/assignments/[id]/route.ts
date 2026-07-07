/**
 * PATCH  /api/lms/admin/assignments/[id] — update an assignment
 * DELETE /api/lms/admin/assignments/[id] — delete an assignment
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assignments } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const assignmentId = parseInt(id, 10);
    if (isNaN(assignmentId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .get();
    if (!existing) throw new ApiException('Assignment not found', 404);

    const body = await req.json();
    const updates: Partial<typeof assignments.$inferInsert> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string') throw new ApiException('title must be a string', 400);
      updates.title = body.title;
    }
    if (body.description !== undefined) {
      if (typeof body.description !== 'string') throw new ApiException('description must be a string', 400);
      updates.description = body.description;
    }
    if (body.attachmentUrl !== undefined) updates.attachmentUrl = body.attachmentUrl ?? null;
    if (body.subject !== undefined) {
      if (!(LMS_SUBJECTS as readonly string[]).includes(body.subject)) {
        throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
      }
      updates.subject = body.subject;
    }
    if (body.product !== undefined) updates.product = body.product;
    if (body.batch !== undefined) updates.batch = body.batch ?? null;
    if (body.classSessionId !== undefined) updates.classSessionId = body.classSessionId ?? null;
    if (body.dueAt !== undefined) {
      const d = new Date(body.dueAt);
      if (isNaN(d.getTime())) throw new ApiException('dueAt must be a valid date', 400);
      updates.dueAt = d;
    }

    if (Object.keys(updates).length === 0) throw new ApiException('No fields to update', 400);

    const [updated] = await db
      .update(assignments)
      .set(updates)
      .where(eq(assignments.id, assignmentId))
      .returning();

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      attachmentUrl: updated.attachmentUrl,
      subject: updated.subject,
      product: updated.product,
      batch: updated.batch,
      classSessionId: updated.classSessionId,
      dueAt: updated.dueAt.getTime(),
      createdBy: updated.createdBy,
      createdAt: updated.createdAt.getTime(),
    };
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const assignmentId = parseInt(id, 10);
    if (isNaN(assignmentId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .get();
    if (!existing) throw new ApiException('Assignment not found', 404);

    await db.delete(assignments).where(eq(assignments.id, assignmentId));

    return { deleted: true };
  });
}
