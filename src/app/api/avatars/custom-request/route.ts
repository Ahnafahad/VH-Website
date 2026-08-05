/**
 * POST /api/avatars/custom-request — a student's write-in when none of the
 * catalogue characters appeal. Not guaranteed: sets avatarRequestStatus to
 * 'pending' for staff review (src/app/admin/avatars). One per student — a
 * student who already holds a character has nothing left to request.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';

const MAX_LEN = 200;

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const auth = await validateAuth();
    const user = await getUserByEmail(auth.email);
    if (!user) throw new ApiException('User not found', 404);
    if (user.role !== 'student') throw new ApiException('Student access required', 403);
    if (user.avatarCharacterId) {
      throw new ApiException('You already have a character', 409, 'AVATAR_ALREADY_HAS');
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof (body as { request?: unknown }).request === 'string'
      ? (body as { request: string }).request.trim()
      : '';
    if (!text) throw new ApiException('Enter a character name', 400);
    if (text.length > MAX_LEN) throw new ApiException(`Keep it under ${MAX_LEN} characters`, 400);

    await db
      .update(users)
      .set({
        avatarCustomRequest: text,
        avatarRequestStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { success: true };
  });
}
