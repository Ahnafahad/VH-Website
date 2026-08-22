/**
 * Access control for the Math Marathon module. Mirrors src/lib/tests/access.ts.
 * A chapter is visible to a student through one or more `marathon_assignments`
 * rows: product must be one of the student's active products, and batch must
 * either be null (= everyone on that product) or match the student's batch.
 */

import type { MarathonAssignment, UserProduct, UserWithProducts } from '@/lib/db/schema';
import { isStaffRole } from '@/lib/auth/roles';

export function isMarathonStaff(user: Pick<UserWithProducts, 'role'>): boolean {
  return isStaffRole(user.role);
}

export function assignmentMatchesUser(
  assignment: Pick<MarathonAssignment, 'product' | 'batch'>,
  user: Pick<UserWithProducts, 'batch' | 'products'>,
): boolean {
  if (!user.products.includes(assignment.product as UserProduct)) return false;
  if (assignment.batch && assignment.batch !== user.batch) return false;
  return true;
}
