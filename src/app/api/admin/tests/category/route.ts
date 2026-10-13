/**
 * PATCH /api/admin/tests/category
 * Staff (admin/instructor), same tier as the per-test PATCH. Library categories.
 *   Bulk move:  { ids: number[], category: string | null }  (null / blank / "Unsorted" = Unsorted)
 *   Rename:     { fromCategory: string, toCategory: string | null }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { CATEGORY_MAX_LENGTH, normalizeCategory } from '@/lib/tests/library';

const categoryField = z.string().max(CATEGORY_MAX_LENGTH).nullable();

const bodySchema = z.union([
  z.object({
    ids: z.array(z.number().int().positive()).min(1).max(500),
    category: categoryField,
  }),
  z.object({
    fromCategory: z.string().min(1).max(CATEGORY_MAX_LENGTH),
    toCategory: categoryField,
  }),
]);

export async function PATCH(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireStaff();

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const body = parsed.data;
    const updatedAt = new Date();

    if ('ids' in body) {
      const category = normalizeCategory(body.category);
      await db.update(tests).set({ category, updatedAt }).where(inArray(tests.id, body.ids));
      return { updated: true, category };
    }

    const from = normalizeCategory(body.fromCategory);
    if (from === null) throw new ApiException('Unsorted cannot be renamed', 400);
    const category = normalizeCategory(body.toCategory);
    await db.update(tests).set({ category, updatedAt }).where(eq(tests.category, from));
    return { updated: true, category };
  }, 'admin/tests/category');
}
