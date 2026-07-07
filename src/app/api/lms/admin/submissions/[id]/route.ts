/**
 * POST /api/lms/admin/submissions/[id]/review
 * Mark a submission as reviewed with an optional instructor comment.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assignmentSubmissions } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { resolveFileUrl } from '@/lib/storage/r2';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) throw new ApiException('Invalid id', 400);

    const existing = await db
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.id, submissionId))
      .get();
    if (!existing) throw new ApiException('Submission not found', 404);

    const body = (await req.json()) as { instructorComment?: string };
    const instructorComment =
      typeof body.instructorComment === 'string' && body.instructorComment.trim()
        ? body.instructorComment.trim()
        : null;

    const [updated] = await db
      .update(assignmentSubmissions)
      .set({
        status: 'reviewed',
        instructorComment,
        reviewedAt: new Date(),
      })
      .where(eq(assignmentSubmissions.id, submissionId))
      .returning();

    return {
      id: updated.id,
      assignmentId: updated.assignmentId,
      userId: updated.userId,
      status: updated.status,
      fileUrl: await resolveFileUrl(updated.fileUrl),
      note: updated.note,
      instructorComment: updated.instructorComment,
      submittedAt: updated.submittedAt.getTime(),
      reviewedAt: updated.reviewedAt?.getTime() ?? null,
    };
  });
}
