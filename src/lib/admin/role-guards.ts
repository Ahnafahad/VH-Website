import { ApiException } from '@/lib/api-utils';

export const ALLOWED_ROLES = ['student', 'instructor', 'admin', 'super_admin'] as const;
export type Role = typeof ALLOWED_ROLES[number];

const SUPER_ONLY: readonly Role[] = ['admin', 'super_admin'];

export function assertRoleAssignable(
  targetRole: unknown,
  actorRole: string | undefined,
): asserts targetRole is Role | undefined {
  if (targetRole === undefined || targetRole === null) return;
  if (typeof targetRole !== 'string' || !ALLOWED_ROLES.includes(targetRole as Role)) {
    throw new ApiException(`Invalid role: ${String(targetRole)}`, 400);
  }
  if (SUPER_ONLY.includes(targetRole as Role) && actorRole !== 'super_admin') {
    throw new ApiException('Only super admins can assign admin or super_admin roles', 403);
  }
}
