// ─── LMS Access Control ───────────────────────────────────────────────────────
// Single implementation for all LMS content scope checks.

import { SQL, and, eq, isNull, or, sql } from 'drizzle-orm';
import type { UserWithProducts } from '@/lib/db/schema';
import { users, userAccess, lmsAnnouncements } from '@/lib/db/schema';
import { isStaffRole } from '@/lib/auth/roles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStaff(user: UserWithProducts): boolean {
  return isStaffRole(user.role);
}

// ─── Content scope type ───────────────────────────────────────────────────────

export interface LmsContentScope {
  /** e.g. 'iba' | 'fbs' */
  product: string;
  /** null = content visible to all batches in this product */
  batch: string | null;
}

// ─── canAccessLmsContent ──────────────────────────────────────────────────────

/**
 * Returns true when `user` may access `content`.
 *
 * Rules:
 * - Staff (admin | super_admin | instructor) always have access.
 * - Students must have the matching product in their products array.
 * - If content.batch is null, all students with the right product can see it.
 * - If content.batch is set, only students whose users.batch equals it can see it.
 */
export function canAccessLmsContent(
  user: UserWithProducts,
  content: LmsContentScope,
): boolean {
  if (isStaff(user)) return true;

  if (!user.products.includes(content.product as never)) return false;

  if (content.batch === null) return true;

  return user.batch === content.batch;
}

// ─── lmsScopeConditions ───────────────────────────────────────────────────────

/**
 * Returns an array of Drizzle SQL conditions to add to a WHERE clause so that
 * the query is scoped to what `user` is allowed to see.
 *
 * For staff: returns an empty array (no extra filtering needed).
 * For students: filters to their products AND (batch IS NULL OR batch = user.batch).
 *
 * Usage:
 *   const conditions = lmsScopeConditions(user, classSessions);
 *   db.select().from(classSessions).where(and(...conditions, ...otherConditions));
 *
 * The table parameter must have `.product` and `.batch` columns.
 */
export function lmsScopeConditions<
  T extends { product: Parameters<typeof eq>[0]; batch: Parameters<typeof eq>[0] },
>(
  user: UserWithProducts,
  table: T,
): SQL[] {
  if (isStaff(user)) return [];

  const conditions: SQL[] = [];

  if (user.products.length === 0) {
    // No products → no LMS content
    conditions.push(eq(table.product, '__never__') as SQL);
    return conditions;
  }

  // product IN (user's products) — expressed as OR chain for SQLite compatibility
  const productCondition =
    user.products.length === 1
      ? (eq(table.product, user.products[0]) as SQL)
      : (or(...user.products.map((p) => eq(table.product, p))) as SQL);

  conditions.push(productCondition);

  // batch IS NULL OR batch = user.batch
  const batchCondition =
    user.batch == null
      ? (isNull(table.batch) as SQL)
      : (or(isNull(table.batch), eq(table.batch, user.batch)) as SQL);

  conditions.push(batchCondition);

  return conditions;
}

// ─── lmsStudentAudienceConditions ─────────────────────────────────────────────

/**
 * The third adapter at this seam: the same visibility rule as
 * `canAccessLmsContent`, expressed over the USER table instead of the content
 * table — "which students is this content for?" rather than "may this user read
 * it?".
 *
 * Returns Drizzle conditions for a query that joins `users` to `userAccess`
 * (`innerJoin(userAccess, eq(userAccess.userId, users.id))`). Because a student
 * may hold several userAccess rows, callers must dedupe by user id.
 *
 * Deliberately students-only and WITHOUT the staff bypass that
 * `canAccessLmsContent` applies: staff can read everything, but they are not the
 * audience for student-facing content announcements.
 *
 * Mirrors `fetchUserWithProducts` (db-access-control.ts) in requiring
 * `users.status = 'active'` and `userAccess.active = true`, so a student whose
 * grant was revoked drops out of the audience exactly as they lose read access.
 */
export function lmsStudentAudienceConditions(content: LmsContentScope): SQL[] {
  const conditions: SQL[] = [
    eq(users.role, 'student'),
    eq(users.status, 'active'),
    eq(userAccess.product, content.product),
    eq(userAccess.active, true),
  ];

  // batch null = every batch in this product; otherwise the batch must match.
  if (content.batch !== null) {
    conditions.push(eq(users.batch, content.batch));
  }

  return conditions;
}

// ─── lmsAnnouncementScopeConditions ───────────────────────────────────────────

/**
 * Dedicated visibility rule for `lmsAnnouncements`, which — unlike the other
 * LMS content tables `lmsScopeConditions` is generic over — can additionally
 * target named individuals via `targetUserIds` (JSON array of user ids).
 * NOT folded into `lmsScopeConditions`: that helper is shared by tables
 * (materials, assignments, class_sessions) with no such column.
 *
 * Rule:
 *   staff                                       → see everything (handled by caller)
 *   targetUserIds IS NULL                       → normal cohort rule (product + batch)
 *   targetUserIds contains this user's id        → visible regardless of cohort
 *   targetUserIds set but does NOT contain them  → NOT visible (no leak to the batch)
 */
export function lmsAnnouncementScopeConditions(user: UserWithProducts): SQL[] {
  if (isStaff(user)) return [];

  const cohortMatch = and(...lmsScopeConditions(user, lmsAnnouncements));
  const targetedToMe = sql`(${lmsAnnouncements.targetUserIds} IS NOT NULL AND EXISTS (
    SELECT 1 FROM json_each(${lmsAnnouncements.targetUserIds}) WHERE CAST(json_each.value AS INTEGER) = ${user.id}
  ))`;

  return [
    or(
      and(isNull(lmsAnnouncements.targetUserIds), cohortMatch),
      targetedToMe,
    ) as SQL,
  ];
}
