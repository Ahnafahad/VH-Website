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
  assignmentSubmissions,
  users,
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
    const [attendanceCounts, materialCounts, assignmentsDue48h, offlineSubs] =
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

        // Students who declared "show offline" (any assignment, any due date) —
        // matched against today's sessions by subject/product/batch below.
        db
          .select({
            submissionId: assignmentSubmissions.id,
            userId: assignmentSubmissions.userId,
            userName: users.name,
            userEmail: users.email,
            checked: assignmentSubmissions.offlineChecked,
            submittedAt: assignmentSubmissions.submittedAt,
            assignmentId: assignments.id,
            assignmentTitle: assignments.title,
            subject: assignments.subject,
            product: assignments.product,
            batch: assignments.batch,
          })
          .from(assignmentSubmissions)
          .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
          .innerJoin(users, eq(assignmentSubmissions.userId, users.id))
          .where(eq(assignmentSubmissions.mode, 'offline')),
      ]);

    const attendanceMap = new Map(attendanceCounts.map((r) => [r.sessionId, r.count]));
    const materialsMap = new Map(materialCounts.map((r) => [r.sessionId, r.count]));

    // batch null = "all batches" on either side, so it matches any specific batch
    const batchMatches = (a: string | null, b: string | null) =>
      a === null || b === null || a === b;

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
        offlineShowcase: offlineSubs
          .filter((o) =>
            o.subject === s.subject &&
            o.product === s.product &&
            batchMatches(o.batch, s.batch),
          )
          .map((o) => ({
            submissionId: o.submissionId,
            userId: o.userId,
            userName: o.userName,
            userEmail: o.userEmail,
            checked: o.checked,
            submittedAt: o.submittedAt.getTime(),
            assignmentId: o.assignmentId,
            assignmentTitle: o.assignmentTitle,
          })),
      })),
      assignmentsDue48h,
    };
  });
}
