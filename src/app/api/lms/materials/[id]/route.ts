/**
 * GET /api/lms/materials/[id]
 * Scope-checked single material. Returns 403 if out of scope.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materials } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';
import { resolveFileUrl } from '@/lib/storage/r2';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const materialId = parseInt(id, 10);
    if (isNaN(materialId)) throw new ApiException('Invalid id', 400);

    const material = await db
      .select()
      .from(materials)
      .where(eq(materials.id, materialId))
      .get();

    if (!material) throw new ApiException('Material not found', 404);

    if (
      !canAccessLmsContent(user, {
        product: material.product,
        batch: material.batch,
      })
    ) {
      throw new ApiException('Access denied', 403, 'FORBIDDEN');
    }

    return {
      id: material.id,
      title: material.title,
      type: material.type,
      blobUrl: (await resolveFileUrl(material.blobUrl)) ?? '',
      fileName: material.fileName,
      fileSize: material.fileSize,
      subject: material.subject,
      product: material.product,
      batch: material.batch,
      classSessionId: material.classSessionId,
      createdAt: material.createdAt.getTime(),
    };
  });
}
