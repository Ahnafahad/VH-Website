/**
 * POST /api/fbs-diagnosis/[slug]/start
 * Body: { windowId: number, electiveSectionIds: number[] }
 * Starts (or resumes) the caller's diagnostic attempt AFTER they pick exactly 2
 * of the 3 elective subjects. attemptedSectionIds = [both compulsory English
 * sections, ...the 2 chosen electives] (4 sections = 40 marks). The 30-minute
 * timer begins at attempt creation. Resuming an in-progress attempt keeps its
 * existing selection (no re-choosing).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testSections, testAttempts } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireTestForUser } from '@/lib/tests/route-helpers';
import { effectiveWindowState, attemptDeadline } from '@/lib/tests/windows';
import { isCompulsorySection } from '@/lib/tests/diagnostic';

const bodySchema = z.object({
  windowId: z.number().int().positive(),
  electiveSectionIds: z.array(z.number().int().positive()),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug } = await params;
    const { test, windows } = await requireTestForUser(slug, user);

    if (!test.isDiagnostic) {
      throw new ApiException('This is not a diagnostic test', 400, 'NOT_DIAGNOSTIC');
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);

    const window = windows.find(w => w.id === parsed.data.windowId);
    if (!window) throw new ApiException('Window not found for this test', 404);
    if (effectiveWindowState(window) !== 'open') {
      throw new ApiException('This test window is not open', 409, 'WINDOW_NOT_OPEN');
    }

    // Derive compulsory vs elective from section titles.
    const sectionRows = await db.select().from(testSections)
      .where(eq(testSections.testId, test.id));
    const compulsoryIds = sectionRows.filter(s => isCompulsorySection(s.title)).map(s => s.id);
    const electiveIds = new Set(sectionRows.filter(s => !isCompulsorySection(s.title)).map(s => s.id));

    // Validate the 2 chosen electives: exactly 2 distinct, each an elective of this test.
    const chosen = parsed.data.electiveSectionIds;
    const distinct = new Set(chosen);
    if (chosen.length !== 2 || distinct.size !== 2) {
      throw new ApiException('Choose exactly 2 elective subjects', 400, 'INVALID_SELECTION');
    }
    if (![...distinct].every(id => electiveIds.has(id))) {
      throw new ApiException('Invalid elective subject selection', 400, 'INVALID_SELECTION');
    }

    const attemptedSectionIds = [...compulsoryIds, ...chosen];

    const existing = await db.select().from(testAttempts)
      .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.userId, user.id)))
      .get();

    if (existing) {
      if (existing.status === 'banned') {
        throw new ApiException('You are banned from this test. Contact an admin.', 403, 'ATTEMPT_BANNED');
      }
      if (existing.status === 'submitted') {
        throw new ApiException('You have already submitted this test', 409, 'ALREADY_SUBMITTED');
      }
      if (existing.mode !== window.mode) {
        throw new ApiException(
          `You already started this test in ${existing.mode} mode`, 409, 'MODE_LOCKED',
        );
      }
      // Resume an in-progress attempt as-is — the selection is already locked.
      return {
        attemptId: existing.id,
        resumed: true,
        deadline: attemptDeadline(existing, window).getTime(),
      };
    }

    const [created] = await db.insert(testAttempts).values({
      testId: test.id,
      userId: user.id,
      windowId: window.id,
      mode: window.mode,
      status: 'in_progress',
      startedAt: new Date(),
      chosenSections: JSON.stringify(attemptedSectionIds),
    }).returning();

    return {
      attemptId: created.id,
      resumed: false,
      deadline: attemptDeadline(created, window).getTime(),
    };
  });
}
