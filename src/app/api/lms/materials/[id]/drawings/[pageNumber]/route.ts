/**
 * PUT    /api/lms/materials/[id]/drawings/[pageNumber] — upsert (replace) this page's strokes
 * DELETE /api/lms/materials/[id]/drawings/[pageNumber] — clear this page's strokes
 *
 * One row per (user, material, page) — the client always sends the full
 * strokes array for that page, so PUT is a straightforward replace.
 */

import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materials, materialDrawings } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';

async function getMaterialAndCheckAccess(id: string) {
  const materialId = parseInt(id, 10);
  if (isNaN(materialId)) throw new ApiException('Invalid material id', 400);

  const material = await db
    .select()
    .from(materials)
    .where(eq(materials.id, materialId))
    .get();

  if (!material) throw new ApiException('Material not found', 404);
  return { material, materialId };
}

const MAX_STROKES_PER_PAGE = 500;

function validateStrokes(body: unknown): { points: { x: number; y: number }[]; color: string; width: number }[] {
  if (!Array.isArray(body)) throw new ApiException('strokes must be an array', 400);
  if (body.length > MAX_STROKES_PER_PAGE) {
    throw new ApiException(`A page can hold at most ${MAX_STROKES_PER_PAGE} strokes`, 400);
  }

  return body.map((s): { points: { x: number; y: number }[]; color: string; width: number } => {
    if (!s || typeof s !== 'object') throw new ApiException('Each stroke must be an object', 400);
    const stroke = s as Record<string, unknown>;

    if (!Array.isArray(stroke.points) || stroke.points.length === 0) {
      throw new ApiException('Each stroke needs a non-empty points array', 400);
    }
    const points = stroke.points.map((p): { x: number; y: number } => {
      if (!p || typeof p !== 'object') throw new ApiException('Each point must be an object', 400);
      const point = p as Record<string, unknown>;
      const x = typeof point.x === 'number' ? point.x : NaN;
      const y = typeof point.y === 'number' ? point.y : NaN;
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        throw new ApiException('Point coordinates must be numbers normalized to 0–1', 400);
      }
      return { x, y };
    });

    const color = typeof stroke.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(stroke.color)
      ? stroke.color
      : '#1A0507';
    const width = typeof stroke.width === 'number' && stroke.width > 0 && stroke.width <= 20
      ? stroke.width
      : 2;

    return { points, color, width };
  });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pageNumber: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id, pageNumber } = await params;

    const { material, materialId } = await getMaterialAndCheckAccess(id);
    if (!canAccessLmsContent(user, { product: material.product, batch: material.batch })) {
      throw new ApiException('Access denied', 403, 'FORBIDDEN');
    }

    const page = parseInt(pageNumber, 10);
    if (isNaN(page) || page < 1) throw new ApiException('Invalid page number', 400);

    const body = await req.json() as Record<string, unknown>;
    const strokes = validateStrokes(body.strokes);
    const now = new Date();
    const serialized = JSON.stringify(strokes);

    const [saved] = await db
      .insert(materialDrawings)
      .values({
        userId: user.id,
        materialId,
        pageNumber: page,
        strokes: serialized,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [materialDrawings.userId, materialDrawings.materialId, materialDrawings.pageNumber],
        set: { strokes: serialized, updatedAt: now },
      })
      .returning();

    return {
      pageNumber: saved.pageNumber,
      strokes: JSON.parse(saved.strokes) as unknown,
      updatedAt: saved.updatedAt instanceof Date ? saved.updatedAt.getTime() : Number(saved.updatedAt),
    };
  });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pageNumber: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id, pageNumber } = await params;

    const { materialId } = await getMaterialAndCheckAccess(id);
    const page = parseInt(pageNumber, 10);
    if (isNaN(page) || page < 1) throw new ApiException('Invalid page number', 400);

    await db
      .delete(materialDrawings)
      .where(
        and(
          eq(materialDrawings.userId, user.id),
          eq(materialDrawings.materialId, materialId),
          eq(materialDrawings.pageNumber, page),
        ),
      );

    return { success: true };
  });
}
