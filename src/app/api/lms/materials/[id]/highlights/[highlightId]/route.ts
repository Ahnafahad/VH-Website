/**
 * PATCH /api/lms/materials/[id]/highlights/[highlightId] — update note/color
 * DELETE /api/lms/materials/[id]/highlights/[highlightId] — delete
 *
 * Both enforce userId = me in WHERE (404 if not mine — never leak others' highlights).
 */

import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { materialHighlights } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; highlightId: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { highlightId } = await params;

    const hid = parseInt(highlightId, 10);
    if (isNaN(hid)) throw new ApiException('Invalid highlight id', 400);

    const existing = await db
      .select()
      .from(materialHighlights)
      .where(and(eq(materialHighlights.id, hid), eq(materialHighlights.userId, user.id)))
      .get();

    if (!existing) throw new ApiException('Highlight not found', 404);

    const body = await req.json() as Record<string, unknown>;
    const { note, color } = body;

    const validColors = ['yellow', 'green', 'blue', 'pink'];
    const updates: Partial<typeof materialHighlights.$inferInsert> = {
      updatedAt: new Date(),
    };

    if ('note' in body) {
      updates.note = typeof note === 'string' ? note.trim() || null : null;
    }
    if ('color' in body) {
      if (typeof color !== 'string' || !validColors.includes(color)) {
        throw new ApiException(`color must be one of: ${validColors.join(', ')}`, 400);
      }
      updates.color = color;
    }

    const [updated] = await db
      .update(materialHighlights)
      .set(updates)
      .where(and(eq(materialHighlights.id, hid), eq(materialHighlights.userId, user.id)))
      .returning();

    return {
      id: updated.id,
      materialId: updated.materialId,
      pageNumber: updated.pageNumber,
      position: JSON.parse(updated.position) as unknown,
      selectedText: updated.selectedText,
      note: updated.note,
      color: updated.color,
      updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.getTime() : Number(updated.updatedAt),
    };
  });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; highlightId: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { highlightId } = await params;

    const hid = parseInt(highlightId, 10);
    if (isNaN(hid)) throw new ApiException('Invalid highlight id', 400);

    const existing = await db
      .select()
      .from(materialHighlights)
      .where(and(eq(materialHighlights.id, hid), eq(materialHighlights.userId, user.id)))
      .get();

    if (!existing) throw new ApiException('Highlight not found', 404);

    await db
      .delete(materialHighlights)
      .where(and(eq(materialHighlights.id, hid), eq(materialHighlights.userId, user.id)));

    return { success: true };
  });
}
