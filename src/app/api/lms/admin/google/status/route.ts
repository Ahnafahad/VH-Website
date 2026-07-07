/**
 * GET /api/lms/admin/google/status
 * Returns { connected, email?, expiresAt? } for the host Google account.
 */

import { db } from '@/lib/db';
import { googleCredentials, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { desc } from 'drizzle-orm';

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();

    const rows = await db
      .select({
        id:        googleCredentials.id,
        userId:    googleCredentials.userId,
        expiresAt: googleCredentials.expiresAt,
      })
      .from(googleCredentials)
      .orderBy(desc(googleCredentials.updatedAt))
      .limit(1);

    if (rows.length === 0) {
      return { connected: false };
    }

    const cred = rows[0];

    // Get the host user email
    const user = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, cred.userId))
      .get();

    return {
      connected: true,
      email:     user?.email ?? null,
      expiresAt: cred.expiresAt.getTime(),
    };
  });
}
