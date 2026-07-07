/**
 * GET /api/lms/assignments
 * Scope-filtered assignments with my submission status joined.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assignments, assignmentSubmissions } from '@/lib/db/schema';
import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { lmsScopeConditions } from '@/lib/lms/access';
import { asc } from 'drizzle-orm';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const scope = lmsScopeConditions(user, assignments);

    const rows = await db
      .select()
      .from(assignments)
      .where(and(...scope))
      .orderBy(asc(assignments.dueAt));

    if (rows.length === 0) return [];

    const ids = rows.map((a) => a.id);
    const submissions = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          inArray(assignmentSubmissions.assignmentId, ids),
          eq(assignmentSubmissions.userId, user.id),
        ),
      );

    const subMap = new Map(submissions.map((s) => [s.assignmentId, s]));

    return rows.map((a) => {
      const sub = subMap.get(a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        subject: a.subject,
        product: a.product,
        batch: a.batch,
        dueAt: a.dueAt.getTime(),
        classSessionId: a.classSessionId,
        attachmentUrl: a.attachmentUrl,
        createdAt: a.createdAt.getTime(),
        mySubmission: sub
          ? {
              status: sub.status,
              submittedAt: sub.submittedAt.getTime(),
              reviewedAt: sub.reviewedAt?.getTime() ?? null,
              instructorComment: sub.instructorComment,
            }
          : null,
      };
    });
  });
}
