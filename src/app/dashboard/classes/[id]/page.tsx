/**
 * /dashboard/classes/[id] — Student class detail with Q&A thread.
 * Server component: session guard → scope check → load data → render client.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { and, eq, isNull, or } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { db } from '@/lib/db';
import {
  classSessions,
  materials,
  recordings,
  classQuestions,
  users,
} from '@/lib/db/schema';
import { canAccessLmsContent } from '@/lib/lms/access';
import ClassDetailStudentClient from '@/components/lms/ClassDetailStudentClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

function isStaffRole(role: string) {
  return role === 'admin' || role === 'super_admin' || role === 'instructor';
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  if (isNaN(sessionId)) return { title: 'Class — VH' };
  const row = await db
    .select({ title: classSessions.title })
    .from(classSessions)
    .where(eq(classSessions.id, sessionId))
    .get();
  return { title: row ? `${row.title} — VH` : 'Class — VH' };
}

export default async function ClassDetailStudentPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const { id } = await params;
  const sessionId = parseInt(id, 10);
  if (isNaN(sessionId)) redirect('/dashboard');

  const classSession = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, sessionId))
    .get();

  if (!classSession) redirect('/dashboard');
  if (classSession.status === 'draft' || classSession.status === 'cancelled') redirect('/dashboard');

  if (!canAccessLmsContent(user, { product: classSession.product, batch: classSession.batch })) {
    redirect('/dashboard');
  }

  // Load materials for this session
  const sessionMaterials = await db
    .select({
      id: materials.id,
      title: materials.title,
      type: materials.type,
      blobUrl: materials.blobUrl,
      fileName: materials.fileName,
    })
    .from(materials)
    .where(eq(materials.classSessionId, sessionId));

  // Load recording (nullable)
  const recording = await db
    .select({
      id: recordings.id,
      status: recordings.status,
    })
    .from(recordings)
    .where(eq(recordings.classSessionId, sessionId))
    .get() ?? null;

  // Load Q&A threads (top-level questions + answers)
  const questionRows = await db
    .select({
      id: classQuestions.id,
      parentId: classQuestions.parentId,
      body: classQuestions.body,
      createdAt: classQuestions.createdAt,
      userId: classQuestions.userId,
      userName: users.name,
      userRole: users.role,
    })
    .from(classQuestions)
    .innerJoin(users, eq(classQuestions.userId, users.id))
    .where(eq(classQuestions.sessionId, sessionId))
    .orderBy(classQuestions.createdAt);

  // Build threads
  const topLevel = questionRows.filter((r) => r.parentId === null || r.parentId === undefined);
  const answerMap = new Map<number, typeof questionRows>();
  for (const row of questionRows) {
    if (row.parentId !== null && row.parentId !== undefined) {
      if (!answerMap.has(row.parentId)) answerMap.set(row.parentId, []);
      answerMap.get(row.parentId)!.push(row);
    }
  }

  const threads = topLevel.map((q) => ({
    id: q.id,
    body: q.body,
    createdAt: q.createdAt.getTime(),
    userId: q.userId,
    userName: q.userName,
    isStaff: isStaffRole(q.userRole),
    isOwn: q.userId === user.id,
    answers: (answerMap.get(q.id) ?? []).map((a) => ({
      id: a.id,
      body: a.body,
      createdAt: a.createdAt.getTime(),
      userId: a.userId,
      userName: a.userName,
      isStaff: isStaffRole(a.userRole),
      isOwn: a.userId === user.id,
    })),
  }));

  return (
    <ClassDetailStudentClient
      classSession={{
        id: classSession.id,
        title: classSession.title,
        subject: classSession.subject,
        product: classSession.product,
        batch: classSession.batch,
        scheduledAt: classSession.scheduledAt.getTime(),
        durationMinutes: classSession.durationMinutes,
        status: classSession.status,
        meetLink: classSession.meetLink,
      }}
      materials={sessionMaterials.map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        blobUrl: m.blobUrl,
        fileName: m.fileName,
      }))}
      recording={recording}
      initialThreads={threads}
      currentUserId={user.id}
    />
  );
}
