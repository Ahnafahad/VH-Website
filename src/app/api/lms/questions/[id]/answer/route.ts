/**
 * POST /api/lms/questions/[id]/answer
 * Staff answers a question. Inserts a new classQuestions row with parentId set.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classQuestions } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';

const MAX_BODY_LENGTH = 2000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const staff = await requireStaff();
    const { id } = await params;
    const questionId = parseInt(id, 10);
    if (isNaN(questionId)) throw new ApiException('Invalid id', 400);

    // Load parent question
    const parent = await db
      .select()
      .from(classQuestions)
      .where(eq(classQuestions.id, questionId))
      .get();
    if (!parent) throw new ApiException('Question not found', 404);

    // Answers cannot themselves be answered (parentId must be a top-level question)
    if (parent.parentId !== null) {
      throw new ApiException('Cannot answer an answer', 400, 'CANNOT_ANSWER_ANSWER');
    }

    const body = (await req.json()) as { body?: string };
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!text) throw new ApiException('Answer body is required', 400);
    if (text.length > MAX_BODY_LENGTH) {
      throw new ApiException(`Answer must be at most ${MAX_BODY_LENGTH} characters`, 400);
    }

    const [inserted] = await db
      .insert(classQuestions)
      .values({
        sessionId: parent.sessionId,
        userId: staff.id,
        parentId: questionId,
        body: text,
      })
      .returning();

    return {
      id: inserted.id,
      sessionId: inserted.sessionId,
      parentId: inserted.parentId,
      userId: inserted.userId,
      userName: staff.name,
      isStaff: true,
      isOwn: true,
      body: inserted.body,
      createdAt: inserted.createdAt.getTime(),
    };
  });
}
