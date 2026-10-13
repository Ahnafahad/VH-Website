import { inArray } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '@/lib/db/schema';
import { classAttendance } from '@/lib/db/schema';

/** Ids (among `sessionIds`) that have at least one attendance row of any status. One grouped query. */
export async function sessionIdsWithAttendanceRows(
  db: LibSQLDatabase<typeof schema>,
  sessionIds: number[],
): Promise<Set<number>> {
  if (sessionIds.length === 0) return new Set();
  const rows = await db
    .select({ sessionId: classAttendance.sessionId })
    .from(classAttendance)
    .where(inArray(classAttendance.sessionId, sessionIds))
    .groupBy(classAttendance.sessionId);
  return new Set(rows.map((r) => r.sessionId));
}
