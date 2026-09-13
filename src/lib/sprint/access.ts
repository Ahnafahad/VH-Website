/**
 * Access control for Sprint. A student can see Sprint at all if they hold
 * either FBS product; there's no per-set assignment/batch scoping — a set is
 * visible to every FBS student the moment its status is 'active'.
 */

import type { UserWithProducts } from '@/lib/db/schema';
import { isStaffRole } from '@/lib/auth/roles';

export function isSprintStaff(user: Pick<UserWithProducts, 'role'>): boolean {
  return isStaffRole(user.role);
}

export function canAccessSprint(user: Pick<UserWithProducts, 'products'>): boolean {
  return user.products.includes('fbs') || user.products.includes('fbs_detailed');
}
