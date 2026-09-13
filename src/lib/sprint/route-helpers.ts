import { ApiException } from '@/lib/api-utils';
import type { UserWithProducts } from '@/lib/db/schema';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessSprint, isSprintStaff } from './access';

export { requireUser };

export async function requireSprintStaff(): Promise<UserWithProducts> {
  const user = await requireUser();
  if (!isSprintStaff(user)) {
    throw new ApiException('Instructor or admin access required', 403, 'FORBIDDEN');
  }
  return user;
}

export async function requireSprintAccess(): Promise<UserWithProducts> {
  const user = await requireUser();
  if (!canAccessSprint(user) && !isSprintStaff(user)) {
    throw new ApiException('You do not have access to Sprint', 403, 'SPRINT_ACCESS_DENIED');
  }
  return user;
}
