/**
 * POST /api/vocab/admin/ultimate-toggle
 *
 * Toggles the `ultimate_achievements_visible` admin setting.
 * When enabling (enable: true):
 *   1. Upserts the setting to 'true'.
 *   2. Retroactively runs badge checks for all active vocab users so that
 *      any user who already qualifies receives their ultimate badge immediately.
 *
 * When disabling (enable: false):
 *   Upserts the setting to 'false'. Already-awarded ultimate badges are kept.
 *
 * Returns: { visible, usersChecked, badgesAwarded } on enable,
 *          { visible } on disable.
 *
 * Admin only.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, vocabAdminSettings, vocabUserProgress } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { checkBadges } from '@/lib/vocab/badges/checker';

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

const bodySchema = z.object({ enable: z.boolean() });

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body: { enable: boolean }', 400);

    const { enable } = parsed.data;
    const now        = new Date();

    // Upsert the toggle setting
    await db
      .insert(vocabAdminSettings)
      .values({ key: 'ultimate_achievements_visible', value: String(enable), updatedAt: now })
      .onConflictDoUpdate({
        target: vocabAdminSettings.key,
        set:    { value: String(enable), updatedAt: now },
      });

    if (!enable) {
      return { visible: false };
    }

    // ── Retroactive batch check ─────────────────────────────────────────────
    // Load all active users who have a vocab progress row.
    // We join via vocabUserProgress (inner join ensures only users who have
    // interacted with the vocab module are checked).

    const activeProgress = await db
      .select({
        userId:        vocabUserProgress.userId,
        streakDays:    vocabUserProgress.streakDays,
        longestStreak: vocabUserProgress.longestStreak,
      })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .where(ne(users.status, 'inactive'));

    let usersChecked  = 0;
    let badgesAwarded = 0;

    for (const progress of activeProgress) {
      usersChecked++;

      // quiz_complete covers: question_machine, flawless_run, word_sovereign
      const quizBadges = await checkBadges(
        progress.userId,
        'quiz_complete',
        {},
      ).catch(() => []);
      badgesAwarded += quizBadges.length;

      // streak_update covers: immortal
      const streakBadges = await checkBadges(
        progress.userId,
        'streak_update',
        {
          streakDays:    progress.streakDays    ?? 0,
          longestStreak: progress.longestStreak ?? 0,
        },
      ).catch(() => []);
      badgesAwarded += streakBadges.length;
    }

    return { visible: true, usersChecked, badgesAwarded };
  });
}
