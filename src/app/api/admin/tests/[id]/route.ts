/**
 * PATCH /api/admin/tests/[id]
 * Staff-only (admin/super_admin/instructor) test settings: status
 * (draft/published/archived), allowedProducts, force-publish/unpublish
 * results.
 * Body: { status?, allowedProducts?: string[] | null, publishResults?: boolean }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests, testAttempts } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { isAdminRole, isStaffRole } from '@/lib/auth/roles';

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
    if (!isStaffRole(user.role)) {
      throw new ApiException('Staff access required', 403);
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

/**
 * DELETE /api/admin/tests/[id]
 * Admin/super_admin only. Removes a mistakenly created draft/archived test with its windows,
 * sections and questions (FK cascades). Refused for published tests and any test with attempts.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    if (!isAdminRole(user.role)) throw new ApiException('Admin access required', 403);

    const id = parseInt((await params).id, 10);
    const test = await db.select().from(tests).where(eq(tests.id, id)).get();
    if (!test) throw new ApiException('Test not found', 404);
    if (test.status === 'published') {
      throw new ApiException('Move the test to draft or archived before deleting it', 409);
    }
    const attempt = await db.select({ id: testAttempts.id }).from(testAttempts)
      .where(eq(testAttempts.testId, id)).get();
    if (attempt) {
      throw new ApiException('This test has student attempts and cannot be deleted; keep it archived', 409);
    }

    await db.delete(tests).where(eq(tests.id, id));
    return { deleted: true };
  });
}
