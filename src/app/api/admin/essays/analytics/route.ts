/**
 * GET /api/admin/essays/analytics — per-series stats, per-student trends, and
 * (admins only) per-grader averages.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireEssayStaff } from '@/lib/essays/route-helpers';
import { getAnalytics } from '@/lib/essays/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    return getAnalytics(user);
  });
}
