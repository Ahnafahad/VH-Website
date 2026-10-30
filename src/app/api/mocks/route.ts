/**
 * GET /api/mocks
 * Mocks the caller may sit (published, batch/product matched), with window state, their attempt
 * status, result phase and essay progress.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { getMockListForUser } from '@/lib/mocks/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    return { mocks: await getMockListForUser(user) };
  });
}
