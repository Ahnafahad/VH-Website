/**
 * GET /api/admin/printdesk — every print request with its student and materials (staff).
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { listRequestsForStaff } from '@/lib/printdesk/service';

export async function GET() {
  return safeApiHandler(async () => {
    await requireStaff();
    return { requests: await listRequestsForStaff() };
  });
}
