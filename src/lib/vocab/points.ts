/**
 * awardPoints — the single write path for LexiCore point grants.
 *
 * `vocab_user_progress.total_points` / `.weekly_points` are incremented from
 * several places (quiz answers, flashcard + practice ratings, Word Hunt,
 * Word Charge). Each used to hand-write the same UPDATE, in two different SQL
 * spellings. This is that statement, once.
 *
 * Accepts either the root `db` or an open transaction, so callers inside a
 * transaction keep their atomicity guarantees.
 */

import { sql, eq } from 'drizzle-orm';
import { db, vocabUserProgress } from '@/lib/db';

/** Structural type satisfied by both the root `db` handle and a Drizzle tx. */
type DbOrTx = Pick<typeof db, 'update'>;

/**
 * Adds `points` to the user's total and weekly point counters.
 *
 * No-ops when `points <= 0`, matching every call site's existing
 * `if (pointsEarned > 0)` guard.
 *
 * Note: this does NOT create a missing vocab_user_progress row — like the code
 * it replaces, it only updates an existing one.
 */
export async function awardPoints(
  client: DbOrTx,
  userId: number,
  points: number,
  now: Date,
): Promise<void> {
  if (points <= 0) return;

  await client
    .update(vocabUserProgress)
    .set({
      totalPoints:  sql`${vocabUserProgress.totalPoints}  + ${points}`,
      weeklyPoints: sql`${vocabUserProgress.weeklyPoints} + ${points}`,
      updatedAt:    now,
    })
    .where(eq(vocabUserProgress.userId, userId));
}
