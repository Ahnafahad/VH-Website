/**
 * GET  /api/vocab/daily-login  (called by shell layout on mount)
 * POST /api/vocab/daily-login  (legacy — kept for backwards compatibility)
 *
 * Awards +5 points once per calendar day (based on lastStudyDate).
 * Also maintains the study streak (streakDays / longestStreak).
 * Call this on first home-screen render or navigation.
 *
 * Returns: { awarded: boolean, points: number, earnedBadges: EarnedBadge[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, users, vocabUserProgress } from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { checkBadges } from '@/lib/vocab/badges/checker';
import { rateLimit } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const DAILY_LOGIN_POINTS = 5;

async function handleDailyLogin() {
  const { email } = await validateAuth();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) throw new ApiException('User not found', 404);

  const [progress] = await db
    .select({
      lastStudyDate: vocabUserProgress.lastStudyDate,
      totalPoints:   vocabUserProgress.totalPoints,
      streakDays:    vocabUserProgress.streakDays,
      longestStreak: vocabUserProgress.longestStreak,
    })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);

  if (!progress) return { awarded: false, points: 0, earnedBadges: [] };

  const now      = new Date();
  const todayStr = now.toDateString();
  const lastStr  = progress.lastStudyDate?.toDateString();

  // Already awarded today — no points, no streak change.
  if (lastStr === todayStr) {
    return { awarded: false, points: progress.totalPoints ?? 0, earnedBadges: [] };
  }

  // Compute streak: consecutive means last study was yesterday.
  const yesterday    = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const isConsecutive   = lastStr === yesterdayStr;
  const newStreakDays    = isConsecutive ? (progress.streakDays    ?? 0) + 1 : 1;
  const newLongestStreak = Math.max(progress.longestStreak ?? 0, newStreakDays);

  await db
    .update(vocabUserProgress)
    .set({
      totalPoints:   sql`total_points  + ${DAILY_LOGIN_POINTS}`,
      weeklyPoints:  sql`weekly_points + ${DAILY_LOGIN_POINTS}`,
      streakDays:    newStreakDays,
      longestStreak: newLongestStreak,
      lastStudyDate: now,
      updatedAt:     now,
    })
    .where(eq(vocabUserProgress.userId, user.id));

  // Check streak-related badges; never fail the main response.
  const earnedBadges = await checkBadges(user.id, 'streak_update', {
    streakDays:    newStreakDays,
    longestStreak: newLongestStreak,
  }).catch(() => []);

  return {
    awarded:      true,
    points:       (progress.totalPoints ?? 0) + DAILY_LOGIN_POINTS,
    earnedBadges,
  };
}

export async function GET(req: NextRequest) {
  // Rate limit: 5 calls per hour per user (prevents repeated +5 point claims)
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    if (!rateLimit(`${session.user.email}:daily_login`, 5, 60 * 60_000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
  }
  return safeApiHandler(handleDailyLogin);
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 calls per hour per user (prevents repeated +5 point claims)
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    if (!rateLimit(`${session.user.email}:daily_login`, 5, 60 * 60_000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
  }
  return safeApiHandler(handleDailyLogin);
}
