/**
 * POST /api/tests/[slug]/start
 * Body: { windowId: number }
 * Creates the caller's attempt for this test in the window's mode, or resumes
 * an in-progress one. One attempt per student per test — a submitted or banned
 * attempt blocks starting again (admin can reset).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts, testSections } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireTestForUser } from '@/lib/tests/route-helpers';
import { effectiveWindowState, attemptDeadline } from '@/lib/tests/windows';
import { pickAttemptedSections } from '@/lib/tests/diagnostic';

// electiveSectionIds: required (exactly test.electiveCount of them) for elective-subject mocks, ignored otherwise.
const bodySchema = z.object({
  windowId: z.number().int().positive(),
  electiveSectionIds: z.array(z.number().int().positive()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug } = await params;
    const { test, windows } = await requireTestForUser(slug, user);

    if (test.isDiagnostic) {
      throw new ApiException('Use the diagnostic start endpoint', 400, 'USE_DIAGNOSTIC_START');
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);

    const window = windows.find(w => w.id === parsed.data.windowId);
    if (!window) throw new ApiException('Window not found for this test', 404);
    if (effectiveWindowState(window) !== 'open') {
      throw new ApiException('This test window is not open', 409, 'WINDOW_NOT_OPEN');
    }

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
      // Resume in-progress attempt (same mode only)
      if (existing.mode !== window.mode) {
        throw new ApiException(
          `You already started this test in ${existing.mode} mode`, 409, 'MODE_LOCKED',
        );
      }
      return {
        attemptId: existing.id,
        resumed: true,
        deadline: attemptDeadline(existing, window).getTime(),
      };
    }

    let chosenSections: string | undefined;
    if (test.electiveCount != null) {
      const sections = await db.select({ id: testSections.id, title: testSections.title })
        .from(testSections).where(eq(testSections.testId, test.id));
      const attempted = pickAttemptedSections(sections, parsed.data.electiveSectionIds ?? [], test.electiveCount);
      if (!attempted) {
        throw new ApiException(`Choose exactly ${test.electiveCount} subjects`, 400, 'INVALID_SELECTION');
      }
      chosenSections = JSON.stringify(attempted);
    }

    const [created] = await db.insert(testAttempts).values({
      testId: test.id,
      userId: user.id,
      windowId: window.id,
      mode: window.mode,
      status: 'in_progress',
      startedAt: new Date(),
      ...(chosenSections ? { chosenSections } : {}),
    }).returning();

    return {
      attemptId: created.id,
      resumed: false,
      deadline: attemptDeadline(created, window).getTime(),
    };
  });
}
