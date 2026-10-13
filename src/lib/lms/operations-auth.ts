import { ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { isOperationalAdmin } from './operations';
import { assertMoneyAccess } from '@/lib/super/finance/money-gate';

export async function requireOperationalAdmin() {
  const user = await requireUser();
  if (!isOperationalAdmin(user.role)) {
    throw new ApiException('Admin access required', 403, 'FORBIDDEN');
  }
  await assertMoneyAccess(user.role);
  return user;
}
