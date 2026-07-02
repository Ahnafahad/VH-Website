/**
 * GET /api/tests/[slug]/results
 * The caller's results + class stats + question analytics + answer key.
 * Students: only after results are visible (all windows closed or admin
 * force-published). Staff: always.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireTestForUser } from '@/lib/tests/route-helpers';
import { isTestStaff } from '@/lib/tests/access';
import { resultsVisible } from '@/lib/tests/windows';
import { getTestResults } from '@/lib/tests/service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug } = await params;
    const { test, windows } = await requireTestForUser(slug, user);

    if (!isTestStaff(user) && !resultsVisible(test, windows)) {
      throw new ApiException(
        'Results will be available once the test window closes',
        403,
        'RESULTS_NOT_PUBLISHED',
      );
    }

    const results = await getTestResults(test.id, user.id);
    if (!results) throw new ApiException('Test not found', 404);
    return results;
  });
}
