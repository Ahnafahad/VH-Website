/**
 * GET /api/mocks/[slug]/result
 * { phase: 'locked' | 'provisional' | 'official', ... } — see lib/mocks/state.ts.
 * Provisional = own answers scored, shown 10 min after the last window closes; official = staff
 * published (OMR scans in, essays marked). Staff always get the official view.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { getMockResult } from '@/lib/mocks/service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug } = await params;
    const result = await getMockResult(user, slug);
    if (!result) throw new ApiException('Mock not found', 404, 'MOCK_NOT_FOUND');
    return result;
  });
}
