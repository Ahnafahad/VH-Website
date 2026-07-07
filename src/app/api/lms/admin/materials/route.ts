/**
 * GET  /api/lms/admin/materials — list all materials
 * POST /api/lms/admin/materials — create metadata row (after client upload)
 */

import { NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materials } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';
import { resolveFileUrl } from '@/lib/storage/r2';

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    const rows = await db
      .select()
      .from(materials)
      .orderBy(desc(materials.createdAt));
    return Promise.all(rows.map(serializeMaterial));
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const body = await req.json();

    const { title, type, blobUrl, fileName, fileSize, subject, product, batch, classSessionId } = body;

    if (!title || typeof title !== 'string') throw new ApiException('title is required', 400);
    if (!type || !['pdf', 'link'].includes(type)) throw new ApiException("type must be 'pdf' or 'link'", 400);
    if (!blobUrl || typeof blobUrl !== 'string') throw new ApiException('blobUrl is required', 400);
    if (!subject || !(LMS_SUBJECTS as readonly string[]).includes(subject)) {
      throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
    }
    if (!product || typeof product !== 'string') throw new ApiException('product is required', 400);

    const [created] = await db
      .insert(materials)
      .values({
        title,
        type,
        blobUrl,
        fileName: fileName ?? null,
        fileSize: fileSize ?? null,
        subject,
        product,
        batch: batch ?? null,
        classSessionId: classSessionId ?? null,
        uploadedBy: staff.id,
      })
      .returning();

    return await serializeMaterial(created);
  });
}

async function serializeMaterial(m: typeof materials.$inferSelect) {
  return {
    id: m.id,
    title: m.title,
    type: m.type,
    blobUrl: (await resolveFileUrl(m.blobUrl)) ?? '',
    fileName: m.fileName,
    fileSize: m.fileSize,
    subject: m.subject,
    product: m.product,
    batch: m.batch,
    classSessionId: m.classSessionId,
    uploadedBy: m.uploadedBy,
    createdAt: m.createdAt.getTime(),
  };
}
