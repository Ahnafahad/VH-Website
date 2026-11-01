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

export function canActivateTestWindow(user: Pick<UserWithProducts, 'role'>): boolean {
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

export function canAccessTest(user: Pick<UserWithProducts, 'role' | 'email' | 'batch' | 'products' | 'mockAccess'>, test: Test): boolean {
  if (isTestStaff(user) || isUltimateTesterEmail(user.email)) return true;
  if (test.status !== 'published') return false;
  if (test.isMock) {
    // A mock with a batch set is limited to that batch. One that names products (the FBS Pre-Mock) follows
    // them; the rest are for Mock Access holders.
    if (test.mockBatch && user.batch !== test.mockBatch) return false;
    return test.allowedProducts ? isTestAllowedForProducts(test, user.products) : !!user.mockAccess;
  }
  return isTestAllowedForProducts(test, user.products);
}
