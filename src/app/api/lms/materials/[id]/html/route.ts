/**
 * GET /api/lms/materials/[id]/html
 * Streams an instructor-uploaded HTML material from private R2 storage with the
 * same scope + solution-gate checks as the PDF viewer.
 *
 * Instructor HTML is untrusted from the site's point of view (it can carry
 * scripts), so it is never served from our origin unsandboxed: the CSP
 * `sandbox` directive gives the document an opaque origin, which means its
 * scripts cannot read our cookies/storage or call our APIs as the student. The
 * viewer page also embeds it with a matching <iframe sandbox>.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materials } from '@/lib/db/schema';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';
import { getGatedSolutionMaterialIds } from '@/lib/lms/homework-access';
import { r2GetBytes } from '@/lib/storage/r2';
import { HTML_MATERIAL_SANDBOX } from '@/lib/lms/html-material';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const materialId = parseInt(id, 10);
    if (isNaN(materialId)) throw new ApiException('Invalid id', 400);

    const material = await db
      .select()
      .from(materials)
      .where(eq(materials.id, materialId))
      .get();
    if (!material || material.type !== 'html') throw new ApiException('Material not found', 404);

    if (!canAccessLmsContent(user, { product: material.product, batch: material.batch })) {
      throw new ApiException('Access denied', 403, 'FORBIDDEN');
    }
    const gatedIds = await getGatedSolutionMaterialIds(user, [material.id]);
    if (gatedIds.has(material.id)) throw new ApiException('Access denied', 403, 'FORBIDDEN');

    const { body } = await r2GetBytes(material.blobUrl);
    return new NextResponse(Buffer.from(body), {
      headers: {
        // Always force HTML + UTF-8 regardless of what was stored.
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': `sandbox ${HTML_MATERIAL_SANDBOX}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
