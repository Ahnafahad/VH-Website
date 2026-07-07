/**
 * GET /api/lms/admin/classes/[id]/attendance
 * Returns attendance list (name, email, joinedAt) + recording watch progress
 * for users who have a recording_watch_progress row.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  classAttendance,
  classSessions,
  recordings,
  recordingWatchProgress,
  users,
} from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid id', 400);

    const session = await db
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!session) throw new ApiException('Session not found', 404);

    // Load attendance joined with users
    const attendanceRows = await db
      .select({
        attendanceId: classAttendance.id,
        userId: classAttendance.userId,
        joinedAt: classAttendance.joinedAt,
        name: users.name,
        email: users.email,
      })
      .from(classAttendance)
      .innerJoin(users, eq(classAttendance.userId, users.id))
      .where(eq(classAttendance.sessionId, sessionId));

    // Load recording for this session (if any)
    const recording = await db
      .select({ id: recordings.id, status: recordings.status })
      .from(recordings)
      .where(eq(recordings.classSessionId, sessionId))
      .limit(1)
      .get();

    // Load watch progress rows if recording exists
    const watchProgressMap = new Map<
      number,
      { secondsWatched: number; lastPositionSeconds: number; completedPercent: number }
    >();

    if (recording) {
      const progressRows = await db
        .select()
        .from(recordingWatchProgress)
        .where(eq(recordingWatchProgress.recordingId, recording.id));
      for (const row of progressRows) {
        watchProgressMap.set(row.userId, {
          secondsWatched: row.secondsWatched,
          lastPositionSeconds: row.lastPositionSeconds,
          completedPercent: row.completedPercent,
        });
      }
    }

    return {
      sessionId,
      recording: recording ?? null,
      attendance: attendanceRows.map((row) => ({
        userId: row.userId,
        name: row.name,
        email: row.email,
        joinedAt: row.joinedAt.getTime(),
        watchProgress: watchProgressMap.get(row.userId) ?? null,
      })),
    };
  });
}
