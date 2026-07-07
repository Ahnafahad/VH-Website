/**
 * GET|POST /api/cron/recordings-cleanup
 *
 * Daily cron (01:00 UTC) — expires recordings whose expiry window has passed
 * AND no active access grant exists (for any user or batch).
 *
 * ?dryRun=1  → return would-delete list, no action taken.
 *
 * Protected by CRON_SECRET exactly like /api/cron/check-streaks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recordings, classSessions, recordingAccessGrants } from '@/lib/db/schema';
import { countSubsequentCompletedClasses } from '@/lib/lms/recording-expiry-db';
import { isRecordingWatchable } from '@/lib/lms/recording-expiry';
import { r2Delete } from '@/lib/storage/r2';

const CRON_SECRET = process.env.CRON_SECRET;

async function handler(req: NextRequest) {
  // Validate cron secret
  if (!CRON_SECRET) {
    console.error('[recordings-cleanup] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  try {
    // Load all available recordings with their sessions
    const rows = await db
      .select({ rec: recordings, session: classSessions })
      .from(recordings)
      .innerJoin(classSessions, eq(recordings.classSessionId, classSessions.id))
      .where(eq(recordings.status, 'available'));

    const now = new Date();
    const toExpire: Array<{ id: number; r2Key: string; sessionTitle: string }> = [];
    const kept: Array<{ id: number; reason: string }> = [];

    for (const { rec, session } of rows) {
      const subsequentCompletedCount = await countSubsequentCompletedClasses(session);

      // Check for any active grant (user-specific OR batch-wide) for this recording
      const anyActiveGrant = await db
        .select({ id: recordingAccessGrants.id })
        .from(recordingAccessGrants)
        .where(
          and(
            eq(recordingAccessGrants.recordingId, rec.id),
            gt(recordingAccessGrants.expiresAt, now),
          ),
        )
        .limit(1)
        .get();

      const activeGrantExists = !!anyActiveGrant;

      // Algorithm A evaluated as if a non-staff student is requesting
      const { watchable, reason } = isRecordingWatchable({
        recordingStatus: rec.status,
        subsequentCompletedCount,
        activeGrantExists,
        isStaff: false,
      });

      if (!watchable && reason === 'expired_window') {
        toExpire.push({ id: rec.id, r2Key: rec.r2Key, sessionTitle: session.title });
      } else {
        kept.push({ id: rec.id, reason: watchable ? 'within_window_or_granted' : reason });
      }
    }

    if (dryRun) {
      console.log(
        `[recordings-cleanup] DRY RUN — would expire ${toExpire.length}, keep ${kept.length}`,
      );
      return NextResponse.json({
        dryRun: true,
        wouldExpire: toExpire.map((r) => ({ id: r.id, sessionTitle: r.sessionTitle, r2Key: r.r2Key })),
        wouldKeep: kept,
      });
    }

    // Execute deletions
    let expiredCount = 0;
    let errorCount = 0;

    for (const { id, r2Key, sessionTitle } of toExpire) {
      try {
        await r2Delete(r2Key);
        await db
          .update(recordings)
          .set({ status: 'expired' })
          .where(eq(recordings.id, id));
        console.log(`[recordings-cleanup] Expired recording ${id} (${sessionTitle})`);
        expiredCount++;
      } catch (err) {
        console.error(`[recordings-cleanup] Failed to expire recording ${id}:`, err);
        errorCount++;
      }
    }

    console.log(
      `[recordings-cleanup] Done — expired: ${expiredCount}, errors: ${errorCount}, kept: ${kept.length}`,
    );

    return NextResponse.json({ expired: expiredCount, errors: errorCount, kept: kept.length });
  } catch (err) {
    console.error('[recordings-cleanup]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const GET  = handler;
export const POST = handler;
