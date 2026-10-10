/**
 * Access control for Essays.
 *
 * - Grading, series management and every script are staff-only
 *   (admin | super_admin | instructor).
 * - Force-unlocking another grader's script and the per-grader comparison are
 *   admin-only (no instructors).
 * - A student sees a series when it is active and matches their product +
 *   batch (the shared LMS scope rule), and only ever their own submissions.
 */

import type { EssaySeries, UserWithProducts } from '@/lib/db/schema';
import { isAdminRole, isStaffRole } from '@/lib/auth/roles';
import { canAccessLmsContent } from '@/lib/lms/access';

export function isEssayStaff(user: Pick<UserWithProducts, 'role'>): boolean {
  return isStaffRole(user.role);
}

export function isEssayAdmin(user: Pick<UserWithProducts, 'role'>): boolean {
  return isAdminRole(user.role);
}

export function canSeeSeries(user: UserWithProducts, series: Pick<EssaySeries, 'product' | 'batch' | 'status'>): boolean {
  if (isEssayStaff(user)) return true;
  if (series.status !== 'active') return false;
  return canAccessLmsContent(user, { product: series.product, batch: series.batch });
}
