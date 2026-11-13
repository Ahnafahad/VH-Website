/**
 * GET /api/admin/mocks/[id]/leaderboard
 * Staff view of one mock's combined (MCQ + essay) leaderboard: every ranked student, not just the top
 * 10 that students see. Rejected OMR papers are left out of the ranking, as they are for students.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { getMockAdminLeaderboard } from '@/lib/mocks/service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const board = await getMockAdminLeaderboard(Number((await params).id));
    if (!board) throw new ApiException('Mock not found', 404, 'MOCK_NOT_FOUND');
    return board;
  });
}
