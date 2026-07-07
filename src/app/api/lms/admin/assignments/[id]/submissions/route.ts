/**
 * GET /api/lms/admin/assignments/[id]/submissions
 * Returns all submissions for an assignment, including students in scope
 * who have NOT submitted (status 'pending').
 */

import { NextRequest } from 'next/server';
import { eq, and, inArray, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assignments,
  assignmentSubmissions,
  users,
  userAccess,
} from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { resolveFileUrl } from '@/lib/storage/r2';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const { id } = await params;
    const assignmentId = parseInt(id, 10);
    if (isNaN(assignmentId)) throw new ApiException('Invalid id', 400);

    const assignment = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .get();
    if (!assignment) throw new ApiException('Assignment not found', 404);

    // Get all students in scope for this assignment
    const accessRows = await db
      .select({ userId: userAccess.userId })
      .from(userAccess)
      .where(
        and(
          eq(userAccess.product, assignment.product),
          eq(userAccess.active, true),
        ),
      );

    const scopedUserIds = accessRows.map((r) => r.userId);

    if (scopedUserIds.length === 0) {
      return { assignment: serializeAssignment(assignment), submissions: [] };
    }

    // Filter by batch if set
    const batchCondition =
      assignment.batch === null
        ? undefined
        : or(eq(users.batch, assignment.batch), isNull(users.batch));

    const scopedStudents = await db
      .select({ id: users.id, name: users.name, email: users.email, batch: users.batch })
      .from(users)
      .where(
        and(
          inArray(users.id, scopedUserIds),
          eq(users.status, 'active'),
          eq(users.role, 'student'),
          batchCondition,
        ),
      );

    if (scopedStudents.length === 0) {
      return { assignment: serializeAssignment(assignment), submissions: [] };
    }

    // Get existing submissions
    const existingSubmissions = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          inArray(
            assignmentSubmissions.userId,
            scopedStudents.map((s) => s.id),
          ),
        ),
      );

    const subMap = new Map(existingSubmissions.map((s) => [s.userId, s]));

    // Merge: all scoped students with their submission status
    const submissions = await Promise.all(
      scopedStudents.map(async (student) => {
        const sub = subMap.get(student.id);
        if (sub) {
          return {
            id: sub.id,
            userId: student.id,
            name: student.name,
            email: student.email,
            batch: student.batch,
            status: sub.status,
            fileUrl: await resolveFileUrl(sub.fileUrl),
            note: sub.note,
            instructorComment: sub.instructorComment,
            submittedAt: sub.submittedAt.getTime(),
            reviewedAt: sub.reviewedAt?.getTime() ?? null,
          };
        }
        return {
          id: null,
          userId: student.id,
          name: student.name,
          email: student.email,
          batch: student.batch,
          status: 'pending' as const,
          fileUrl: null,
          note: null,
          instructorComment: null,
          submittedAt: null,
          reviewedAt: null,
        };
      }),
    );

    // Sort: submitted first, then pending
    submissions.sort((a, b) => {
      if (a.status === b.status) return 0;
      if (a.status === 'submitted') return -1;
      if (b.status === 'submitted') return 1;
      if (a.status === 'reviewed') return -1;
      if (b.status === 'reviewed') return 1;
      return 0;
    });

    return { assignment: serializeAssignment(assignment), submissions };
  });
}

function serializeAssignment(a: typeof assignments.$inferSelect) {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    subject: a.subject,
    product: a.product,
    batch: a.batch,
    dueAt: a.dueAt.getTime(),
    attachmentUrl: a.attachmentUrl,
  };
}
