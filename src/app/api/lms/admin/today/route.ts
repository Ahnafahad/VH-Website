/**
 * GET /api/lms/admin/today
 * Today's sessions (Dhaka day) with attendance counts, material counts,
 * and assignment counts due within 48 hours.
 */

import { and, count, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  classSessions,
  classAttendance,
  materials,
  assignments,
} from '@/lib/db/schema';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { DHAKA_OFFSET_HOURS } from '@/lib/lms/constants';

const DHAKA_OFFSET_MS = DHAKA_OFFSET_HOURS * 60 * 60 * 1000;

/** Start of today in Dhaka, returned as UTC Date */
function dhakaTodayStartUtc(now: Date): Date {
  const dhakaMs = now.getTime() + DHAKA_OFFSET_MS;
  const dhakaDate = new Date(dhakaMs);
  // Zero out hours/minutes/seconds/ms in Dhaka time
  const midnightDhakaMs =
    dhakaMs -
    (dhakaDate.getUTCHours() * 3600 +
      dhakaDate.getUTCMinutes() * 60 +
      dhakaDate.getUTCSeconds()) *
      1000 -
    dhakaDate.getUTCMilliseconds();
  return new Date(midnightDhakaMs - DHAKA_OFFSET_MS);
}

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    const now = new Date();
    const todayStart = dhakaTodayStartUtc(now);
    const todayEnd = new Date(todayStart.getTime() + 86400_000);
    const in48h = new Date(now.getTime() + 48 * 3600_000);

    // Today's sessions (all statuses except cancelled)
    const todaySessions = await db
      .select()
      .from(classSessions)
      .where(
        and(
          gte(classSessions.scheduledAt, todayStart),
          lte(classSessions.scheduledAt, todayEnd),
        ),
      );

    if (todaySessions.length === 0) {
      return { sessions: [], assignmentsDue48h: 0 };
    }

    const sessionIds = todaySessions.map((s) => s.id);

    // Parallelise: attendance counts per session + materials per session + assignments due in 48h
    const [attendanceCounts, materialCounts, assignmentsDue48h] =
      await Promise.all([
        // Attendance counts
        Promise.all(
          sessionIds.map((sid) =>
            db
              .select({ count: count() })
              .from(classAttendance)
              .where(eq(classAttendance.sessionId, sid))
              .get()
              .then((r) => ({ sessionId: sid, count: r?.count ?? 0 })),
          ),
        ),

        // Material counts
        Promise.all(
          sessionIds.map((sid) =>
            db
              .select({ count: count() })
              .from(materials)
              .where(eq(materials.classSessionId, sid))
              .get()
              .then((r) => ({ sessionId: sid, count: r?.count ?? 0 })),
          ),
        ),

        // Assignments due in the next 48 hours
        db
          .select({ count: count() })
          .from(assignments)
          .where(
            and(
              gte(assignments.dueAt, now),
              lte(assignments.dueAt, in48h),
            ),
          )
          .get()
          .then((r) => r?.count ?? 0),
      ]);

    const attendanceMap = new Map(attendanceCounts.map((r) => [r.sessionId, r.count]));
    const materialsMap = new Map(materialCounts.map((r) => [r.sessionId, r.count]));

    return {
      sessions: todaySessions.map((s) => ({
        id: s.id,
        title: s.title,
        subject: s.subject,
        product: s.product,
        batch: s.batch,
        scheduledAt: s.scheduledAt.getTime(),
        durationMinutes: s.durationMinutes,
        status: s.status,
        meetLink: s.meetLink,
        attendanceCount: attendanceMap.get(s.id) ?? 0,
        materialsCount: materialsMap.get(s.id) ?? 0,
      })),
      assignmentsDue48h,
    };
  });
}
