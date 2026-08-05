/**
 * Student-facing attendance summary: online attendances used out of the cap
 * (attendance-cap.ts), how many remain, and how many times absent — one
 * entry per product the student holds active access to.
 *
 * Absence is represented by the ABSENCE of a class_attendance row, so it is
 * computed against the sessions the student was actually expected at: every
 * completed, past class_session for that product whose batch matches (or is
 * null = all batches) — same scoping convention as computeAttendanceStats,
 * just summed across every subject for the product rather than one.
 */

import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { classAttendance, classSessions } from '@/lib/db/schema';
import type { UserProduct } from '@/lib/db/schema';
import { ONLINE_ATTENDANCE_CAP, countOnlineAttendance } from './attendance-cap';

type DrizzleClient = LibSQLDatabase<typeof schema>;

export interface StudentAttendanceProductSummary {
  product: UserProduct;
  onlineUsed: number;
  onlineRemaining: number;
  totalExpected: number;
  absences: number;
}

export async function computeStudentAttendanceSummary(
  db: DrizzleClient,
  user: { id: number; batch: string | null; products: UserProduct[] },
  now: Date = new Date(),
): Promise<StudentAttendanceProductSummary[]> {
  const summaries: StudentAttendanceProductSummary[] = [];

  for (const product of user.products) {
    const batchCondition =
      user.batch === null
        ? isNull(classSessions.batch)
        : or(isNull(classSessions.batch), eq(classSessions.batch, user.batch));

    const expected = await db
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(and(
        eq(classSessions.product, product),
        eq(classSessions.status, 'completed'),
        lte(classSessions.scheduledAt, now),
        batchCondition,
      ));

    const expectedIds = expected.map((s) => s.id);
    let attendedCount = 0;
    if (expectedIds.length > 0) {
      const attended = await db
        .select({ sessionId: classAttendance.sessionId })
        .from(classAttendance)
        .where(and(eq(classAttendance.userId, user.id), inArray(classAttendance.sessionId, expectedIds)));
      attendedCount = new Set(attended.map((a) => a.sessionId)).size;
    }

    const onlineUsed = await countOnlineAttendance(db, user.id, product);

    summaries.push({
      product,
      onlineUsed,
      onlineRemaining: Math.max(0, ONLINE_ATTENDANCE_CAP - onlineUsed),
      totalExpected: expectedIds.length,
      absences: expectedIds.length - attendedCount,
    });
  }

  return summaries;
}
