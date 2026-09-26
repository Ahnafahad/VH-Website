/**
 * POST /api/redline/attempts/[attemptId]/finish
 * Marks the attempt finished (unlocking the next level) and returns the level summary.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireRedlineOpen } from '@/lib/redline/route-helpers';
import { finishAttempt } from '@/lib/redline/service';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireRedlineOpen();
    const attemptId = Number((await params).attemptId);
    if (!Number.isInteger(attemptId)) throw new ApiException('Invalid attempt', 400);
    return finishAttempt(user.id, attemptId);
  });
}
