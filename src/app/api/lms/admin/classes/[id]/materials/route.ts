/**
 * GET  /api/lms/admin/classes/[id]/materials        — list materials linked to session
 * POST /api/lms/admin/classes/[id]/materials        — attach existing material by materialId
 * DELETE /api/lms/admin/classes/[id]/materials?materialId=  — detach material
 */

import { NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, materials, sessionMaterials } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { resolveFileUrl } from '@/lib/storage/r2';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid session id', 400);

    // Union: junction table rows + legacy classSessionId FK
    const [junctionRows, legacyRows] = await Promise.all([
      db
        .select({ materialId: sessionMaterials.materialId })
        .from(sessionMaterials)
        .where(eq(sessionMaterials.sessionId, sessionId)),
      db
        .select({ id: materials.id })
        .from(materials)
        .where(eq(materials.classSessionId, sessionId)),
    ]);

    const idSet = new Set<number>([
      ...junctionRows.map((r) => r.materialId),
      ...legacyRows.map((r) => r.id),
    ]);

    if (idSet.size === 0) return [];

    const rows = await db
      .select()
      .from(materials)
      .where(inArray(materials.id, [...idSet]));

    return Promise.all(
      rows.map(async (m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        blobUrl: (await resolveFileUrl(m.blobUrl)) ?? m.blobUrl,
        fileName: m.fileName,
        fileSize: m.fileSize,
        subject: m.subject,
        product: m.product,
        batch: m.batch,
        createdAt: m.createdAt.getTime(),
      })),
    );
  });
}

export async function POST(req: NextRequest, { params }: RouteCtx) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid session id', 400);

    const session = await db
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!session) throw new ApiException('Session not found', 404);

    const body = await req.json() as { materialId: number };
    if (!body.materialId || typeof body.materialId !== 'number') {
      throw new ApiException('materialId (number) is required', 400);
    }

    const material = await db
      .select({ id: materials.id })
      .from(materials)
      .where(eq(materials.id, body.materialId))
      .get();
    if (!material) throw new ApiException('Material not found', 404);

    await db
      .insert(sessionMaterials)
      .values({ sessionId, materialId: body.materialId })
      .onConflictDoNothing();

    return { sessionId, materialId: body.materialId };
  });
}

export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid session id', 400);

    const url = new URL(req.url);
    const materialId = parseInt(url.searchParams.get('materialId') ?? '', 10);
    if (isNaN(materialId)) throw new ApiException('materialId query param required', 400);

    await db
      .delete(sessionMaterials)
      .where(
        and(
          eq(sessionMaterials.sessionId, sessionId),
          eq(sessionMaterials.materialId, materialId),
        ),
      );

    return { deleted: true };
  });
}
