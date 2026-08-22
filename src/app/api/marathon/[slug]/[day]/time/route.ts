/**
 * POST /api/marathon/[slug]/[day]/time
 * Body: { questionId: number, deltaMs: number }
 * Client heartbeat that accumulates active on-screen time for one question.
 * The client is responsible for not sending time accrued while paused or
 * while the tab is hidden; the server just adds whatever delta it's given,
 * clamped to a sane per-heartbeat ceiling so a stalled tab can't inflate a
 * question's time after being backgrounded for hours.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser, requireUnlockedDayForUser } from '@/lib/marathon/route-helpers';
import { requireInProgressAttempt, addQuestionTime } from '@/lib/marathon/service';
import { db } from '@/lib/db';
import { marathonQuestions } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

// Heartbeats fire every ~4s client-side; 30s is a generous ceiling that still
// blocks a backgrounded-tab timer drift from padding a question's time.
const MAX_DELTA_MS = 30_000;

const bodySchema = z.object({
  questionId: z.number().int().positive(),
  deltaMs: z.number().int().positive().max(MAX_DELTA_MS),
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
    const { questionId, deltaMs } = parsed.data;

    const { day: dayRow } = await requireUnlockedDayForUser(slug, dayNumber, user);
    const attempt = await requireInProgressAttempt(dayRow.id, user.id);
    if (attempt.pausedAt) throw new ApiException('Attempt is paused', 409, 'ATTEMPT_PAUSED');

    const question = await db.select({ id: marathonQuestions.id }).from(marathonQuestions)
      .where(and(eq(marathonQuestions.id, questionId), eq(marathonQuestions.dayId, dayRow.id))).get();
    if (!question) throw new ApiException('Question not in this day', 400);

    await addQuestionTime(attempt.id, questionId, deltaMs);
    return { saved: true };
  });
}
