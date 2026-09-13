import { ApiException } from '@/lib/api-utils';
import type { UserWithProducts } from '@/lib/db/schema';
import { requireUser } from '@/lib/tests/route-helpers';
import { isStaffRole } from '@/lib/auth/roles';

export { requireUser };

/** Instructors + admins — matches the user's explicit "instructors get it too" call. */
export async function requireReadingSpeedStaff(): Promise<UserWithProducts> {
  const user = await requireUser();
  if (!isStaffRole(user.role)) {
    throw new ApiException('Instructor or admin access required', 403, 'FORBIDDEN');
  }
  return user;
}
