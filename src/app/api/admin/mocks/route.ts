/**
 * GET /api/admin/mocks
 * Staff overview: every mock with windows, attempt/scan counts, essay progress, plus the tests and
 * essay series a mock can be built from.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { getMockAdminOverview } from '@/lib/mocks/service';

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    return getMockAdminOverview();
  });
}
