/**
 * GET  /api/lms/admin/assignments — list all assignments
 * POST /api/lms/admin/assignments — create an assignment
 */

import { NextRequest } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assignments } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    const rows = await db
      .select()
      .from(assignments)
      .orderBy(asc(assignments.dueAt));
    return rows.map(serializeAssignment);
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const body = await req.json();

    const { title, description, attachmentUrl, materialId, solutionMaterialId, subject, product, batch, classSessionId, dueAt } = body;

    if (!title || typeof title !== 'string') throw new ApiException('title is required', 400);
    if (!description || typeof description !== 'string') throw new ApiException('description is required', 400);
    if (!subject || !(LMS_SUBJECTS as readonly string[]).includes(subject)) {
      throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
    }
    if (!product || typeof product !== 'string') throw new ApiException('product is required', 400);
    if (!dueAt) throw new ApiException('dueAt is required', 400);
    const dueAtDate = new Date(dueAt);
    if (isNaN(dueAtDate.getTime())) throw new ApiException('dueAt must be a valid date', 400);

    const [created] = await db
      .insert(assignments)
      .values({
        title,
        description,
        attachmentUrl: attachmentUrl ?? null,
        materialId: materialId ? Number(materialId) : null,
        solutionMaterialId: solutionMaterialId ? Number(solutionMaterialId) : null,
        subject,
        product,
        batch: batch ?? null,
        classSessionId: classSessionId ?? null,
        dueAt: dueAtDate,
        createdBy: staff.id,
      })
      .returning();

    return serializeAssignment(created);
  });
}

function serializeAssignment(a: typeof assignments.$inferSelect) {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    attachmentUrl: a.attachmentUrl,
    materialId: a.materialId ?? null,
    solutionMaterialId: a.solutionMaterialId ?? null,
    subject: a.subject,
    product: a.product,
    batch: a.batch,
    classSessionId: a.classSessionId,
    dueAt: a.dueAt.getTime(),
    createdBy: a.createdBy,
    createdAt: a.createdAt.getTime(),
  };
}
