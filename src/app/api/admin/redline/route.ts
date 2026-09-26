/**
 * GET   /api/admin/redline   cohort analytics (skills heatmap, level funnel, students, question stats)
 * PATCH /api/admin/redline   body: { active: boolean } — switches the module on/off for students
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireRedlineStaff } from '@/lib/redline/route-helpers';
import { getCohort, setActive } from '@/lib/redline/service';

export async function GET() {
  return safeApiHandler(async () => {
    await requireRedlineStaff();
    return getCohort();
  });
}

export async function PATCH(req: Request) {
  return safeApiHandler(async () => {
    await requireRedlineStaff();
    const body = await req.json().catch(() => ({}));
    if (typeof body?.active !== 'boolean') throw new ApiException('active must be a boolean', 400);
    await setActive(body.active);
    return { active: body.active };
  });
}
