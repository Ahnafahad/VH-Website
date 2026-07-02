/**
 * Access control for the online tests module.
 *
 * Current policy: allowedProducts NULL → every logged-in (authorized) user can
 * take the test. Later, set tests.allowedProducts to a JSON array of products
 * (e.g. ["iba"]) to restrict per course — no code change needed here.
 */

import type { Test, UserWithProducts } from '@/lib/db/schema';

export function isTestStaff(user: Pick<UserWithProducts, 'role'>): boolean {
  return user.role === 'admin' || user.role === 'super_admin' || user.role === 'instructor';
}

export function canAccessTest(user: UserWithProducts, test: Test): boolean {
  if (isTestStaff(user)) return true;
  if (test.status !== 'published') return false;
  if (!test.allowedProducts) return true;
  try {
    const required = JSON.parse(test.allowedProducts) as string[];
    if (!Array.isArray(required) || required.length === 0) return true;
    return required.some(p => user.products.includes(p as UserWithProducts['products'][number]));
  } catch {
    return true; // malformed config should never lock students out silently
  }
}
