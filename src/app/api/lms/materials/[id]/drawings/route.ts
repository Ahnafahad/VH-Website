/**
 * GET /api/lms/materials/[id]/drawings — list my drawings (all pages) for this material
 */

import { NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materials, materialDrawings } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;

    const materialId = parseInt(id, 10);
    if (isNaN(materialId)) throw new ApiException('Invalid material id', 400);

    const material = await db
      .select()
      .from(materials)
      .where(eq(materials.id, materialId))
      .get();

    if (!material) throw new ApiException('Material not found', 404);
    if (!canAccessLmsContent(user, { product: material.product, batch: material.batch })) {
      throw new ApiException('Access denied', 403, 'FORBIDDEN');
    }

    const drawings = await db
      .select()
      .from(materialDrawings)
      .where(
        and(
          eq(materialDrawings.materialId, materialId),
          eq(materialDrawings.userId, user.id),
        ),
      )
      .orderBy(asc(materialDrawings.pageNumber));

    return drawings.map((d) => ({
      pageNumber: d.pageNumber,
      strokes: JSON.parse(d.strokes) as unknown,
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.getTime() : Number(d.updatedAt),
    }));
  });
}
