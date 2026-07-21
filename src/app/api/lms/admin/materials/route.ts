/**
 * GET  /api/lms/admin/materials — list all materials
 * POST /api/lms/admin/materials — create metadata row (after client upload)
 *
 * When classSessionId is provided, the new material is also inserted into
 * session_materials so it shows up in the many-to-many class↔material view.
 */

import { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, materials, sessionMaterials } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { LMS_SUBJECTS } from '@/lib/lms/constants';
import { resolveFileUrl } from '@/lib/storage/r2';
import { DOC_TYPES } from '@/lib/naming/taxonomy';

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

    const { title, type, blobUrl, fileName, fileSize, subject, product, batch, classSessionId, docType, number, topic } = body;

    if (!title || typeof title !== 'string') throw new ApiException('title is required', 400);
    if (!type || !['pdf', 'link'].includes(type)) throw new ApiException("type must be 'pdf' or 'link'", 400);
    if (!blobUrl || typeof blobUrl !== 'string') throw new ApiException('blobUrl is required', 400);
    const sessionId: number | null = classSessionId ? Number(classSessionId) : null;
    if (sessionId !== null && (!Number.isInteger(sessionId) || sessionId <= 0)) {
      throw new ApiException('classSessionId must be a valid class id', 400);
    }
    if (docType !== undefined && docType !== null && !(DOC_TYPES as readonly { key: string }[]).some(d => d.key === docType)) {
      throw new ApiException(`docType must be one of: ${DOC_TYPES.map(d => d.key).join(', ')}`, 400);
    }

    // Materials attached to a class inherit its access scope. Previously the
    // class and material could disagree, so students saw a PDF link and were
    // silently rejected by the viewer after clicking it.
    const linkedSession = sessionId === null
      ? null
      : await db
          .select({
            subject: classSessions.subject,
            product: classSessions.product,
            batch: classSessions.batch,
          })
          .from(classSessions)
          .where(eq(classSessions.id, sessionId))
          .get();

    if (sessionId !== null && !linkedSession) {
      throw new ApiException('The selected class no longer exists', 404);
    }

    const resolvedSubject = linkedSession?.subject ?? subject;
    const resolvedProduct = linkedSession?.product ?? product;
    const resolvedBatch = linkedSession ? linkedSession.batch : (batch ?? null);

    if (!resolvedSubject || !(LMS_SUBJECTS as readonly string[]).includes(resolvedSubject)) {
      throw new ApiException(`subject must be one of: ${LMS_SUBJECTS.join(', ')}`, 400);
    }
    if (!resolvedProduct || typeof resolvedProduct !== 'string') {
      throw new ApiException('product is required when no class is selected', 400);
    }

    const [created] = await db
      .insert(materials)
      .values({
        title,
        type,
        blobUrl,
        fileName: fileName ?? null,
        fileSize: fileSize ?? null,
        subject: resolvedSubject,
        product: resolvedProduct,
        batch: resolvedBatch,
        docType: docType ?? null,
        number: number ?? null,
        topic: topic ?? null,
        classSessionId: sessionId,
        uploadedBy: staff.id,
      })
      .returning();

    // Also insert into session_materials junction for many-to-many support
    if (sessionId) {
      await db
        .insert(sessionMaterials)
        .values({ sessionId, materialId: created.id })
        .onConflictDoNothing();
    }

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
    docType: m.docType,
    number: m.number,
    topic: m.topic,
    classSessionId: m.classSessionId,
    uploadedBy: m.uploadedBy,
    createdAt: m.createdAt.getTime(),
  };
}
