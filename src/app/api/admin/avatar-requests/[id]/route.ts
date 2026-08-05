/**
 * PATCH /api/admin/avatar-requests/[id] — approve or reject a student's
 * custom avatar write-in. { status: 'approved' | 'rejected' }
 *
 * Scope note: this only flips the status column. Turning an approved
 * write-in into an actual assigned character (adding it to the catalogue,
 * linking users.avatar_character_id) is a separate manual step for staff —
 * not built here, since no artwork/catalogue entry exists for a custom name
 * yet. A 'rejected' request lets the student pick again (AvatarGate re-shows
 * the picker for a rejected — not pending/approved — custom request).
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) throw new ApiException('Invalid user id', 400);

    const body = await req.json().catch(() => ({}));
    const status = (body as { status?: unknown }).status;
    if (status !== 'approved' && status !== 'rejected') {
      throw new ApiException("status must be 'approved' or 'rejected'", 400);
    }

    const row = await db
      .select({ id: users.id, avatarCustomRequest: users.avatarCustomRequest })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!row) throw new ApiException('User not found', 404);
    if (!row.avatarCustomRequest) throw new ApiException('This user has no custom avatar request', 409);

    await db
      .update(users)
      .set({ avatarRequestStatus: status, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true };
  });
}
