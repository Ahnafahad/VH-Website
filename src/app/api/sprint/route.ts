/**
 * GET /api/sprint
 * Lists every active Sprint set, with the caller's own attempt (if any).
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireSprintAccess } from '@/lib/sprint/route-helpers';
import { listActiveSetsForUser } from '@/lib/sprint/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireSprintAccess();
    return { sets: await listActiveSetsForUser(user.id) };
  });
}
