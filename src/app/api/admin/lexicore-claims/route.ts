/** GET /api/admin/lexicore-claims → every LexiCore bKash claim, newest first (admin only). */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { isAdminRole } from '@/lib/auth/roles';
import { listClaims } from '@/lib/vocab/plan-claims';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireStaff();
    if (!isAdminRole(user.role)) throw new ApiException('Admin access required', 403, 'FORBIDDEN');
    return { claims: await listClaims() };
  });
}
