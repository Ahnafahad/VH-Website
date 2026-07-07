/**
 * POST /api/lms/assignments/[id]/submit
 * Student submits (or resubmits) their homework for an assignment.
 *
 * Body: { fileUrl?: string; note?: string }
 * At least one of fileUrl or note must be provided.
 * Resubmission is allowed while status !== 'reviewed'.
 */

import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assignments, assignmentSubmissions } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';
import { resolveFileUrl } from '@/lib/storage/r2';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const assignmentId = parseInt(id, 10);
    if (isNaN(assignmentId)) throw new ApiException('Invalid id', 400);

    // Load assignment and check scope
    const assignment = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .get();
    if (!assignment) throw new ApiException('Assignment not found', 404);

    if (
      !canAccessLmsContent(user, {
        product: assignment.product,
        batch: assignment.batch,
      })
    ) {
      throw new ApiException('Access denied', 403, 'FORBIDDEN');
    }

    const body = (await req.json()) as { fileUrl?: string; note?: string };
    const fileUrl = typeof body.fileUrl === 'string' && body.fileUrl.trim() ? body.fileUrl.trim() : null;
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    if (!fileUrl && !note) {
      throw new ApiException('At least a file or a note is required', 400, 'MISSING_CONTENT');
    }

    // Check for existing submission
    const existing = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.userId, user.id),
        ),
      )
      .get();

    if (existing?.status === 'reviewed') {
      throw new ApiException(
        'This submission has already been reviewed and cannot be resubmitted',
        409,
        'ALREADY_REVIEWED',
      );
    }

    const now = new Date();

    if (existing) {
      // Resubmit: update the existing row
      const [updated] = await db
        .update(assignmentSubmissions)
        .set({
          fileUrl,
          note,
          status: 'submitted',
          submittedAt: now,
          instructorComment: null,
          reviewedAt: null,
        })
        .where(eq(assignmentSubmissions.id, existing.id))
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
    }

    // New submission
    const [inserted] = await db
      .insert(assignmentSubmissions)
      .values({
        assignmentId,
        userId: user.id,
        fileUrl,
        note,
        status: 'submitted',
        submittedAt: now,
      })
      .returning();

    return {
      id: inserted.id,
      assignmentId: inserted.assignmentId,
      userId: inserted.userId,
      status: inserted.status,
      fileUrl: await resolveFileUrl(inserted.fileUrl),
      note: inserted.note,
      instructorComment: inserted.instructorComment,
      submittedAt: inserted.submittedAt.getTime(),
      reviewedAt: inserted.reviewedAt?.getTime() ?? null,
    };
  });
}
