/** GET /api/vocab/plan → the signed-in user's LexiCore plan: unlimited?, today's usage, limits, price, latest claim. */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { getPlanStatus } from '@/lib/vocab/plan-claims';

/** ?code=MAGNUS100 → price with that discount (400 if the code is unknown). */
export async function GET(req: NextRequest) {
  return safeApiHandler(async () => getPlanStatus((await requireUser()).id, req.nextUrl.searchParams.get('code')));
}
