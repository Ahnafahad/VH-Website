/**
 * DELETE /api/lms/questions/[id] — delete a question (author or staff only)
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classQuestions } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';

function isStaffRole(role: string) {
  return role === 'admin' || role === 'super_admin' || role === 'instructor';
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const questionId = parseInt(id, 10);
    if (isNaN(questionId)) throw new ApiException('Invalid id', 400);

    const question = await db
      .select()
      .from(classQuestions)
      .where(eq(classQuestions.id, questionId))
      .get();
    if (!question) throw new ApiException('Question not found', 404);

    const isAuthor = question.userId === user.id;
    const isStaff = isStaffRole(user.role);

    if (!isAuthor && !isStaff) {
      throw new ApiException('You can only delete your own questions', 403, 'FORBIDDEN');
    }

    await db.delete(classQuestions).where(eq(classQuestions.id, questionId));

    return { deleted: true };
  });
}
