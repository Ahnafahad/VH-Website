/**
 * GET /api/essays — the caller's visible essay series with a status per essay.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/essays/route-helpers';
import { listSeriesForStudent } from '@/lib/essays/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    return { series: await listSeriesForStudent(user) };
  });
}
