/**
 * GET /api/admin/sprint/sets
 * Lists every Sprint set (draft + active) for admin management.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireSprintStaff } from '@/lib/sprint/route-helpers';
import { listAllSetsForAdmin } from '@/lib/sprint/service';

export async function GET() {
  return safeApiHandler(async () => {
    await requireSprintStaff();
    return { sets: await listAllSetsForAdmin() };
  });
}
