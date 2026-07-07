/**
 * DELETE /api/lms/admin/google
 * Disconnect the host Google account (delete the credentials row).
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { db } from '@/lib/db';
import { googleCredentials } from '@/lib/db/schema';

export async function DELETE() {
  return safeApiHandler(async () => {
    await requireStaff();

    await db.delete(googleCredentials);

    return { disconnected: true };
  });
}
