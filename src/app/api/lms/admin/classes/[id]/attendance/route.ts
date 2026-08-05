/**
 * GET /api/lms/admin/classes/[id]/attendance
 * Returns attendance list (name, email, joinedAt) + recording watch progress
 * for users who have a recording_watch_progress row.
 */

import { NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
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
import { ONLINE_ATTENDANCE_CAP, countOnlineAttendance } from '@/lib/lms/attendance-cap';
import { recordAudit } from '@/lib/audit-log';

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

// ─── PUT ──────────────────────────────────────────────────────────────────────

/**
 * PUT /api/lms/admin/classes/[id]/attendance
 * Manually mark attendance for a set of students (present/absent + online/offline).
 * body: { records: { userId: number; present: boolean; mode: 'online' | 'offline' }[] }
 */

interface AttendanceRecordInput {
  userId: number;
  present: boolean;
  mode: 'online' | 'offline';
}

function validateRecords(body: unknown): AttendanceRecordInput[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).records)) {
    throw new ApiException('records must be an array', 400);
  }
  const records = (body as { records: unknown[] }).records;

  return records.map((r): AttendanceRecordInput => {
    if (!r || typeof r !== 'object') throw new ApiException('Each record must be an object', 400);
    const rec = r as Record<string, unknown>;
    const userId = typeof rec.userId === 'number' ? rec.userId : NaN;
    if (!Number.isInteger(userId)) throw new ApiException('Each record needs a valid userId', 400);
    return {
      userId,
      present: rec.present === true,
      mode: rec.mode === 'online' ? 'online' : 'offline',
    };
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const actor = await requireStaff();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid id', 400);

    const session = await db
      .select({ id: classSessions.id, product: classSessions.product })
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!session) throw new ApiException('Session not found', 404);

    const records = validateRecords(await req.json());
    const now = new Date();

    // Online cap (rec: 8 per student per course) — a hard block for the
    // attendance taker. Only checked for records that would newly BECOME
    // online here; a row already online for this exact session is not new
    // usage, so re-saving it must never be blocked by its own count.
    const onlineCandidates = records.filter((r) => r.present && r.mode === 'online');
    if (onlineCandidates.length > 0) {
      const existingOnlineRows = await db
        .select({ userId: classAttendance.userId })
        .from(classAttendance)
        .where(and(
          eq(classAttendance.sessionId, sessionId),
          inArray(classAttendance.userId, onlineCandidates.map((r) => r.userId)),
          eq(classAttendance.mode, 'online'),
        ));
      const alreadyOnline = new Set(existingOnlineRows.map((r) => r.userId));
      const newOnline = onlineCandidates.filter((r) => !alreadyOnline.has(r.userId));

      const blocked: number[] = [];
      for (const r of newOnline) {
        const count = await countOnlineAttendance(db, r.userId, session.product);
        if (count >= ONLINE_ATTENDANCE_CAP) blocked.push(r.userId);
      }
      if (blocked.length > 0) {
        throw new ApiException(
          `Online attendance cap (${ONLINE_ATTENDANCE_CAP}) reached for ${blocked.length} student(s) — mark offline or absent instead.`,
          409,
          'ONLINE_CAP_REACHED',
        );
      }
    }

    // Snapshot before mutating, so the audit row can show what actually changed.
    // "Who marked this student absent, and when" is the question this answers.
    const rosterSnapshot = () => db
      .select({
        userId: classAttendance.userId,
        mode:   classAttendance.mode,
        source: classAttendance.source,
      })
      .from(classAttendance)
      .where(eq(classAttendance.sessionId, sessionId));

    const before = await rosterSnapshot().catch(() => null);

    for (const rec of records) {
      if (rec.present) {
        await db
          .insert(classAttendance)
          .values({ sessionId, userId: rec.userId, joinedAt: now, mode: rec.mode, source: 'manual' })
          .onConflictDoUpdate({
            target: [classAttendance.sessionId, classAttendance.userId],
            set: { mode: rec.mode, source: 'manual' },
          });
      } else {
        await db
          .delete(classAttendance)
          .where(
            and(
              eq(classAttendance.sessionId, sessionId),
              eq(classAttendance.userId, rec.userId),
            ),
          );
      }
    }

    // Fire-and-forget: a logging failure must never fail the attendance save.
    if (before) {
      rosterSnapshot()
        .then((after) => recordAudit({
          actorUserId: actor.id,
          action:      'attendance.update',
          entityType:  'class_session',
          entityId:    sessionId,
          before,
          after,
        }))
        .catch(() => {});
    }

    return { success: true };
  });
}
