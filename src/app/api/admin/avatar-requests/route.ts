/**
 * GET /api/admin/avatar-requests — lists students with a custom avatar
 * write-in. Query: ?status=pending|approved|rejected (default: pending).
 * Staff (admin/super_admin/instructor), matching /api/admin/errors' gate.
 */

import { NextRequest } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { isStaffRole } from '@/lib/auth/roles';

async function requireStaff(): Promise<void> {
  const auth = await validateAuth();
  const user = await getUserByEmail(auth.email);
  if (!user || !isStaffRole(user.role)) {
    throw new ApiException('Staff access required', 403);
  }
}

const VALID_STATUSES = ['pending', 'approved', 'rejected'] as const;

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireStaff();

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') ?? 'pending';
    const status = (VALID_STATUSES as readonly string[]).includes(statusParam) ? statusParam : 'pending';

    const rows = await db
      .select({
        id:          users.id,
        name:        users.name,
        email:       users.email,
        request:     users.avatarCustomRequest,
        status:      users.avatarRequestStatus,
        updatedAt:   users.updatedAt,
      })
      .from(users)
      .where(and(isNotNull(users.avatarCustomRequest), eq(users.avatarRequestStatus, status)))
      .orderBy(desc(users.updatedAt));

    return { requests: rows, count: rows.length };
  });
}
