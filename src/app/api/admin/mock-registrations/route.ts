/**
 * GET /api/admin/mock-registrations
 * Admin-only (payment proof + phone numbers): every mock registration with a short-lived screenshot URL.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { isAdminRole } from '@/lib/auth/roles';
import { listRegistrations } from '@/lib/mocks/registration';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireStaff();
    if (!isAdminRole(user.role)) throw new ApiException('Admin access required', 403, 'FORBIDDEN');
    return { registrations: await listRegistrations() };
  });
}
