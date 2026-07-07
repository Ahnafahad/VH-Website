/**
 * Attendee resolution for Google Calendar events.
 *
 * Queries active students who have the product matching the class session,
 * and whose batch matches (or content batch is null = all batches).
 */

import { db } from '@/lib/db';
import { users, userAccess } from '@/lib/db/schema';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

export interface AttendeeScope {
  product: string;
  batch:   string | null;
}

/**
 * Return email addresses of all active students who should be invited to a
 * class session with the given product+batch scope.
 *
 * Query logic:
 *   SELECT DISTINCT u.email
 *   FROM users u
 *   JOIN user_access ua ON ua.user_id = u.id AND ua.product = :product AND ua.active = true
 *   WHERE u.status = 'active'
 *     AND u.role = 'student'
 *     AND (
 *       :batch IS NULL
 *       OR u.batch = :batch
 *       OR u.batch IS NULL   -- edge case: student has no batch assigned yet
 *     )
 *
 * Note: when scope.batch is null the content is visible to ALL students with
 * the product, regardless of their batch — so we do not filter by batch at all.
 */
export async function getAttendeeEmails(scope: AttendeeScope): Promise<string[]> {
  // Step 1: find all active user_access rows for this product
  const accessRows = await db
    .select({ userId: userAccess.userId })
    .from(userAccess)
    .where(
      and(
        eq(userAccess.product, scope.product),
        eq(userAccess.active, true),
      ),
    );

  if (accessRows.length === 0) return [];

  const userIds = accessRows.map((r) => r.userId);

  // Step 2: filter to active students with matching batch
  const batchCondition =
    scope.batch === null
      ? undefined // no batch filter: all students with this product
      : or(
          eq(users.batch, scope.batch),
          isNull(users.batch),
        );

  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        inArray(users.id, userIds),
        eq(users.status, 'active'),
        eq(users.role, 'student'),
        batchCondition,
      ),
    );

  return rows.map((r) => r.email);
}
