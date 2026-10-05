import { ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { isOperationalAdmin } from './operations';

export async function requireOperationalAdmin() {
  const user = await requireUser();
  if (!isOperationalAdmin(user.role)) {
    throw new ApiException('Admin access required', 403, 'FORBIDDEN');
  }
  return user;
}
