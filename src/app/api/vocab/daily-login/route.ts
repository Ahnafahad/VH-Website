/**
 * GET  /api/vocab/daily-login  (called by shell layout on mount)
 * POST /api/vocab/daily-login  (legacy — kept for backwards compatibility)
 *
 * Awards +5 points once per calendar day via the shared ensureDailyLoginAwarded
 * helper, which also maintains streakDays / longestStreak. Same helper is
 * called from the vocab rating endpoints, so the first study interaction of
 * any kind on a given day awards the bonus exactly once.
 *
 * Returns: { awarded: boolean, points: number, earnedBadges: EarnedBadge[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { db, users } from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { checkBadges } from '@/lib/vocab/badges/checker';
import { rateLimit } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { VocabCacheTag } from '@/lib/vocab/cache-keys';
import { ensureDailyLoginAwarded } from '@/lib/vocab/daily-login';

async function handleDailyLogin() {
  const { email } = await validateAuth();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) throw new ApiException('User not found', 404);

  const result = await ensureDailyLoginAwarded(user.id, new Date());

  if (!result.awarded) {
    return { awarded: false, points: result.totalPointsAfter, earnedBadges: [] };
  }

  const earnedBadges = await checkBadges(user.id, 'streak_update', {
    streakDays:    result.streakDays,
    longestStreak: result.longestStreak,
  }).catch(() => []);

  revalidateTag(VocabCacheTag.home(email));

  return {
    awarded:      true,
    points:       result.totalPointsAfter,
    earnedBadges,
  };
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    if (!rateLimit(`${session.user.email}:daily_login`, 5, 60 * 60_000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
  }
  return safeApiHandler(handleDailyLogin);
}

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    if (!rateLimit(`${session.user.email}:daily_login`, 5, 60 * 60_000)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
  }
  return safeApiHandler(handleDailyLogin);
}
