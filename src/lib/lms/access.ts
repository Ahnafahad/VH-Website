// ─── LMS Access Control ───────────────────────────────────────────────────────
// Single implementation for all LMS content scope checks.

import { SQL, and, eq, isNull, or } from 'drizzle-orm';
import type { UserWithProducts } from '@/lib/db/schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStaff(user: UserWithProducts): boolean {
  return (
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'instructor'
  );
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
