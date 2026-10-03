/**
 * GET|POST /api/cron/recordings-cleanup
 *
 * Daily cron (01:00 UTC) — reports which recordings are past their student
 * watch window (for visibility/telemetry only). Never deletes the underlying
 * R2 file or touches recording status: instructors must be able to watch any
 * recording at any time, and isRecordingWatchable() already grants staff
 * access "regardless of status" — deleting the file would silently break
 * that guarantee. Student-side expiry is enforced live by isRecordingWatchable()
 * at watch time, independent of whether the file still exists.
 *
 * ?dryRun=1  → same report (kept for backwards-compatible callers).
 *
 * Protected by CRON_SECRET exactly like /api/cron/check-streaks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recordings, classSessions, recordingAccessGrants } from '@/lib/db/schema';
import { countSubsequentCompletedClasses } from '@/lib/lms/recording-expiry-db';
import { isRecordingWatchable } from '@/lib/lms/recording-expiry';

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

    console.log(
      `[recordings-cleanup] Report — past student window: ${toExpire.length}, kept: ${kept.length}`,
    );
    return NextResponse.json({
      pastStudentWindow: toExpire.map((r) => ({ id: r.id, sessionTitle: r.sessionTitle, r2Key: r.r2Key })),
      kept,
    });
  } catch (err) {
    console.error('[recordings-cleanup]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const GET  = handler;
export const POST = handler;
