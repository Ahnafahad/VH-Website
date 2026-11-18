/** GET /api/vocab/plan → the signed-in user's LexiCore plan: unlimited?, today's usage, limits, price, latest claim. */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { getPlanStatus } from '@/lib/vocab/plan-claims';

export async function GET() {
  return safeApiHandler(async () => getPlanStatus((await requireUser()).id));
}
