/**
 * Shared request-scope helpers for /api/tests and /api/admin/tests routes.
 */

import { validateAuth, ApiException } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import type { Test, TestWindow, UserWithProducts } from '@/lib/db/schema';
import { canAccessTest, isTestStaff } from './access';
import { getPublishedTestBySlug } from './service';

export async function requireUser(): Promise<UserWithProducts> {
  const { email } = await validateAuth();
  const user = await getUserByEmail(email);
  if (!user) throw new ApiException('User not found', 404, 'USER_NOT_FOUND');
  return user;
}

export async function requireStaff(): Promise<UserWithProducts> {
  const user = await requireUser();
  if (!isTestStaff(user)) {
    throw new ApiException('Instructor or admin access required', 403, 'FORBIDDEN');
  }
  return user;
}

export async function requireTestForUser(
  slug: string,
  user: UserWithProducts,
): Promise<{ test: Test; windows: TestWindow[] }> {
  const found = await getPublishedTestBySlug(slug);
  if (!found) throw new ApiException('Test not found', 404, 'TEST_NOT_FOUND');
  if (!canAccessTest(user, found.test)) {
    throw new ApiException('You do not have access to this test', 403, 'TEST_ACCESS_DENIED');
  }
  return found;
}
