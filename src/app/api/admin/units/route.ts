/**
 * GET  /api/admin/units  — list all units (ordered)
 * POST /api/admin/units  — create a new unit
 *
 * Admin only.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { asc, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db, vocabUnits, vocabThemes } from '@/lib/db';
import { safeApiHandler, ApiException } from '@/lib/api-utils';

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

export async function GET() {
  return safeApiHandler(async () => {
    await requireAdmin();

    const units = await db
      .select()
      .from(vocabUnits)
      .orderBy(asc(vocabUnits.order), asc(vocabUnits.id));

    // Attach theme count to each unit
    const themes = await db
      .select()
      .from(vocabThemes)
      .orderBy(asc(vocabThemes.order), asc(vocabThemes.id));

    const themesByUnit = new Map<number, typeof themes>();
    for (const t of themes) {
      if (!themesByUnit.has(t.unitId)) themesByUnit.set(t.unitId, []);
      themesByUnit.get(t.unitId)!.push(t);
    }

    return units.map(u => ({
      ...u,
      themes:     themesByUnit.get(u.id) ?? [],
      themeCount: (themesByUnit.get(u.id) ?? []).length,
    }));
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const body = await req.json();
    const { name, description } = body as { name?: string; description?: string };

    if (!name?.trim()) throw new ApiException('name is required', 400);

    // Determine next order value
    const existing = await db
      .select({ order: vocabUnits.order })
      .from(vocabUnits)
      .orderBy(asc(vocabUnits.order));
    const maxOrder = existing.length ? Math.max(...existing.map(r => r.order)) : -1;

    const [unit] = await db
      .insert(vocabUnits)
      .values({
        name:        name.trim(),
        description: description?.trim() || null,
        order:       maxOrder + 1,
      })
      .returning();

    return { unit };
  });
}
