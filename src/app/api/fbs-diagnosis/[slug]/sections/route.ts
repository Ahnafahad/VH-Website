/**
 * GET /api/fbs-diagnosis/[slug]/sections
 * Section list for the diagnostic subject picker. Marks each section as
 * compulsory (English) or elective (the rest). Also reports whether the caller
 * already has an attempt (so the take page can skip the picker on resume).
 * Requires auth. 404 if the test is not a diagnostic. No answer keys leak.
 */

import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testSections, testWindows, testAttempts } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireTestForUser } from '@/lib/tests/route-helpers';
import { isCompulsorySection } from '@/lib/tests/diagnostic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug } = await params;
    const { test, windows } = await requireTestForUser(slug, user);

    if (!test.isDiagnostic) {
      throw new ApiException('Diagnostic test not found', 404, 'TEST_NOT_FOUND');
    }

    const onlineWindow = windows.find(w => w.mode === 'online');

    const sectionRows = await db.select().from(testSections)
      .where(eq(testSections.testId, test.id));

    const sections = sectionRows
      .sort((a, b) => a.order - b.order)
      .map(s => ({
        id: s.id,
        title: s.title,
        order: s.order,
        compulsory: isCompulsorySection(s.title),
      }));

    const attempt = await db.select().from(testAttempts)
      .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.userId, user.id)))
      .get();

    return {
      test: {
        slug: test.slug,
        title: test.title,
        durationMinutes: onlineWindow?.durationMinutes ?? null,
        windowId: onlineWindow?.id ?? null,
      },
      sections,
      alreadyStarted: attempt?.status === 'in_progress',
      alreadySubmitted: attempt?.status === 'submitted',
    };
  });
}
