/**
 * Per-student attendance history stats (total absences, absences in the
 * last 7 days) computed against completed sessions in the same
 * product + subject + batch series as a given session.
 */

import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classAttendance, classSessions } from '@/lib/db/schema';

export interface StudentAttendanceStats {
  totalAbsences: number;
  absencesLast7Days: number;
}

export async function computeAttendanceStats(
  session: { product: string; subject: string; batch: string | null },
  userIds: number[],
  now: Date,
): Promise<Map<number, StudentAttendanceStats>> {
  const stats = new Map<number, StudentAttendanceStats>();
  for (const id of userIds) stats.set(id, { totalAbsences: 0, absencesLast7Days: 0 });
  if (userIds.length === 0) return stats;

  const batchCondition =
    session.batch === null
      ? undefined
      : or(isNull(classSessions.batch), eq(classSessions.batch, session.batch));

  const pastSessions = await db
    .select({ id: classSessions.id, scheduledAt: classSessions.scheduledAt })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.product, session.product),
        eq(classSessions.subject, session.subject),
        eq(classSessions.status, 'completed'),
        lte(classSessions.scheduledAt, now),
        batchCondition,
      ),
    );

  if (pastSessions.length === 0) return stats;

  const sessionIds = pastSessions.map((s) => s.id);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const last7Ids = new Set(
    pastSessions.filter((s) => s.scheduledAt >= sevenDaysAgo).map((s) => s.id),
  );

  const attendanceRows = await db
    .select({ userId: classAttendance.userId, sessionId: classAttendance.sessionId })
    .from(classAttendance)
    .where(
      and(
        inArray(classAttendance.sessionId, sessionIds),
        inArray(classAttendance.userId, userIds),
      ),
    );

  const attendedByUser = new Map<number, Set<number>>();
  for (const row of attendanceRows) {
    if (!attendedByUser.has(row.userId)) attendedByUser.set(row.userId, new Set());
    attendedByUser.get(row.userId)!.add(row.sessionId);
  }

  for (const userId of userIds) {
    const attended = attendedByUser.get(userId) ?? new Set<number>();
    const totalAbsences = pastSessions.filter((s) => !attended.has(s.id)).length;
    const absencesLast7Days = pastSessions.filter(
      (s) => last7Ids.has(s.id) && !attended.has(s.id),
    ).length;
    stats.set(userId, { totalAbsences, absencesLast7Days });
  }

  return stats;
}
