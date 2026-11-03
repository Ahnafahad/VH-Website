/**
 * GET /api/mocks/[slug]/omr-sheet → { url } presigned link to the marked OMR sheet.
 * Own attempt only; staff may pass ?userId= to view anyone's.
 */

import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { isTestStaff } from '@/lib/tests/access';
import { getPublishedTestBySlug } from '@/lib/tests/service';
import { r2PresignGet } from '@/lib/storage/r2';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug } = await params;
    const found = await getPublishedTestBySlug(slug);
    if (!found || !found.test.isMock) throw new ApiException('Mock not found', 404, 'MOCK_NOT_FOUND');

    const asked = Number(req.nextUrl.searchParams.get('userId'));
    const userId = isTestStaff(user) && Number.isInteger(asked) && asked > 0 ? asked : user.id;
    const attempt = await db.select({ key: testAttempts.omrImageKey }).from(testAttempts)
      .where(and(eq(testAttempts.testId, found.test.id), eq(testAttempts.userId, userId))).get();
    if (!attempt?.key) throw new ApiException('No OMR sheet on file', 404, 'NO_OMR_SHEET');
    return { url: await r2PresignGet(attempt.key, 600) };
  });
}
