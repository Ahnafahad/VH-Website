/**
 * /dashboard/assignments/[id] — Student assignment detail + submission UI.
 * Server component: session guard → scope check → fetch submission → render client.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { and, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { db } from '@/lib/db';
import { assignments, assignmentSubmissions } from '@/lib/db/schema';
import { canAccessLmsContent } from '@/lib/lms/access';
import AssignmentDetailClient from '@/components/lms/AssignmentDetailClient';
import { resolveFileUrl } from '@/lib/storage/r2';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const assignmentId = parseInt(id, 10);
  if (isNaN(assignmentId)) return { title: 'Assignment — VH' };
  const row = await db
    .select({ title: assignments.title })
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .get();
  return { title: row ? `${row.title} — VH` : 'Assignment — VH' };
}

export default async function AssignmentDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const { id } = await params;
  const assignmentId = parseInt(id, 10);
  if (isNaN(assignmentId)) redirect('/dashboard');

  const assignment = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .get();
  if (!assignment) redirect('/dashboard');

  if (!canAccessLmsContent(user, { product: assignment.product, batch: assignment.batch })) {
    redirect('/dashboard');
  }

  const submission = await db
    .select()
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.userId, user.id),
      ),
    )
    .get() ?? null;

  // Resolve file refs to presigned URLs at render time.
  // attachmentUrl is always an http link (entered manually in admin form).
  // submission.fileUrl is an R2 key (or legacy http Blob URL).
  const resolvedFileUrl = submission
    ? await resolveFileUrl(submission.fileUrl)
    : null;

  return (
    <AssignmentDetailClient
      assignment={{
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        attachmentUrl: assignment.attachmentUrl,
        subject: assignment.subject,
        dueAt: assignment.dueAt.getTime(),
        classSessionId: assignment.classSessionId,
      }}
      initialSubmission={
        submission
          ? {
              id: submission.id,
              status: submission.status as 'submitted' | 'reviewed',
              fileUrl: resolvedFileUrl,
              note: submission.note,
              instructorComment: submission.instructorComment,
              submittedAt: submission.submittedAt.getTime(),
              reviewedAt: submission.reviewedAt?.getTime() ?? null,
            }
          : null
      }
    />
  );
}
