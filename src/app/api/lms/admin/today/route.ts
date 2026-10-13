/**
 * GET /api/lms/admin/today
 * Today's sessions (Dhaka day) with attendance counts, material counts,
 * posted homework, recorder state, assignment counts due within 48 hours, and
 * per-session pending-review counts. All per-session counts are grouped queries.
 */

import { and, count, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  classSessions,
  classAttendance,
  materials,
  assignments,
  assignmentSubmissions,
  sessionMaterials,
  users,
} from '@/lib/db/schema';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { DHAKA_OFFSET_HOURS } from '@/lib/lms/constants';
import { loadRecordings } from '@/lib/lms/recorder-info';

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

    // Grouped queries (one round trip per table, not one per session).
    const [attendanceRows, junctionRows, legacyRows, linkedHomework, recordingMap, assignmentsDue48h, offlineSubs, pendingReviewSubs] =
      await Promise.all([
        db
          .select({ sessionId: classAttendance.sessionId, count: count() })
          .from(classAttendance)
          .where(and(inArray(classAttendance.sessionId, sessionIds), eq(classAttendance.status, 'present')))
          .groupBy(classAttendance.sessionId),

        // Materials attached via the many-to-many junction...
        db
          .select({ sessionId: sessionMaterials.sessionId, materialId: sessionMaterials.materialId })
          .from(sessionMaterials)
          .where(inArray(sessionMaterials.sessionId, sessionIds)),

        // ...plus any legacy single-class link (same union as the class detail page).
        db
          .select({ sessionId: materials.classSessionId, materialId: materials.id })
          .from(materials)
          .where(inArray(materials.classSessionId, sessionIds)),

        // Homework posted against these exact sessions.
        db
          .select({
            id: assignments.id,
            title: assignments.title,
            dueAt: assignments.dueAt,
            classSessionId: assignments.classSessionId,
          })
          .from(assignments)
          .where(inArray(assignments.classSessionId, sessionIds)),

        loadRecordings(sessionIds),

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

        // Submissions awaiting instructor review (handed in, not yet reviewed) —
        // matched against today's sessions below via assignmentMatchesSession.
        db
          .select({
            submissionId: assignmentSubmissions.id,
            classSessionId: assignments.classSessionId,
            subject: assignments.subject,
            product: assignments.product,
            batch: assignments.batch,
          })
          .from(assignmentSubmissions)
          .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
          .where(eq(assignmentSubmissions.status, 'submitted')),
      ]);

    const attendanceMap = new Map(attendanceRows.map((r) => [r.sessionId, r.count]));
    const materialIdSets = new Map<number, Set<number>>();
    for (const r of [...junctionRows, ...legacyRows]) {
      if (r.sessionId === null) continue;
      const set = materialIdSets.get(r.sessionId) ?? new Set<number>();
      set.add(r.materialId);
      materialIdSets.set(r.sessionId, set);
    }

    // batch null = "all batches" on either side, so it matches any specific batch
    const batchMatches = (a: string | null, b: string | null) =>
      a === null || b === null || a === b;

    // An assignment belongs to a session if it was created against that exact
    // session (classSessionId FK — set whenever homework is posted from the
    // Today screen or picked in the Homework admin form); assignments created
    // without picking a session (classSessionId null) fall back to matching by
    // subject/product/batch, same rule already used for offlineShowcase above.
    const assignmentMatchesSession = (
      a: { classSessionId: number | null; subject: string; product: string; batch: string | null },
      s: { id: number; subject: string; product: string; batch: string | null },
    ) =>
      a.classSessionId !== null
        ? a.classSessionId === s.id
        : a.subject === s.subject && a.product === s.product && batchMatches(a.batch, s.batch);

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
        description: s.description,
        recallBotId: s.recallBotId,
        recording: recordingMap.get(s.id) ?? null,
        homework: linkedHomework
          .filter((h) => h.classSessionId === s.id)
          .map((h) => ({ id: h.id, title: h.title, dueAt: h.dueAt.getTime() })),
        attendanceCount: attendanceMap.get(s.id) ?? 0,
        materialsCount: materialIdSets.get(s.id)?.size ?? 0,
        pendingReviewCount: pendingReviewSubs.filter((p) => assignmentMatchesSession(p, s)).length,
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
