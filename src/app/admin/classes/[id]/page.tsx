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
  recordingWatchProgress,
  users,
  classQuestions,
  materials,
  sessionMaterials,
  assignments,
} from '@/lib/db/schema';
import ClassDetailClient from '@/components/admin/lms/ClassDetailClient';
import type { ClassSession, TeachingUser } from '@/components/admin/lms/ClassesClient';
import { getUserByEmail } from '@/lib/db-access-control';
import { inArray } from 'drizzle-orm';
import { getDisplayClassNumbers } from '@/lib/lms/class-numbering';
import { formatInstructorNames } from '@/lib/lms/instructor-name';
import { adminApiFetch } from '@/lib/lms/admin-fetch';

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

  // Load instructor name (nullable — instructor_id may be unset). Falls back to
  // the raw stored name if the instructor has since been unflagged is_teaching
  // (formatInstructorNames only covers the current teaching set).
  const instructor = classSession.instructorId
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, classSession.instructorId))
        .get()
    : null;

  // All current teaching users — needed both for the first-name display label
  // (formatInstructorNames disambiguates collisions across this whole set,
  // same as the class list) and as the dropdown source for the edit modal.
  const teachingUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.isTeaching, true));
  const instructorNames = formatInstructorNames(teachingUsers);
  const instructorLabel = classSession.instructorId != null
    ? (instructorNames.get(classSession.instructorId) ?? instructor?.name ?? null)
    : null;

  // Computed-on-read class number (manual override in classNumber wins) — see
  // src/lib/lms/class-numbering.ts. classSession.classNumber (raw) is kept
  // separate below for the edit form, which must bind to the override column,
  // not this computed value.
  const displayNumbers = await getDisplayClassNumbers();
  const displayClassNumber = displayNumbers.get(sessionId) ?? null;

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

  // Full attendance roster (present + absent, with mode) — reuses the same
  // scoped-student + attendance-merge endpoint the manual attendance sheet
  // (TodayClient) uses, rather than re-deriving the scoping/batch-match rules
  // here.
  interface RosterStudent {
    userId: number; name: string; email: string;
    present: boolean; mode: 'online' | 'offline'; joinedAt: number | null;
  }
  const rosterRes = await adminApiFetch(`/api/lms/admin/classes/${sessionId}/attendance/roster`);
  const rosterStudents: RosterStudent[] = rosterRes.ok
    ? ((await rosterRes.json()) as { students: RosterStudent[] }).students
    : [];

  // Linked homework/assignments — single direct FK, no union needed (verified
  // in schema: assignments.classSessionId is the only link, no junction table).
  const homeworkRows = await db
    .select({ id: assignments.id, title: assignments.title, dueAt: assignments.dueAt, subject: assignments.subject })
    .from(assignments)
    .where(eq(assignments.classSessionId, sessionId));

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

  // Raw session (unmodified stored columns, incl. the classNumber override)
  // for the reused SessionModal edit form — must NOT bind to displayClassNumber,
  // or saving would freeze a computed value into the override column.
  const rawSessionForEdit: ClassSession = {
    id: classSession.id,
    scheduleId: classSession.scheduleId,
    title: classSession.title,
    description: classSession.description,
    subject: classSession.subject,
    product: classSession.product,
    batch: classSession.batch,
    scheduledAt: classSession.scheduledAt.getTime(),
    durationMinutes: classSession.durationMinutes,
    status: classSession.status,
    meetLink: classSession.meetLink,
    googleEventId: classSession.googleEventId,
    recallBotId: classSession.recallBotId,
    instructorId: classSession.instructorId,
    topic: classSession.topic,
    classNumber: classSession.classNumber,
    displayClassNumber,
    createdBy: classSession.createdBy,
    createdAt: classSession.createdAt.getTime(),
  };

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
        displayClassNumber,
        instructorName: instructorLabel,
      }}
      rawSession={rawSessionForEdit}
      teachingUsers={teachingUsers as TeachingUser[]}
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
      roster={rosterStudents.map((s) => ({
        userId: s.userId,
        name: s.name,
        email: s.email,
        present: s.present,
        mode: s.mode,
        joinedAt: s.joinedAt,
        watchProgress: watchProgressMap[s.userId] ?? null,
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
      homework={homeworkRows.map((h) => ({
        id: h.id,
        title: h.title,
        dueAt: h.dueAt.getTime(),
        subject: h.subject,
      }))}
    />
  );
}
