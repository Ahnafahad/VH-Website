/**
 * Who sees the Mocks entry point: staff and anyone holding the "Mock Access" product (plus FBS students, who sit
 * the Pre-Mock). Each mock then narrows by its batch in lib/tests/access.ts:canAccessTest.
 */

import type { UserWithProducts } from '@/lib/db/schema';
import { isStaffRole, isUltimateTesterEmail } from '@/lib/auth/roles';
import { inMockTrialDay } from './trial';

export function canSeeMocks(user: Pick<UserWithProducts, 'role' | 'products' | 'mockAccess' | 'email'>): boolean {
  return isStaffRole(user.role) || !!user.mockAccess || isUltimateTesterEmail(user.email) || inMockTrialDay()
    || user.products.some(p => p === 'fbs' || p === 'fbs_detailed');
}
