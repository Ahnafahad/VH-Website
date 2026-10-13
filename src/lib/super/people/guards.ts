/**
 * Pure guard rules for staff changes made from /admin/super/staff. No DB access so it is unit-testable;
 * the caller supplies the target row and how many active super_admins exist right now.
 */
import { ApiException } from '@/lib/api-utils';
import { isRootEmail } from '@/lib/super/guard';

export type StaffChange =
  | { kind: 'role'; role: string }
  | { kind: 'suspend' }
  | { kind: 'unsuspend' }
  | { kind: 'readonly'; value: boolean }
  | { kind: 'teaching'; value: boolean }
  | { kind: 'remove' };

export interface StaffTarget { id: number; email: string; role: string; status: string }

export function assertStaffChange(p: {
  actorId: number; target: StaffTarget; change: StaffChange; activeSuperAdmins: number;
}): void {
  const { actorId, target, change, activeSuperAdmins } = p;
  if (isRootEmail(target.email)) throw new ApiException('The root account cannot be modified', 403, 'ROOT_PROTECTED');

  const selfLocking = change.kind === 'role' || change.kind === 'suspend' || change.kind === 'remove' || change.kind === 'readonly';
  if (target.id === actorId && selfLocking) {
    throw new ApiException('You cannot change your own role, status or read-only flag', 403, 'SELF_CHANGE');
  }

  const removesSuperAdmin =
    (change.kind === 'role' && change.role !== 'super_admin') || change.kind === 'suspend' || change.kind === 'remove';
  if (removesSuperAdmin && target.role === 'super_admin' && target.status === 'active' && activeSuperAdmins <= 1) {
    throw new ApiException('Cannot demote, suspend or remove the last active super admin', 409, 'LAST_SUPER_ADMIN');
  }
}
