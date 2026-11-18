/** POST /api/vocab/plan/claim  { trxId, senderNumber?, screenshotKey? } → files a bKash claim, emails the owner. */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { rateLimit } from '@/lib/rate-limit';
import { requireUser } from '@/lib/tests/route-helpers';
import { getPlanStatus, submitClaim } from '@/lib/vocab/plan-claims';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    if (!rateLimit(`${user.id}:lexicore_claim`, 5, 60 * 60_000)) throw new ApiException('Too many attempts. Try again later.', 429);
    await submitClaim(user.id, (await req.json()) as Record<string, unknown>);
    return getPlanStatus(user.id);
  });
}
