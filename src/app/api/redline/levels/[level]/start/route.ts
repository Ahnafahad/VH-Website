/**
 * POST /api/redline/levels/[level]/start   body: { replay?: boolean }
 * Opens (or resumes) the caller's attempt at a level. The next level only opens once the previous one
 * has a finished attempt. Questions come back WITHOUT keys, proofs or explanations.
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireRedlineOpen } from '@/lib/redline/route-helpers';
import { startLevel } from '@/lib/redline/service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ level: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireRedlineOpen();
    const level = Number((await params).level);
    if (!Number.isInteger(level) || level < 1) throw new ApiException('Invalid level', 400);
    const body = await req.json().catch(() => ({}));
    return startLevel(user, level, body?.replay === true);
  });
}
