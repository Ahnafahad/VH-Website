/**
 * GET /api/lms/admin/classes/[id]/attendance/roster
 * Full student roster in scope for this session, merged with their current
 * attendance state (present/mode) and historical absence stats — used by
 * the manual attendance-taking UI (as opposed to the read-only
 * .../attendance endpoint, which only lists students who already attended).
 */

import { NextRequest } from 'next/server';
import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classAttendance, classSessions, userAccess, users, vocabUserProgress } from '@/lib/db/schema';
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

    // ── Past completed sessions for the history panel ──────────────────────────
    // Same scoping rule as computeAttendanceStats: same product + subject,
    // status=completed, scheduledAt <= now, batch filter matches.
    const now = new Date();
    const pastSessionsBatchCondition =
      session.batch === null
        ? undefined
        : or(isNull(classSessions.batch), eq(classSessions.batch, session.batch));

    const pastSessions = await db
      .select({
        id: classSessions.id,
        title: classSessions.title,
        scheduledAt: classSessions.scheduledAt,
      })
      .from(classSessions)
      .where(
        and(
          eq(classSessions.product, session.product),
          eq(classSessions.subject, session.subject),
          eq(classSessions.status, 'completed'),
          lte(classSessions.scheduledAt, now),
          pastSessionsBatchCondition,
        ),
      );

    const pastSessionIds = pastSessions.map((s) => s.id);

    // ── Fetch all queries in parallel ──────────────────────────────────────────
    const [attendanceRows, statsMap, lexPointRows, historyAttRows] = await Promise.all([
      db
        .select()
        .from(classAttendance)
        .where(
          and(
            eq(classAttendance.sessionId, sessionId),
            inArray(classAttendance.userId, userIds),
          ),
        ),
      computeAttendanceStats(session, userIds, now),
      // Lexical points per user
      db
        .select({ userId: vocabUserProgress.userId, totalPoints: vocabUserProgress.totalPoints })
        .from(vocabUserProgress)
        .where(inArray(vocabUserProgress.userId, userIds)),
      // Past attendance rows for the history panel
      pastSessionIds.length > 0
        ? db
            .select({
              sessionId: classAttendance.sessionId,
              userId: classAttendance.userId,
              mode: classAttendance.mode,
            })
            .from(classAttendance)
            .where(
              and(
                inArray(classAttendance.sessionId, pastSessionIds),
                inArray(classAttendance.userId, userIds),
              ),
            )
        : Promise.resolve([] as { sessionId: number; userId: number; mode: string }[]),
    ]);

    // ── Build lookup maps ──────────────────────────────────────────────────────
    const attendanceMap = new Map(attendanceRows.map((r) => [r.userId, r]));

    const lexPointsMap = new Map<number, number>();
    for (const row of lexPointRows) lexPointsMap.set(row.userId, row.totalPoints);

    // historyAttMap: Map<userId, Map<sessionId, mode>>
    const historyAttMap = new Map<number, Map<number, string>>();
    for (const row of historyAttRows) {
      if (!historyAttMap.has(row.userId)) historyAttMap.set(row.userId, new Map());
      historyAttMap.get(row.userId)!.set(row.sessionId, row.mode);
    }

    // Past sessions sorted most-recent-first (used per student below)
    const sortedPastSessions = [...pastSessions].sort(
      (a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime(),
    );

    const students = scopedStudents
      .map((s) => {
        const att = attendanceMap.get(s.id);
        const stat = statsMap.get(s.id)!;
        const userHistAtt = historyAttMap.get(s.id);

        const history = sortedPastSessions.map((ps) => {
          const modeStr = userHistAtt?.get(ps.id) ?? null;
          return {
            sessionId: ps.id,
            title: ps.title,
            scheduledAt: ps.scheduledAt.getTime(),
            present: userHistAtt?.has(ps.id) ?? false,
            mode: (modeStr ?? null) as 'online' | 'offline' | null,
          };
        });

        return {
          userId: s.id,
          name: s.name,
          email: s.email,
          present: !!att,
          mode: (att?.mode ?? 'offline') as 'online' | 'offline',
          joinedAt: att?.joinedAt.getTime() ?? null,
          totalAbsences: stat.totalAbsences,
          absencesLast7Days: stat.absencesLast7Days,
          lexicalPoints: lexPointsMap.get(s.id) ?? 0,
          history,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { sessionId, students };
  });
}
