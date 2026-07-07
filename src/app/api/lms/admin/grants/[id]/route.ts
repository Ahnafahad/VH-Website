/**
 * DELETE /api/lms/admin/grants/[id]
 *
 * Revoke (delete) a recording access grant.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recordingAccessGrants } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const grantId = parseInt(id, 10);
    if (isNaN(grantId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select({ id: recordingAccessGrants.id })
      .from(recordingAccessGrants)
      .where(eq(recordingAccessGrants.id, grantId))
      .get();
    if (!existing) throw new ApiException('Grant not found', 404);

    await db.delete(recordingAccessGrants).where(eq(recordingAccessGrants.id, grantId));

    return { deleted: true, id: grantId };
  });
}
