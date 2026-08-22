/**
 * GET /api/marathon
 * Lists every marathon chapter assigned to the caller, with each day's lock
 * state and the caller's own attempt (if any).
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/marathon/route-helpers';
import { getMarathonOverviewForUser } from '@/lib/marathon/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    return { chapters: await getMarathonOverviewForUser(user) };
  });
}
