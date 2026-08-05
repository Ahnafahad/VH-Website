/**
 * GET /api/leaderboard
 *
 * Multi-board leaderboard: LexiCore, Latest Test, All Tests (cumulative).
 * Scoped to the signed-in user's own batch × product (no cross-batch
 * selector — see build report). Each board returns the full ranked list;
 * the client splits it into a top-20 default view + a "show all" expansion.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { getViewerBatch, getLexiCoreBoard, getLatestTestBoard, getAllTestsBoard } from '@/lib/leaderboard/read';

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const user = await getUserByEmail(email);
    if (!user) throw new ApiException('User not found', 404);

    const batch = await getViewerBatch(user);
    if (!batch) {
      return {
        batch: null,
        boards: {
          lexicore: [],
          latestTest: { entries: [], testTitle: null },
          allTests: [],
        },
      };
    }

    const [lexicore, latestTest, allTests] = await Promise.all([
      getLexiCoreBoard(batch),
      getLatestTestBoard(batch),
      getAllTestsBoard(batch),
    ]);

    return {
      batch: { name: batch.name, product: batch.product },
      boards: { lexicore, latestTest, allTests },
    };
  }, '/api/leaderboard');
}
