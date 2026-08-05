/**
 * PATCH /api/admin/batches/[id] — set status { status: 'active' | 'archived' }
 *
 * Super-admin/admin only.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { batches } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { isAdminRole } from '@/lib/auth/roles';

async function requireAdmin(): Promise<void> {
  const auth = await validateAuth();
  const user = await getUserByEmail(auth.email);
  if (!user || !isAdminRole(user.role)) {
    throw new ApiException('Admin access required', 403);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const { id } = await params;
    const batchId = parseInt(id, 10);
    if (isNaN(batchId)) throw new ApiException('Invalid id', 400);

    const body = await req.json();
    const { status } = body as { status?: string };
    if (status !== 'active' && status !== 'archived') {
      throw new ApiException("status must be 'active' or 'archived'", 400);
    }

    const existing = await db.select({ id: batches.id }).from(batches)
      .where(eq(batches.id, batchId)).get();
    if (!existing) throw new ApiException('Batch not found', 404);

    const [updated] = await db.update(batches)
      .set({ status, updatedAt: new Date() })
      .where(eq(batches.id, batchId))
      .returning();

    return { batch: updated };
  });
}
