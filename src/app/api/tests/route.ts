/**
 * GET /api/tests
 * List published tests (both buckets) with window states and the caller's
 * attempt status. Access-filtered per tests.allowedProducts.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessTest } from '@/lib/tests/access';
import { getTestListForUser } from '@/lib/tests/service';
import { db } from '@/lib/db';
import { tests } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const list = await getTestListForUser(user.id);
    if (list.length === 0) return { tests: [] };

    const rows = await db.select().from(tests)
      .where(inArray(tests.id, list.map(t => t.id)));
    const accessible = new Set(
      rows.filter(t => canAccessTest(user, t)).map(t => t.id),
    );
    return { tests: list.filter(t => accessible.has(t.id)) };
  });
}
