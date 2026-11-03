/**
 * GET /api/mocks
 * Mocks the caller may sit (published, batch/product matched), with window state, their attempt
 * status, result phase and essay progress.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { getMockListForUser, ensureStudentId } from '@/lib/mocks/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const [mocks, studentId] = await Promise.all([getMockListForUser(user), ensureStudentId(user)]);
    return { mocks, studentId };
  });
}
