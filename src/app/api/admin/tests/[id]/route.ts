/**
 * PATCH /api/admin/tests/[id]
 * Admin-only test settings: status (draft/published/archived), allowedProducts,
 * force-publish/unpublish results.
 * Body: { status?, allowedProducts?: string[] | null, publishResults?: boolean }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';

const bodySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  allowedProducts: z.array(z.string()).nullable().optional(),
  publishResults: z.boolean().optional(),
  syllabus: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new ApiException('Admin access required', 403);
    }

    const id = parseInt((await params).id, 10);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const { status, allowedProducts, publishResults, syllabus } = parsed.data;

    const test = await db.select().from(tests).where(eq(tests.id, id)).get();
    if (!test) throw new ApiException('Test not found', 404);

    await db.update(tests).set({
      ...(status !== undefined ? { status } : {}),
      ...(allowedProducts !== undefined
        ? { allowedProducts: allowedProducts === null ? null : JSON.stringify(allowedProducts) }
        : {}),
      ...(publishResults !== undefined
        ? { resultsPublishedAt: publishResults ? new Date() : null }
        : {}),
      ...(syllabus !== undefined ? { syllabus } : {}),
      updatedAt: new Date(),
    }).where(eq(tests.id, id));

    return { updated: true };
  });
}
