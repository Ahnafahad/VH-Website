/**
 * GET /api/lms/dashboard
 * Student aggregate: last class, next class, week schedule, assignments,
 * upcoming tests, announcements. Staff bypass access checks.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { getDashboardData } from '@/lib/lms/dashboard-data';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    return getDashboardData(user);
  });
}
