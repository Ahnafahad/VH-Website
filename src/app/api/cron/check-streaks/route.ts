/**
 * GET /api/cron/check-streaks
 *
 * Runs daily at midnight UTC (configured in vercel.json).
 * Finds users whose streaks have been broken (lastStudyDate is not
 * today or yesterday), resets their streakDays to 0, and sends a
 * streak-lost notification email.
 *
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gt, lt, ne } from 'drizzle-orm';
import { db, users, vocabUserProgress } from '@/lib/db';
import { sendStreakLost } from '@/lib/email';

const CRON_SECRET = process.env.CRON_SECRET;

/** Returns the start of today in UTC (midnight). */
function getTodayStartUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Returns the start of yesterday in UTC (midnight). */
function getYesterdayStartUTC(): Date {
  const todayStart = getTodayStartUTC();
  return new Date(todayStart.getTime() - 86_400_000);
}

export async function GET(req: NextRequest) {
  // Validate cron secret
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const todayStart     = getTodayStartUTC();
    const yesterdayStart = getYesterdayStartUTC();

    // Find users with an active streak whose lastStudyDate predates yesterday
    // (i.e., they haven't studied today or yesterday — streak is broken).
    // lastStudyDate < yesterdayStart means the last study was before yesterday's midnight.
    const brokenStreakRows = await db
      .select({
        userId:        vocabUserProgress.userId,
        streakDays:    vocabUserProgress.streakDays,
        lastStudyDate: vocabUserProgress.lastStudyDate,
        email:         users.email,
        name:          users.name,
        emailSummaryEnabled: vocabUserProgress.emailSummaryEnabled,
      })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .where(
        and(
          gt(vocabUserProgress.streakDays, 0),           // had a streak
          lt(vocabUserProgress.lastStudyDate, yesterdayStart), // last study before yesterday
          ne(users.status, 'inactive'),
        )
      );

    if (brokenStreakRows.length === 0) {
      return NextResponse.json({ streaksReset: 0, emailsSent: 0 });
    }

    let streaksReset = 0;
    let emailsSent   = 0;

    // Process each user: reset streak + send email
    const results = await Promise.allSettled(
      brokenStreakRows.map(async (row) => {
        const previousStreakDays = row.streakDays ?? 0;

        // Reset streak in DB
        await db
          .update(vocabUserProgress)
          .set({
            streakDays: 0,
            updatedAt:  new Date(),
          })
          .where(eq(vocabUserProgress.userId, row.userId));

        streaksReset++;

        // Only send email if the user has email notifications enabled
        // (emailSummaryEnabled is the opt-in flag for LexiCore emails).
        if (row.emailSummaryEnabled) {
          const result = await sendStreakLost(row.email, {
            name:       row.name ?? 'there',
            streakDays: previousStreakDays,
          });
          if (result.success > 0) emailsSent++;
        }
      })
    );

    // Log any unexpected errors
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(
        '[check-streaks] Errors during processing:',
        failures.map(r => (r as PromiseRejectedResult).reason),
      );
    }

    console.log(`[check-streaks] Streaks reset: ${streaksReset}, Emails sent: ${emailsSent}`);

    return NextResponse.json({ streaksReset, emailsSent });
  } catch (err) {
    console.error('[check-streaks]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
