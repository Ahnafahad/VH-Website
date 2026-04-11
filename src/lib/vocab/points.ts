/**
 * Points utility — all point awards go through here.
 * Keeps award logic server-side and in one place.
 */

import { db, vocabUserProgress } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

/**
 * Adds `amount` to a user's total_points and weekly_points.
 * Silent no-op if amount <= 0 or no progress row exists yet.
 */
export async function awardPoints(userId: number, amount: number): Promise<void> {
  if (amount <= 0) return;
  await db
    .update(vocabUserProgress)
    .set({
      totalPoints:  sql`total_points  + ${amount}`,
      weeklyPoints: sql`weekly_points + ${amount}`,
      updatedAt:    new Date(),
    })
    .where(eq(vocabUserProgress.userId, userId));
}
