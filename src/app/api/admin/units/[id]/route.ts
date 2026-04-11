/**
 * PATCH  /api/admin/units/[id]  — update unit name / description / order
 * DELETE /api/admin/units/[id]  — delete unit (cascades to themes + words)
 *
 * Admin only.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db, vocabUnits } from '@/lib/db';
import { safeApiHandler, ApiException } from '@/lib/api-utils';

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const { id } = await params;
    const unitId = parseInt(id, 10);
    if (!unitId) throw new ApiException('Invalid unit id', 400);

    const existing = await db
      .select()
      .from(vocabUnits)
      .where(eq(vocabUnits.id, unitId))
      .get();
    if (!existing) throw new ApiException('Unit not found', 404);

    const body = await req.json();
    const { name, description, order } = body as {
      name?:        string;
      description?: string;
      order?:       number;
    };

    const updateSet: Partial<typeof existing> = {};
    if (name        !== undefined) updateSet.name        = name.trim();
    if (description !== undefined) updateSet.description = description.trim() || null;
    if (order       !== undefined) updateSet.order       = order;

    if (Object.keys(updateSet).length === 0) {
      throw new ApiException('No fields to update', 400);
    }

    const [updated] = await db
      .update(vocabUnits)
      .set(updateSet)
      .where(eq(vocabUnits.id, unitId))
      .returning();

    return { unit: updated };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const { id } = await params;
    const unitId = parseInt(id, 10);
    if (!unitId) throw new ApiException('Invalid unit id', 400);

    const existing = await db
      .select({ id: vocabUnits.id })
      .from(vocabUnits)
      .where(eq(vocabUnits.id, unitId))
      .get();
    if (!existing) throw new ApiException('Unit not found', 404);

    // ON DELETE CASCADE handles themes and words
    await db.delete(vocabUnits).where(eq(vocabUnits.id, unitId));

    return { ok: true };
  });
}
