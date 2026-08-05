/**
 * POST /api/avatars/claim — a student's one-time, permanent avatar pick.
 * { characterId: number }
 *
 * Delegates the actual write to claimAvatarCharacter (src/lib/avatars/claim.ts),
 * which turns the DB's UNIQUE INDEX on users.avatar_character_id into a clear
 * 409 instead of a 500 when two students race for the same character.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { claimAvatarCharacter } from '@/lib/avatars/claim';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const auth = await validateAuth();
    const user = await getUserByEmail(auth.email);
    if (!user) throw new ApiException('User not found', 404);
    if (user.role !== 'student') throw new ApiException('Student access required', 403);

    const body = await req.json().catch(() => ({}));
    const characterId = Number((body as { characterId?: unknown }).characterId);
    if (!Number.isInteger(characterId)) {
      throw new ApiException('characterId is required', 400);
    }

    const result = await claimAvatarCharacter(db, user.id, characterId);
    if (!result.ok) {
      if (result.reason === 'not_found') {
        throw new ApiException('Character not found', 404, 'AVATAR_NOT_FOUND');
      }
      if (result.reason === 'already_has') {
        throw new ApiException('You already picked a character — it cannot be changed', 409, 'AVATAR_ALREADY_HAS');
      }
      throw new ApiException('That character was just taken — pick another', 409, 'AVATAR_TAKEN');
    }

    return { success: true };
  });
}
