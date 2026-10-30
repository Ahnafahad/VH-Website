/**
 * Who sees the Mocks entry point. Each mock then narrows by its own batch/product in
 * lib/tests/access.ts:canAccessTest — this only decides whether the dashboard tile shows.
 */

import type { UserWithProducts } from '@/lib/db/schema';
import { isStaffRole } from '@/lib/auth/roles';

export function canSeeMocks(user: Pick<UserWithProducts, 'role' | 'products'>): boolean {
  return isStaffRole(user.role) || user.products.includes('iba');
}
