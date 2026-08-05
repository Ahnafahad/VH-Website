/**
 * claimAvatarCharacter — the one place a student's permanent avatar choice
 * is written. Exclusivity is enforced by the DB (a UNIQUE INDEX on
 * users.avatar_character_id), not by application logic — this function's job
 * is to turn that DB-level rejection into a clear result instead of a crash.
 *
 * Three outcomes, never a thrown exception for the expected races:
 *   - not_found:   characterId doesn't exist in the catalogue
 *   - already_has: the calling user already holds a character (one-time choice)
 *   - taken:       someone else claimed this exact character first (the race)
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { users, avatarCharacters } from '@/lib/db/schema';

type DrizzleClient = LibSQLDatabase<typeof schema>;

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'already_has' | 'taken' };

/** True when `err` (or a nested cause) looks like a UNIQUE constraint violation. */
function isUniqueConstraintViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; depth < 4 && e; depth++) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE constraint failed/i.test(msg)) return true;
    e = e instanceof Error ? (e as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export async function claimAvatarCharacter(
  db: DrizzleClient,
  userId: number,
  characterId: number,
): Promise<ClaimResult> {
  const character = await db
    .select({ id: avatarCharacters.id })
    .from(avatarCharacters)
    .where(eq(avatarCharacters.id, characterId))
    .get();
  if (!character) return { ok: false, reason: 'not_found' };

  try {
    // Atomic claim: only writes if this user doesn't already hold a character.
    const result = await db
      .update(users)
      .set({ avatarCharacterId: characterId, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.avatarCharacterId)));

    const affected = (result as unknown as { rowsAffected: number }).rowsAffected ?? 0;
    if (affected === 0) return { ok: false, reason: 'already_has' };
    return { ok: true };
  } catch (err) {
    // The UNIQUE INDEX on avatar_character_id rejects this write if another
    // user claimed the same character first — that's the real race guard.
    if (isUniqueConstraintViolation(err)) return { ok: false, reason: 'taken' };
    throw err;
  }
}
