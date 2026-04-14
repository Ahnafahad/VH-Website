/**
 * GET /api/cron/weekly-summary
 *
 * Runs every Sunday at 6am UTC (configured in vercel.json).
 * Sends a weekly summary email to every LexiCore user who has
 * emailSummaryEnabled = true.
 *
 * Protected by CRON_SECRET header.
 * Processes up to 10 users concurrently to avoid Resend rate limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, gte, and, ne, desc } from 'drizzle-orm';
import { db, users, vocabUserProgress, vocabUserWordRecords, vocabWeeklyLeaderboard } from '@/lib/db';
import { sendWeeklySummary } from '@/lib/email';

const CRON_SECRET = process.env.CRON_SECRET;

/** Returns midnight (00:00:00.000) of the most recent Sunday in UTC. */
function getWeekStartUTC(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  return weekStart;
}

/** Format a Date as "Apr 6" style. */
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Process an array in batches of batchSize, using Promise.allSettled. */
async function batchSettled<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.allSettled(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

export async function GET(req: NextRequest) {
  // Validate cron secret
  if (!CRON_SECRET) {
    console.error('[weekly-summary] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const weekStart = getWeekStartUTC();
    const weekOf = `${fmtDate(weekStart)} – ${fmtDate(new Date())}`;

    // Fetch all users with emailSummaryEnabled = true, joined with users table for email + name
    const eligibleRows = await db
      .select({
        userId:       vocabUserProgress.userId,
        streakDays:   vocabUserProgress.streakDays,
        weeklyPoints: vocabUserProgress.weeklyPoints,
        email:        users.email,
        name:         users.name,
      })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .where(
        and(
          eq(vocabUserProgress.emailSummaryEnabled, true),
          ne(users.status, 'inactive'),
        )
      );

    if (eligibleRows.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, total: 0 });
    }

    // Fetch this week's leaderboard to compute ranks.
    // vocabWeeklyLeaderboard stores points per (userId, weekStart).
    const leaderboardRows = await db
      .select({
        userId: vocabWeeklyLeaderboard.userId,
        points: vocabWeeklyLeaderboard.points,
      })
      .from(vocabWeeklyLeaderboard)
      .where(eq(vocabWeeklyLeaderboard.weekStart, weekStart))
      .orderBy(desc(vocabWeeklyLeaderboard.points));

    // Build rank map: userId → rank (1-based)
    const rankMap = new Map<number, number>();
    leaderboardRows.forEach((row, idx) => {
      rankMap.set(row.userId, idx + 1);
    });

    // Fetch words-reviewed-this-week counts.
    // Count vocabUserWordRecords rows where lastInteractionAt >= weekStart for eligible userIds.
    const eligibleUserIds = eligibleRows.map(r => r.userId);

    // Query all word records interacted with this week for eligible users.
    // We'll group in JS to avoid complex SQL (small dataset expected).
    const recentWordRecords = await db
      .select({
        userId:            vocabUserWordRecords.userId,
        lastInteractionAt: vocabUserWordRecords.lastInteractionAt,
      })
      .from(vocabUserWordRecords)
      .where(
        and(
          gte(vocabUserWordRecords.lastInteractionAt, weekStart),
          // Filter to eligible users only — Drizzle doesn't have inArray in the imports here,
          // so we fetch all records since weekStart and filter in JS.
        )
      );

    // Count per userId (already filtered to weekStart)
    const wordsReviewedMap = new Map<number, number>();
    for (const record of recentWordRecords) {
      if (!eligibleUserIds.includes(record.userId)) continue;
      wordsReviewedMap.set(record.userId, (wordsReviewedMap.get(record.userId) ?? 0) + 1);
    }

    // Send emails
    const results = await batchSettled(eligibleRows, 10, async (row) => {
      const wordsReviewed   = wordsReviewedMap.get(row.userId) ?? 0;
      const pointsEarned    = row.weeklyPoints ?? 0;
      const leaderboardRank = rankMap.get(row.userId) ?? null;
      const streakDays      = row.streakDays ?? 0;

      await sendWeeklySummary(row.email, {
        name: row.name ?? 'there',
        wordsReviewed,
        pointsEarned,
        leaderboardRank,
        streakDays,
        weekOf,
      });
    });

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      console.error(
        '[weekly-summary] Failed sends:',
        results
          .filter(r => r.status === 'rejected')
          .map(r => (r as PromiseRejectedResult).reason),
      );
    }

    console.log(`[weekly-summary] Sent: ${sent}, Failed: ${failed}, Total: ${eligibleRows.length}`);

    return NextResponse.json({ sent, failed, total: eligibleRows.length });
  } catch (err) {
    console.error('[weekly-summary]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
