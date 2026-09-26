/**
 * GET /api/redline/overview
 * Level path + the caller's analysis dashboard. Students see { active: false } while the module is off.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireRedlineAccess } from '@/lib/redline/route-helpers';
import { isRedlineStaff } from '@/lib/redline/access';
import { getConfig, getOverview } from '@/lib/redline/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireRedlineAccess();
    const { active } = await getConfig();
    const staff = isRedlineStaff(user);
    if (!active && !staff) return { active: false, staff };
    return { active, staff, ...(await getOverview(user.id)) };
  });
}
