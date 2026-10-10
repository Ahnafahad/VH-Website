/**
 * GET /api/essays/overview — the caller's published essay results across series (trend charts).
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/essays/route-helpers';
import { getStudentOverview } from '@/lib/essays/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    return getStudentOverview(user);
  });
}
