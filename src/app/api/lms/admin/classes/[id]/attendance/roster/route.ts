/**
 * GET /api/lms/admin/classes/[id]/attendance/roster
 * Full student roster in scope for this session, merged with their current
 * attendance state (present/mode) and historical absence stats — used by
 * the manual attendance-taking UI (as opposed to the read-only
 * .../attendance endpoint, which only lists students who already attended).
 */

import { NextRequest } from 'next/server';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classAttendance, classSessions, userAccess, users } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { computeAttendanceStats } from '@/lib/lms/attendance-stats';

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
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!session) throw new ApiException('Session not found', 404);

    const accessRows = await db
      .select({ userId: userAccess.userId })
      .from(userAccess)
      .where(and(eq(userAccess.product, session.product), eq(userAccess.active, true)));

    const scopedUserIds = accessRows.map((r) => r.userId);
    if (scopedUserIds.length === 0) return { sessionId, students: [] };

    const batchCondition =
      session.batch === null
        ? undefined
        : or(eq(users.batch, session.batch), isNull(users.batch));

    const scopedStudents = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(
        and(
          inArray(users.id, scopedUserIds),
          eq(users.status, 'active'),
          eq(users.role, 'student'),
          batchCondition,
        ),
      );

    if (scopedStudents.length === 0) return { sessionId, students: [] };

    const userIds = scopedStudents.map((s) => s.id);

    const [attendanceRows, statsMap] = await Promise.all([
      db
        .select()
        .from(classAttendance)
        .where(
          and(
            eq(classAttendance.sessionId, sessionId),
            inArray(classAttendance.userId, userIds),
          ),
        ),
      computeAttendanceStats(session, userIds, new Date()),
    ]);

    const attendanceMap = new Map(attendanceRows.map((r) => [r.userId, r]));

    const students = scopedStudents
      .map((s) => {
        const att = attendanceMap.get(s.id);
        const stat = statsMap.get(s.id)!;
        return {
          userId: s.id,
          name: s.name,
          email: s.email,
          present: !!att,
          mode: (att?.mode ?? 'online') as 'online' | 'offline',
          joinedAt: att?.joinedAt.getTime() ?? null,
          totalAbsences: stat.totalAbsences,
          absencesLast7Days: stat.absencesLast7Days,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { sessionId, students };
  });
}
