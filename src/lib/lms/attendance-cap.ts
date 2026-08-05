/**
 * Online attendance cap — 8 online attendances per student per course
 * (course = userAccess/classSessions.product). Existing rows count toward
 * the cap. Once a student hits it, online is no longer offered for a NEW
 * online mark on the manual attendance-taking sheet (offline/absent remain
 * available) — a hard block, not a soft warning. Rows already marked online
 * are unaffected: re-saving the same state is not new usage.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { classAttendance, classSessions } from '@/lib/db/schema';

type DrizzleClient = LibSQLDatabase<typeof schema>;

export const ONLINE_ATTENDANCE_CAP = 8;

/** Total online-mode attendance rows this student holds across all sessions of `product`. */
export async function countOnlineAttendance(
  db: DrizzleClient,
  userId: number,
  product: string,
): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(classAttendance)
    .innerJoin(classSessions, eq(classAttendance.sessionId, classSessions.id))
    .where(and(
      eq(classAttendance.userId, userId),
      eq(classAttendance.mode, 'online'),
      eq(classSessions.product, product),
    ))
    .get();
  return row?.count ?? 0;
}

/** Same count, batched for many students in one query (grouped by userId). */
export async function countOnlineAttendanceBatch(
  db: DrizzleClient,
  userIds: number[],
  product: string,
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (userIds.length === 0) return map;

  const rows = await db
    .select({ userId: classAttendance.userId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(classAttendance)
    .innerJoin(classSessions, eq(classAttendance.sessionId, classSessions.id))
    .where(and(
      inArray(classAttendance.userId, userIds),
      eq(classAttendance.mode, 'online'),
      eq(classSessions.product, product),
    ))
    .groupBy(classAttendance.userId);

  for (const r of rows) map.set(r.userId, r.count);
  return map;
}

// ─── Join-time cap enforcement ─────────────────────────────────────────────
// The manual attendance sheet enforces the cap as a 409 backstop (student
// still counted absent/offline). The student's own Join route needs the same
// cap, but can't just reject the request — joining a class is never blocked,
// only the online *attendance mark* is withheld once the cap is reached.

/**
 * Records a student's self-service class-join as online attendance, unless
 * the 8/course cap is already reached — in which case no row is written
 * (the student stays absent, per spec) but the caller still returns the meet
 * link. A student already online for THIS session is exempt from the cap
 * check entirely: re-joining a class they're already marked online for is
 * not new usage, so it can never be blocked by their own count (mirrors the
 * manual attendance sheet's same-session exemption).
 */
export async function recordOnlineJoinAttendance(
  db: DrizzleClient,
  args: { sessionId: number; userId: number; product: string; joinedAt: Date },
): Promise<{ recorded: boolean }> {
  const existing = await db
    .select({ mode: classAttendance.mode })
    .from(classAttendance)
    .where(and(eq(classAttendance.sessionId, args.sessionId), eq(classAttendance.userId, args.userId)))
    .get();

  const alreadyOnlineHere = existing?.mode === 'online';
  if (!alreadyOnlineHere) {
    const count = await countOnlineAttendance(db, args.userId, args.product);
    if (count >= ONLINE_ATTENDANCE_CAP) return { recorded: false };
  }

  await db
    .insert(classAttendance)
    .values({
      sessionId: args.sessionId,
      userId:    args.userId,
      joinedAt:  args.joinedAt,
      mode:      'online',
      source:    'join',
    })
    .onConflictDoUpdate({
      target: [classAttendance.sessionId, classAttendance.userId],
      // source moves to 'join' too: the row's current state now comes from the
      // student's join, not from whoever set it before. Leaving it 'manual' would
      // make back-sync treat a self-service row as an instructor's decision.
      set: { mode: 'online', source: 'join' },
    });

  return { recorded: true };
}
