/**
 * GET /api/avatars/characters — the catalogue for the picker modal, with a
 * live `taken` flag per character. Polled by the modal while it's open so
 * newly-claimed characters grey out (booking-system feel; the real guarantee
 * is the DB unique index, checked in /api/avatars/claim).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { avatarCharacters, users } from '@/lib/db/schema';
import { safeApiHandler, validateAuth } from '@/lib/api-utils';

export async function GET() {
  return safeApiHandler(async () => {
    await validateAuth();

    const rows = await db
      .select({
        id:            avatarCharacters.id,
        name:          avatarCharacters.name,
        gender:        avatarCharacters.gender,
        source:        avatarCharacters.source,
        origin:        avatarCharacters.origin,
        takenByUserId: users.id,
      })
      .from(avatarCharacters)
      .leftJoin(users, eq(users.avatarCharacterId, avatarCharacters.id))
      .where(eq(avatarCharacters.status, 'available'))
      .orderBy(avatarCharacters.gender, avatarCharacters.name);

    return {
      characters: rows.map(r => ({
        id:     r.id,
        name:   r.name,
        gender: r.gender,
        source: r.source,
        origin: r.origin,
        taken:  r.takenByUserId != null,
      })),
    };
  });
}
