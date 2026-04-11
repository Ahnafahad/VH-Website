/**
 * GET /api/vocab/cron/weekly-reset
 *
 * Runs every Sunday midnight UTC (configured in vercel.json).
 * 1. Saves the top-3 weekly scorers to vocabHallOfFame.
 * 2. Resets all vocabUserProgress.weeklyPoints to 0.
 *
 * Protected by CRON_SECRET header (set in Vercel environment variables).
 */

import { NextRequest, NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { db, users, vocabUserProgress, vocabHallOfFame } from '@/lib/db';
import { eq, ne } from 'drizzle-orm';
import { checkBadges } from '@/lib/vocab/badges/checker';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Validate cron secret (Vercel sets Authorization: Bearer <CRON_SECRET>)
  if (!CRON_SECRET) {
    console.error('[weekly-reset] CRON_SECRET env var is not set — refusing to run');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch top 3 active users by weekly points
    const top3 = await db
      .select({
        userId:       vocabUserProgress.userId,
        weeklyPoints: vocabUserProgress.weeklyPoints,
      })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .where(ne(users.status, 'inactive'))
      .orderBy(desc(vocabUserProgress.weeklyPoints))
      .limit(3);

    if (top3.length > 0) {
      // Only fetch names for the top 3 users, not ALL users
      const top3Ids = top3.map(t => t.userId);
      const top3Users = await db.select({ id: users.id, name: users.name }).from(users).where(sql`${users.id} IN (${sql.join(top3Ids.map(id => sql`${id}`), sql`, `)})`);
      const nameMap  = new Map(top3Users.map(u => [u.id, u.name ?? 'Anonymous']));

      const weekEnd    = new Date();
      const weekStart  = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 7);

      // Generate session label e.g. "Apr 7 – Apr 13"
      const fmt = (d: Date) =>
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const sessionLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}`;

      // Persist Hall of Fame entries
      for (let i = 0; i < top3.length; i++) {
        const entry = top3[i];
        if ((entry.weeklyPoints ?? 0) === 0) continue; // skip zero-score weeks

        await db.insert(vocabHallOfFame).values({
          userId:       entry.userId,
          displayName:  nameMap.get(entry.userId) ?? 'Anonymous',
          rank:         i + 1,
          points:       entry.weeklyPoints ?? 0,
          sessionLabel,
          weekEndDate:  weekEnd,
        });
      }
    }

    // Check leaderboard badges for the top-10 users (before resetting points).
    const top10 = await db
      .select({ userId: vocabUserProgress.userId, weeklyPoints: vocabUserProgress.weeklyPoints })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .where(ne(users.status, 'inactive'))
      .orderBy(desc(vocabUserProgress.weeklyPoints))
      .limit(10);

    for (let i = 0; i < top10.length; i++) {
      if ((top10[i].weeklyPoints ?? 0) === 0) continue; // skip zero-score weeks
      await checkBadges(top10[i].userId, 'leaderboard_weekly_reset', { weeklyRank: i + 1 })
        .catch(() => {});
    }

    // Reset all weekly points to 0
    await db
      .update(vocabUserProgress)
      .set({
        weeklyPoints: 0,
        updatedAt:    new Date(),
      });

    return NextResponse.json({
      ok:      true,
      saved:   top3.length,
      resetAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[weekly-reset]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
