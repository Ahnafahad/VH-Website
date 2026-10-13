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
import { recordAudit } from '@/lib/audit-log';

async function requireAdmin(): Promise<number> {
  const auth = await validateAuth();
  const user = await getUserByEmail(auth.email);
  if (!user || !isAdminRole(user.role)) {
    throw new ApiException('Admin access required', 403);
  }
  return user.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const actorId = await requireAdmin();

    const { id } = await params;
    const batchId = parseInt(id, 10);
    if (isNaN(batchId)) throw new ApiException('Invalid id', 400);

    const body = await req.json();
    const { status } = body as { status?: string };
    if (status !== 'active' && status !== 'archived') {
      throw new ApiException("status must be 'active' or 'archived'", 400);
    }

    const existing = await db.select({ id: batches.id, status: batches.status }).from(batches)
      .where(eq(batches.id, batchId)).get();
    if (!existing) throw new ApiException('Batch not found', 404);

    const [updated] = await db.update(batches)
      .set({ status, updatedAt: new Date() })
      .where(eq(batches.id, batchId))
      .returning();

    recordAudit({ actorUserId: actorId, action: 'batch.status', entityType: 'batch', entityId: batchId, before: { status: existing.status }, after: { status: updated.status } }).catch(() => {});

    return { batch: updated };
  });
}
