/**
 * GET /api/admin/essays/graders — active staff who can mark scripts.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireEssayStaff } from '@/lib/essays/route-helpers';
import { listGraders } from '@/lib/essays/service';

export async function GET() {
  return safeApiHandler(async () => {
    await requireEssayStaff();
    return { graders: await listGraders() };
  });
}
