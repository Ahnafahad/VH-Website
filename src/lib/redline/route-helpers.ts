import { ApiException } from '@/lib/api-utils';
import type { UserWithProducts } from '@/lib/db/schema';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessRedline, isRedlineStaff } from './access';
import { getConfig } from './service';

export { requireUser };

export async function requireRedlineStaff(): Promise<UserWithProducts> {
  const user = await requireUser();
  if (!isRedlineStaff(user)) {
    throw new ApiException('Instructor or admin access required', 403, 'FORBIDDEN');
  }
  return user;
}

/** Any signed-in user who may open Redline (does NOT check the on/off switch). */
export async function requireRedlineAccess(): Promise<UserWithProducts> {
  const user = await requireUser();
  if (!canAccessRedline(user)) {
    throw new ApiException('Redline is not available for your account', 403, 'REDLINE_ACCESS_DENIED');
  }
  return user;
}

/** Access + the module must be switched on (staff always pass). */
export async function requireRedlineOpen(): Promise<UserWithProducts> {
  const user = await requireRedlineAccess();
  if (!isRedlineStaff(user) && !(await getConfig()).active) {
    throw new ApiException('Redline is not open yet', 403, 'REDLINE_INACTIVE');
  }
  return user;
}
