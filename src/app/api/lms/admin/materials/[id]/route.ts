/**
 * PATCH  /api/lms/admin/materials/[id] — update material metadata
 * DELETE /api/lms/admin/materials/[id] — delete from DB + R2 (if PDF key)
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materials } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { r2Delete, resolveFileUrl } from '@/lib/storage/r2';
import { LMS_SUBJECTS } from '@/lib/lms/constants';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const materialId = parseInt(id, 10);
    if (isNaN(materialId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(materials)
      .where(eq(materials.id, materialId))
      .get();
    if (!existing) throw new ApiException('Material not found', 404);

    const body = await req.json();
    const updates: Partial<typeof materials.$inferInsert> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string') throw new ApiException('title must be a string', 400);
      updates.title = body.title;
    }
    if (body.subject !== undefined) {
      if (!(LMS_SUBJECTS as readonly string[]).includes(body.subject)) {
        throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
      }
      updates.subject = body.subject;
    }
    if (body.product !== undefined) updates.product = body.product;
    if (body.batch !== undefined) updates.batch = body.batch ?? null;
    if (body.classSessionId !== undefined) updates.classSessionId = body.classSessionId ?? null;

    if (Object.keys(updates).length === 0) throw new ApiException('No fields to update', 400);

    const [updated] = await db
      .update(materials)
      .set(updates)
      .where(eq(materials.id, materialId))
      .returning();

    return {
      id: updated.id,
      title: updated.title,
      type: updated.type,
      blobUrl: (await resolveFileUrl(updated.blobUrl)) ?? '',
      fileName: updated.fileName,
      fileSize: updated.fileSize,
      subject: updated.subject,
      product: updated.product,
      batch: updated.batch,
      classSessionId: updated.classSessionId,
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
    const materialId = parseInt(id, 10);
    if (isNaN(materialId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(materials)
      .where(eq(materials.id, materialId))
      .get();
    if (!existing) throw new ApiException('Material not found', 404);

    // Delete from R2 if this is a PDF stored as an R2 key (not an http URL).
    // Best-effort — DB deletion must not fail on storage error.
    if (existing.type === 'pdf' && existing.blobUrl && !existing.blobUrl.startsWith('http')) {
      try {
        await r2Delete(existing.blobUrl);
      } catch (storageErr) {
        console.error('[lms/admin/materials] R2 delete failed:', storageErr);
        // Continue — DB row deletion takes priority
      }
    }

    await db.delete(materials).where(eq(materials.id, materialId));

    return { deleted: true };
  });
}
