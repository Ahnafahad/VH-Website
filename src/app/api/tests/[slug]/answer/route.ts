/**
 * POST /api/tests/[slug]/answer
 * Body: { questionId: number, selectedKey?: string | null, flagged?: boolean }
 * Upserts one answer for the caller's in-progress attempt (autosave).
 * selectedKey null clears the answer; flagged toggles review flag.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAnswers, testQuestions, testSections } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireTestForUser } from '@/lib/tests/route-helpers';
import { getUserAttempt } from '@/lib/tests/service';
import { attemptDeadline } from '@/lib/tests/windows';

const bodySchema = z.object({
  questionId: z.number().int().positive(),
  selectedKey: z.string().max(2).nullable().optional(),
  flagged: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug } = await params;
    const { test, windows } = await requireTestForUser(slug, user);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const { questionId, selectedKey, flagged } = parsed.data;

    const attempt = await getUserAttempt(test.id, user.id);
    if (!attempt || attempt.status !== 'in_progress') {
      throw new ApiException('No in-progress attempt', 409, 'NO_ATTEMPT');
    }
    const window = windows.find(w => w.id === attempt.windowId);
    if (!window || attemptDeadline(attempt, window).getTime() <= Date.now()) {
      throw new ApiException('Time is up for this attempt', 409, 'TIME_UP');
    }

    // Verify the question belongs to this test
    const question = await db
      .select({ id: testQuestions.id })
      .from(testQuestions)
      .innerJoin(testSections, eq(testQuestions.sectionId, testSections.id))
      .where(and(eq(testQuestions.id, questionId), eq(testSections.testId, test.id)))
      .get();
    if (!question) throw new ApiException('Question not in this test', 400);

    const existing = await db.select().from(testAnswers)
      .where(and(eq(testAnswers.attemptId, attempt.id), eq(testAnswers.questionId, questionId)))
      .get();

    if (existing) {
      await db.update(testAnswers).set({
        ...(selectedKey !== undefined ? { selectedKey } : {}),
        ...(flagged !== undefined ? { flagged } : {}),
        answeredAt: new Date(),
      }).where(eq(testAnswers.id, existing.id));
    } else {
      await db.insert(testAnswers).values({
        attemptId: attempt.id,
        questionId,
        selectedKey: selectedKey ?? null,
        flagged: flagged ?? false,
      });
    }

    return { saved: true };
  });
}
