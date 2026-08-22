/**
 * Access control for the online tests module.
 *
 * Current policy: allowedProducts NULL → every logged-in (authorized) user can
 * take the test. Later, set tests.allowedProducts to a JSON array of products
 * (e.g. ["iba"]) to restrict per course — no code change needed here.
 */

import type { Test, UserWithProducts } from '@/lib/db/schema';
import { isStaffRole, isUltimateTesterEmail } from '@/lib/auth/roles';

export function isTestStaff(user: Pick<UserWithProducts, 'role'>): boolean {
  return isStaffRole(user.role);
}

/** Product-only half of the access rule — usable where there's a product
 * (e.g. a leaderboard batch) but no specific user. */
export function isTestAllowedForProducts(test: Pick<Test, 'allowedProducts'>, products: string[]): boolean {
  if (!test.allowedProducts) return true;
  try {
    const required = JSON.parse(test.allowedProducts) as string[];
    if (!Array.isArray(required) || required.length === 0) return true;
    return required.some(p => products.includes(p));
  } catch {
    return true; // malformed config should never lock students out silently
  }
}

export function canAccessTest(user: UserWithProducts, test: Test): boolean {
  if (isTestStaff(user) || isUltimateTesterEmail(user.email)) return true;
  if (test.status !== 'published') return false;
  return isTestAllowedForProducts(test, user.products);
}
