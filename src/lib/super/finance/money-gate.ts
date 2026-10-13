/**
 * "Money view restriction": when lmsSettings `super:finance:money-super-only` is '1', /admin/operational and its
 * API routes are hidden from plain admins (super admin still sees them). Default OFF = no behaviour change.
 */
import { ApiException } from '@/lib/api-utils';
import { getLmsSetting } from '@/lib/lms/settings';
import { isSuperAdminRole } from '@/lib/auth/roles';

export const MONEY_GATE_KEY = 'super:finance:money-super-only';

export async function isMoneySuperOnly(): Promise<boolean> {
  return (await getLmsSetting(MONEY_GATE_KEY)) === '1';
}

/** True when this role must NOT see operational money data right now. */
export async function moneyHiddenFrom(role: string | undefined): Promise<boolean> {
  return !isSuperAdminRole(role) && (await isMoneySuperOnly());
}

/** API guard: throws 403 when the money view is restricted for this role. */
export async function assertMoneyAccess(role: string | undefined): Promise<void> {
  if (await moneyHiddenFrom(role)) throw new ApiException('Operational finance is restricted to the super admin', 403, 'MONEY_SUPER_ONLY');
}
