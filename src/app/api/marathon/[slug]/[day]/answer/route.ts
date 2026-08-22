/**
 * POST /api/marathon/[slug]/[day]/answer
 * Body: { questionId: number, selectedKey: string | null }
 * Upserts one answer for the caller's in-progress attempt (autosave).
 * selectedKey null clears the answer (explicit skip).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireUnlockedDayForUser } from '@/lib/marathon/route-helpers';
import { requireInProgressAttempt, upsertAnswer } from '@/lib/marathon/service';
import { db } from '@/lib/db';
import { marathonQuestions } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

const bodySchema = z.object({
  questionId: z.number().int().positive(),
  selectedKey: z.string().max(2).nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; day: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { slug, day } = await params;
    const dayNumber = Number(day);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) throw new ApiException('Invalid day', 400);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);
    const { questionId, selectedKey } = parsed.data;

    const { day: dayRow } = await requireUnlockedDayForUser(slug, dayNumber, user);
    const attempt = await requireInProgressAttempt(dayRow.id, user.id);

    const question = await db.select({ id: marathonQuestions.id }).from(marathonQuestions)
      .where(and(eq(marathonQuestions.id, questionId), eq(marathonQuestions.dayId, dayRow.id))).get();
    if (!question) throw new ApiException('Question not in this day', 400);

    await upsertAnswer(attempt.id, questionId, selectedKey);
    return { saved: true };
  });
}
