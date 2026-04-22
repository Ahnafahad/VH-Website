import { eq, sql } from 'drizzle-orm';
import { db, vocabUserProgress } from '@/lib/db';

export const DAILY_LOGIN_POINTS = 5;

// Runner accepts either the top-level `db` or a drizzle transaction (`tx`).
// Both share the select/update surface we use here, but differ at type level
// (tx lacks `.batch`). Keep this as a structural subset so callers can pass
// either without an unsafe cast.
type DBOrTx = Pick<typeof db, 'select' | 'update'>;

export interface DailyLoginResult {
  awarded:       boolean;
  streakDays:    number;
  longestStreak: number;
  totalPointsAfter: number;
}

/**
 * Idempotent per calendar day. Call from /daily-login and any rating endpoint
 * that touches the day's "I studied today" semantics. Owns the `lastStudyDate`
 * column — callers must not write it independently.
 */
export async function ensureDailyLoginAwarded(
  userId: number,
  now: Date = new Date(),
  runner: DBOrTx = db,
): Promise<DailyLoginResult> {
  const [progress] = await runner
    .select({
      lastStudyDate: vocabUserProgress.lastStudyDate,
      totalPoints:   vocabUserProgress.totalPoints,
      streakDays:    vocabUserProgress.streakDays,
      longestStreak: vocabUserProgress.longestStreak,
    })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, userId))
    .limit(1);

  if (!progress) {
    return { awarded: false, streakDays: 0, longestStreak: 0, totalPointsAfter: 0 };
  }

  const todayStr = now.toDateString();
  const lastStr  = progress.lastStudyDate?.toDateString();
  if (lastStr === todayStr) {
    return {
      awarded:          false,
      streakDays:       progress.streakDays    ?? 0,
      longestStreak:    progress.longestStreak ?? 0,
      totalPointsAfter: progress.totalPoints   ?? 0,
    };
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isConsecutive = lastStr === yesterday.toDateString();
  const streakDays    = isConsecutive ? (progress.streakDays ?? 0) + 1 : 1;
  const longestStreak = Math.max(progress.longestStreak ?? 0, streakDays);

  await runner
    .update(vocabUserProgress)
    .set({
      totalPoints:   sql`total_points  + ${DAILY_LOGIN_POINTS}`,
      weeklyPoints:  sql`weekly_points + ${DAILY_LOGIN_POINTS}`,
      streakDays,
      longestStreak,
      lastStudyDate: now,
      updatedAt:     now,
    })
    .where(eq(vocabUserProgress.userId, userId));

  return {
    awarded:          true,
    streakDays,
    longestStreak,
    totalPointsAfter: (progress.totalPoints ?? 0) + DAILY_LOGIN_POINTS,
  };
}
