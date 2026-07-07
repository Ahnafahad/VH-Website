/**
 * GET /api/lms/materials/[id]/highlights  — list my highlights for this material
 * POST /api/lms/materials/[id]/highlights — create a new highlight
 */

import { NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materials, materialHighlights } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getMaterialAndCheckAccess(id: string, userId: number) {
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

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;

    const { material, materialId } = await getMaterialAndCheckAccess(id, user.id);

    if (!canAccessLmsContent(user, { product: material.product, batch: material.batch })) {
      throw new ApiException('Access denied', 403, 'FORBIDDEN');
    }

    const highlights = await db
      .select()
      .from(materialHighlights)
      .where(
        and(
          eq(materialHighlights.materialId, materialId),
          eq(materialHighlights.userId, user.id),
        ),
      )
      .orderBy(asc(materialHighlights.pageNumber));

    return highlights.map((h) => ({
      id: h.id,
      materialId: h.materialId,
      pageNumber: h.pageNumber,
      position: JSON.parse(h.position) as unknown,
      selectedText: h.selectedText,
      note: h.note,
      color: h.color,
      updatedAt: h.updatedAt instanceof Date ? h.updatedAt.getTime() : Number(h.updatedAt),
    }));
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;

    const { material, materialId } = await getMaterialAndCheckAccess(id, user.id);

    if (!canAccessLmsContent(user, { product: material.product, batch: material.batch })) {
      throw new ApiException('Access denied', 403, 'FORBIDDEN');
    }

    const body = await req.json() as Record<string, unknown>;

    const { pageNumber, position, selectedText, note, color } = body;

    if (typeof pageNumber !== 'number' || pageNumber < 1) {
      throw new ApiException('pageNumber must be a positive integer', 400);
    }
    if (!position || typeof position !== 'object') {
      throw new ApiException('position must be an object', 400);
    }
    if (typeof selectedText !== 'string' || selectedText.trim() === '') {
      throw new ApiException('selectedText is required', 400);
    }

    const validColors = ['yellow', 'green', 'blue', 'pink'];
    const resolvedColor = typeof color === 'string' && validColors.includes(color) ? color : 'yellow';

    const now = new Date();

    const [created] = await db
      .insert(materialHighlights)
      .values({
        userId: user.id,
        materialId,
        pageNumber,
        position: JSON.stringify(position),
        selectedText: selectedText.trim(),
        note: typeof note === 'string' ? note.trim() || null : null,
        color: resolvedColor,
        updatedAt: now,
      })
      .returning();

    return {
      id: created.id,
      materialId: created.materialId,
      pageNumber: created.pageNumber,
      position: JSON.parse(created.position) as unknown,
      selectedText: created.selectedText,
      note: created.note,
      color: created.color,
      updatedAt: created.updatedAt instanceof Date ? created.updatedAt.getTime() : Number(created.updatedAt),
    };
  });
}
