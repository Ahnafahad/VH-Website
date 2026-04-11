/**
 * PATCH  /api/admin/themes/[id]  — update theme name / order
 * DELETE /api/admin/themes/[id]  — delete theme (cascades to words)
 *
 * Admin only.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db, vocabThemes } from '@/lib/db';
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
    const themeId = parseInt(id, 10);
    if (!themeId) throw new ApiException('Invalid theme id', 400);

    const existing = await db
      .select()
      .from(vocabThemes)
      .where(eq(vocabThemes.id, themeId))
      .get();
    if (!existing) throw new ApiException('Theme not found', 404);

    const body = await req.json();
    const { name, order } = body as { name?: string; order?: number };

    const updateSet: Partial<typeof existing> = {};
    if (name  !== undefined) updateSet.name  = name.trim();
    if (order !== undefined) updateSet.order = order;

    if (Object.keys(updateSet).length === 0) {
      throw new ApiException('No fields to update', 400);
    }

    const [updated] = await db
      .update(vocabThemes)
      .set(updateSet)
      .where(eq(vocabThemes.id, themeId))
      .returning();

    return { theme: updated };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const { id } = await params;
    const themeId = parseInt(id, 10);
    if (!themeId) throw new ApiException('Invalid theme id', 400);

    const existing = await db
      .select({ id: vocabThemes.id })
      .from(vocabThemes)
      .where(eq(vocabThemes.id, themeId))
      .get();
    if (!existing) throw new ApiException('Theme not found', 404);

    // ON DELETE CASCADE handles words
    await db.delete(vocabThemes).where(eq(vocabThemes.id, themeId));

    return { ok: true };
  });
}
