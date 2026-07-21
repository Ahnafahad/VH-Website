/**
 * /admin/classes/[id]
 *
 * Admin class detail: session info header, attendance table with watch progress,
 * recording status, active grants list, and grant form.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  classSessions,
  recordings,
  recordingAccessGrants,
  classAttendance,
  recordingWatchProgress,
  users,
  classQuestions,
  materials,
  sessionMaterials,
} from '@/lib/db/schema';
import ClassDetailClient from '@/components/admin/lms/ClassDetailClient';
import { getUserByEmail } from '@/lib/db-access-control';
import { inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  if (isNaN(sessionId)) return { title: 'Class Detail | Admin' };
  const row = await db
    .select({ title: classSessions.title })
    .from(classSessions)
    .where(eq(classSessions.id, sessionId))
    .get();
  return { title: row ? `${row.title} | Admin` : 'Class Detail | Admin' };
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const adminUser = await getUserByEmail(session.user.email);
  if (!adminUser) redirect('/auth/signin');

  if (isNaN(sessionId)) redirect('/admin/classes');

  // Load class session
  const classSession = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, sessionId))
    .get();
  if (!classSession) redirect('/admin/classes');

  // Load instructor name (nullable — instructor_id may be unset)
  const instructor = classSession.instructorId
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, classSession.instructorId))
        .get()
    : null;

  // Load materials for this session (junction + legacy classSessionId)
  const [junctionMaterials, legacyMaterials] = await Promise.all([
    db
      .select({ materialId: sessionMaterials.materialId })
      .from(sessionMaterials)
      .where(eq(sessionMaterials.sessionId, sessionId))
      .catch(() => [] as { materialId: number }[]),
    db
      .select({ id: materials.id })
      .from(materials)
      .where(eq(materials.classSessionId, sessionId))
      .catch(() => [] as { id: number }[]),
  ]);
  const materialIdSet = new Set<number>([
    ...junctionMaterials.map((r) => r.materialId),
    ...legacyMaterials.map((r) => r.id),
  ]);
  const sessionMaterialRows = materialIdSet.size > 0
    ? await db
        .select()
        .from(materials)
        .where(inArray(materials.id, [...materialIdSet]))
    : [];

  // Load recording (nullable)
  const recording = await db
    .select()
    .from(recordings)
    .where(eq(recordings.classSessionId, sessionId))
    .get() ?? null;

  // Load attendance with user info
  const attendanceRows = await db
    .select({
      userId: classAttendance.userId,
      joinedAt: classAttendance.joinedAt,
      name: users.name,
      email: users.email,
    })
    .from(classAttendance)
    .innerJoin(users, eq(classAttendance.userId, users.id))
    .where(eq(classAttendance.sessionId, sessionId));

  // Load watch progress if recording exists
  const watchProgressMap: Record<number, { secondsWatched: number; completedPercent: number }> = {};
  if (recording) {
    const progressRows = await db
      .select()
      .from(recordingWatchProgress)
      .where(eq(recordingWatchProgress.recordingId, recording.id));
    for (const row of progressRows) {
      watchProgressMap[row.userId] = {
        secondsWatched: row.secondsWatched,
        completedPercent: row.completedPercent,
      };
    }
  }

  // Load active grants for this recording
  const grants = recording
    ? await db
        .select({
          id: recordingAccessGrants.id,
          userId: recordingAccessGrants.userId,
          expiresAt: recordingAccessGrants.expiresAt,
          grantedBy: recordingAccessGrants.grantedBy,
          createdAt: recordingAccessGrants.createdAt,
        })
        .from(recordingAccessGrants)
        .where(eq(recordingAccessGrants.recordingId, recording.id))
    : [];

  // Load all users for the grant form (to allow picking a specific student)
  const allUsers = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.role, 'student'));

  // Load Q&A threads
  function isStaffRole(role: string) {
    return role === 'admin' || role === 'super_admin' || role === 'instructor';
  }

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
    isOwn: q.userId === adminUser.id,
    answers: (answerMap.get(q.id) ?? []).map((a) => ({
      id: a.id,
      body: a.body,
      createdAt: a.createdAt.getTime(),
      userId: a.userId,
      userName: a.userName,
      isStaff: isStaffRole(a.userRole),
      isOwn: a.userId === adminUser.id,
    })),
  }));

  return (
    <ClassDetailClient
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
        recallBotId: classSession.recallBotId,
        topic: classSession.topic,
        classNumber: classSession.classNumber,
        instructorName: instructor?.name ?? null,
      }}
      recording={
        recording
          ? {
              id: recording.id,
              status: recording.status,
              durationSeconds: recording.durationSeconds,
              fileSize: recording.fileSize,
              errorMessage: recording.errorMessage,
              createdAt: recording.createdAt.getTime(),
            }
          : null
      }
      attendance={attendanceRows.map((row) => ({
        userId: row.userId,
        name: row.name,
        email: row.email,
        joinedAt: row.joinedAt.getTime(),
        watchProgress: watchProgressMap[row.userId] ?? null,
      }))}
      grants={grants.map((g) => ({
        id: g.id,
        userId: g.userId,
        expiresAt: g.expiresAt.getTime(),
        grantedBy: g.grantedBy,
        createdAt: g.createdAt.getTime(),
      }))}
      allUsers={allUsers}
      initialThreads={threads}
      currentUserId={adminUser.id}
      initialMaterials={sessionMaterialRows.map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        fileName: m.fileName,
        fileSize: m.fileSize,
        subject: m.subject,
        createdAt: m.createdAt.getTime(),
      }))}
    />
  );
}
