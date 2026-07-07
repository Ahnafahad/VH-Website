/**
 * POST /api/lms/recordings/[id]/progress
 *
 * Heartbeat upsert from the player every 30 s (and on pause/unmount).
 * Body: { positionSeconds: number; secondsWatchedDelta: number }
 */

import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  recordings,
  classSessions,
  recordingWatchProgress,
} from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const recordingId = parseInt(id, 10);
    if (isNaN(recordingId)) throw new ApiException('Invalid id', 400);

    const body = await req.json() as {
      positionSeconds?: unknown;
      secondsWatchedDelta?: unknown;
    };

    const positionSeconds = typeof body.positionSeconds === 'number'
      ? Math.max(0, Math.floor(body.positionSeconds))
      : null;
    const delta = typeof body.secondsWatchedDelta === 'number'
      ? Math.min(Math.max(body.secondsWatchedDelta, 0), 120) // clamp 0-120
      : 0;

    if (positionSeconds === null) {
      throw new ApiException('positionSeconds is required and must be a number', 400);
    }

    // Load recording + session for scope check
    const row = await db
      .select({ rec: recordings, session: classSessions })
      .from(recordings)
      .innerJoin(classSessions, eq(recordings.classSessionId, classSessions.id))
      .where(eq(recordings.id, recordingId))
      .get();

    if (!row) throw new ApiException('Recording not found', 404);
    const { rec, session } = row;

    if (!canAccessLmsContent(user, { product: session.product, batch: session.batch })) {
      throw new ApiException('Access denied', 403, 'LMS_ACCESS_DENIED');
    }

    const durationSeconds = rec.durationSeconds;

    // Upsert: increment secondsWatched, update lastPositionSeconds, recalc completedPercent
    // SQLite approach: insert-or-replace with raw expressions for atomic increment.
    const existing = await db
      .select()
      .from(recordingWatchProgress)
      .where(
        and(
          eq(recordingWatchProgress.recordingId, recordingId),
          eq(recordingWatchProgress.userId, user.id),
        ),
      )
      .limit(1)
      .get();

    if (existing) {
      const newSecondsWatched = existing.secondsWatched + Math.floor(delta);
      const completedPercent =
        durationSeconds && durationSeconds > 0
          ? Math.min(100, Math.round((newSecondsWatched / durationSeconds) * 100))
          : existing.completedPercent;

      await db
        .update(recordingWatchProgress)
        .set({
          lastPositionSeconds: positionSeconds,
          secondsWatched: newSecondsWatched,
          completedPercent,
          updatedAt: new Date(),
        })
        .where(eq(recordingWatchProgress.id, existing.id));
    } else {
      const initialWatched = Math.floor(delta);
      const completedPercent =
        durationSeconds && durationSeconds > 0
          ? Math.min(100, Math.round((initialWatched / durationSeconds) * 100))
          : 0;

      await db.insert(recordingWatchProgress).values({
        recordingId,
        userId: user.id,
        lastPositionSeconds: positionSeconds,
        secondsWatched: initialWatched,
        completedPercent,
        updatedAt: new Date(),
      });
    }

    return { ok: true };
  });
}
