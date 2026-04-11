/**
 * GET  /api/admin/themes?unitId=N  — list themes for a unit
 * POST /api/admin/themes            — create a new theme
 *
 * Admin only.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { asc, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db, vocabThemes, vocabUnits } from '@/lib/db';
import { safeApiHandler, ApiException } from '@/lib/api-utils';

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const unitIdParam = searchParams.get('unitId');

    if (!unitIdParam) {
      // Return all themes
      const themes = await db
        .select()
        .from(vocabThemes)
        .orderBy(asc(vocabThemes.unitId), asc(vocabThemes.order), asc(vocabThemes.id));
      return { themes };
    }

    const unitId = parseInt(unitIdParam, 10);
    if (!unitId) throw new ApiException('Invalid unitId', 400);

    const themes = await db
      .select()
      .from(vocabThemes)
      .where(eq(vocabThemes.unitId, unitId))
      .orderBy(asc(vocabThemes.order), asc(vocabThemes.id));

    return { themes };
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const body = await req.json();
    const { name, unitId } = body as { name?: string; unitId?: number };

    if (!name?.trim())  throw new ApiException('name is required', 400);
    if (!unitId)        throw new ApiException('unitId is required', 400);

    // Verify unit exists
    const unit = await db
      .select({ id: vocabUnits.id })
      .from(vocabUnits)
      .where(eq(vocabUnits.id, unitId))
      .get();
    if (!unit) throw new ApiException('Unit not found', 404);

    // Determine next order for this unit
    const existing = await db
      .select({ order: vocabThemes.order })
      .from(vocabThemes)
      .where(eq(vocabThemes.unitId, unitId))
      .orderBy(asc(vocabThemes.order));
    const maxOrder = existing.length ? Math.max(...existing.map(r => r.order)) : -1;

    const [theme] = await db
      .insert(vocabThemes)
      .values({
        name:   name.trim(),
        unitId,
        order:  maxOrder + 1,
      })
      .returning();

    return { theme };
  });
}
