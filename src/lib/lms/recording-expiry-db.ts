// ─── Recording Expiry — DB Helper ────────────────────────────────────────────
// Separate from recording-expiry.ts so the pure function stays unit-testable
// without a live DB connection.

import { db } from '@/lib/db';
import { classSessions } from '@/lib/db/schema';
import { and, eq, gt, or, isNull, sql } from 'drizzle-orm';
import type { ClassSession } from '@/lib/db/schema';

/**
 * Count class_sessions that are "subsequent completed" relative to `session`:
 *   - same subject
 *   - same product
 *   - batch matches (session.batch null ↔ query only null; otherwise null OR equal)
 *   - status = 'completed'
 *   - scheduledAt > session.scheduledAt
 */
export async function countSubsequentCompletedClasses(
  session: Pick<ClassSession, 'id' | 'subject' | 'product' | 'batch' | 'scheduledAt'>,
): Promise<number> {
  const batchCondition =
    session.batch == null
      ? isNull(classSessions.batch)
      : or(isNull(classSessions.batch), eq(classSessions.batch, session.batch))!;

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.subject, session.subject),
        eq(classSessions.product, session.product),
        batchCondition,
        eq(classSessions.status, 'completed'),
        gt(classSessions.scheduledAt, session.scheduledAt),
      ),
    );

  return Number(rows[0]?.count ?? 0);
}
