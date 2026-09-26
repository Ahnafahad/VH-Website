/**
 * Access control for Redline. The audience is IBA students of the 2026-27 batch (product 'iba');
 * staff can always open it. Students additionally need the module switched on
 * (redline_config.active) — staff preview regardless.
 */

import type { UserWithProducts } from '@/lib/db/schema';
import { isStaffRole } from '@/lib/auth/roles';

export const REDLINE_PRODUCT = 'iba' as const;
export const REDLINE_BATCH = '2026-27';

export function isRedlineStaff(user: Pick<UserWithProducts, 'role'>): boolean {
  return isStaffRole(user.role);
}

export function canAccessRedline(user: Pick<UserWithProducts, 'products' | 'batch' | 'role'>): boolean {
  if (isRedlineStaff(user)) return true;
  return user.products.includes(REDLINE_PRODUCT) && user.batch === REDLINE_BATCH;
}
