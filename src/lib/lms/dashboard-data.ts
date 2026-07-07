/**
 * LMS Dashboard aggregate query — used by both the API route and (later)
 * the /dashboard server component directly.
 *
 * Parallelises independent queries with Promise.all.
 * All timestamps are Date objects (Drizzle mode:'timestamp').
 */

import { db } from '@/lib/db';
import {
  classSessions,
  materials,
  recordings,
  assignments,
  assignmentSubmissions,
  tests,
  testWindows,
  testAttempts,
  lmsAnnouncements,
} from '@/lib/db/schema';
import type { UserWithProducts } from '@/lib/db/schema';
import {
  and,
  desc,
  eq,
  gte,
  lte,
  or,
  inArray,
  asc,
} from 'drizzle-orm';
import { lmsScopeConditions } from './access';
import { isJoinOpen } from './join-window';
import { resolveFileUrl } from '@/lib/storage/r2';
import { canAccessTest } from '@/lib/tests/access';
import { effectiveWindowState, type EffectiveWindowState } from '@/lib/tests/windows';

// ─── Return shape ─────────────────────────────────────────────────────────────

export interface DashboardLastClass {
  id: number;
  title: string;
  subject: string;
  scheduledAt: number; // epoch ms
  durationMinutes: number;
  status: string;
  materials: Array<{
    id: number;
    title: string;
    type: string;
    blobUrl: string;
    fileName: string | null;
  }>;
  recording: { status: string } | null;
}

export interface DashboardNextClass {
  id: number;
  title: string;
  subject: string;
  scheduledAt: number; // epoch ms
  durationMinutes: number;
  status: string;
  joinOpen: boolean;
  meetLink: string | null; // only if joinOpen
}

export interface DashboardWeekClass {
  id: number;
  title: string;
  subject: string;
  scheduledAt: number; // epoch ms
  durationMinutes: number;
  status: string;
}

export interface DashboardAssignment {
  id: number;
  title: string;
  description: string;
  subject: string;
  dueAt: number; // epoch ms
  classSessionId: number | null;
  mySubmission: { status: string } | 'pending';
}

export interface DashboardUpcomingTest {
  id: number;
  slug: string;
  title: string;
  bucket: string;
  syllabus: string | null;
  windows: Array<{
    id: number;
    mode: string;
    opensAt: number;
    closesAt: number;
    durationMinutes: number | null;
    state: EffectiveWindowState;
  }>;
  myAttempt: { status: string } | null;
}

export interface DashboardAnnouncement {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number; // epoch ms
}

export interface DashboardData {
  hasAccess: true;
  lastClass: DashboardLastClass | null;
  nextClass: DashboardNextClass | null;
  weekClasses: DashboardWeekClass[];
  assignments: DashboardAssignment[];
  upcomingTests: DashboardUpcomingTest[];
  announcements: DashboardAnnouncement[];
}

// ─── Helper: is LMS staff ─────────────────────────────────────────────────────

function isLmsStaff(user: UserWithProducts): boolean {
  return (
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    user.role === 'instructor'
  );
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function getDashboardData(
  user: UserWithProducts,
): Promise<DashboardData | { hasAccess: false }> {
  const staff = isLmsStaff(user);

  // Students need at least one LMS product (iba/fbs)
  if (!staff && user.products.length === 0) {
    return { hasAccess: false };
  }

  const now = new Date();

  // Scope conditions for session queries (staff = no extra filter)
  const sessionScope = lmsScopeConditions(user, classSessions);

  // ─── Parallel batch 1: last class + next class + week classes + assignments + announcements
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const weekAhead = new Date(now.getTime() + 7 * 86400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);

  const [
    lastClassRows,
    nextClassRows,
    weekClassRows,
    rawAssignments,
    announcementRows,
    publishedTests,
  ] = await Promise.all([
    // Last completed class in scope
    db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.status, 'completed'),
          ...sessionScope,
        ),
      )
      .orderBy(desc(classSessions.scheduledAt))
      .limit(1),

    // Next scheduled class in scope
    db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.status, 'scheduled'),
          gte(classSessions.scheduledAt, now),
          ...sessionScope,
        ),
      )
      .orderBy(asc(classSessions.scheduledAt))
      .limit(1),

    // Week classes (±7 days), scheduled or completed
    db
      .select()
      .from(classSessions)
      .where(
        and(
          or(
            eq(classSessions.status, 'scheduled'),
            eq(classSessions.status, 'completed'),
            eq(classSessions.status, 'live'),
          ),
          gte(classSessions.scheduledAt, weekAgo),
          lte(classSessions.scheduledAt, weekAhead),
          ...sessionScope,
        ),
      )
      .orderBy(asc(classSessions.scheduledAt)),

    // Assignments with dueAt >= now-7d
    db
      .select()
      .from(assignments)
      .where(
        and(
          gte(assignments.dueAt, sevenDaysAgo),
          ...lmsScopeConditions(user, assignments),
        ),
      )
      .orderBy(asc(assignments.dueAt)),

    // Latest 10 announcements in scope, pinned first
    db
      .select()
      .from(lmsAnnouncements)
      .where(and(...lmsScopeConditions(user, lmsAnnouncements)))
      .orderBy(desc(lmsAnnouncements.pinned), desc(lmsAnnouncements.createdAt))
      .limit(10),

    // All published tests (we'll filter by user products below)
    db
      .select()
      .from(tests)
      .where(eq(tests.status, 'published')),
  ]);

  // ─── Materials + recording for lastClass ─────────────────────────────────────
  const lastClass = lastClassRows[0] ?? null;
  const nextClassRaw = nextClassRows[0] ?? null;

  let lastClassMaterials: DashboardLastClass['materials'] = [];
  let lastClassRecording: { status: string } | null = null;

  if (lastClass) {
    const [mats, recs] = await Promise.all([
      db
        .select()
        .from(materials)
        .where(eq(materials.classSessionId, lastClass.id)),
      db
        .select({ status: recordings.status })
        .from(recordings)
        .where(eq(recordings.classSessionId, lastClass.id))
        .limit(1),
    ]);
    lastClassMaterials = await Promise.all(
      mats.map(async (m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        blobUrl: (await resolveFileUrl(m.blobUrl)) ?? '',
        fileName: m.fileName,
      })),
    );
    lastClassRecording = recs[0] ?? null;
  }

  // ─── My submissions for assignments ──────────────────────────────────────────
  const assignmentIds = rawAssignments.map((a) => a.id);
  const mySubmissions =
    assignmentIds.length > 0
      ? await db
          .select()
          .from(assignmentSubmissions)
          .where(
            and(
              inArray(assignmentSubmissions.assignmentId, assignmentIds),
              eq(assignmentSubmissions.userId, user.id),
            ),
          )
      : [];

  const subMap = new Map(mySubmissions.map((s) => [s.assignmentId, s.status]));

  // ─── Upcoming tests ───────────────────────────────────────────────────────────
  // Filter by user products (staff bypass), then check windows not all closed
  const accessibleTests = publishedTests.filter((t) =>
    canAccessTest(user, t),
  );
  const testIds = accessibleTests.map((t) => t.id);

  let upcomingTests: DashboardUpcomingTest[] = [];

  if (testIds.length > 0) {
    const [allWindows, myAttempts] = await Promise.all([
      db
        .select()
        .from(testWindows)
        .where(inArray(testWindows.testId, testIds)),
      db
        .select()
        .from(testAttempts)
        .where(
          and(
            inArray(testAttempts.testId, testIds),
            eq(testAttempts.userId, user.id),
          ),
        ),
    ]);

    const attemptMap = new Map(myAttempts.map((a) => [a.testId, a]));

    upcomingTests = accessibleTests
      .map((t) => {
        const tWindows = allWindows.filter((w) => w.testId === t.id);
        // Only include tests with at least one non-closed window
        const hasOpen = tWindows.some(
          (w) => effectiveWindowState(w, now) !== 'closed',
        );
        if (!hasOpen) return null;

        const attempt = attemptMap.get(t.id);
        return {
          id: t.id,
          slug: t.slug,
          title: t.title,
          bucket: t.bucket,
          syllabus: t.syllabus,
          windows: tWindows
            .sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime())
            .map((w) => ({
              id: w.id,
              mode: w.mode,
              opensAt: w.opensAt.getTime(),
              closesAt: w.closesAt.getTime(),
              durationMinutes: w.durationMinutes,
              state: effectiveWindowState(w, now),
            })),
          myAttempt: attempt
            ? { status: attempt.status }
            : null,
        };
      })
      .filter((t) => t !== null) as DashboardUpcomingTest[];
  }

  // ─── Assemble response ────────────────────────────────────────────────────────

  const dashLastClass: DashboardLastClass | null = lastClass
    ? {
        id: lastClass.id,
        title: lastClass.title,
        subject: lastClass.subject,
        scheduledAt: lastClass.scheduledAt.getTime(),
        durationMinutes: lastClass.durationMinutes,
        status: lastClass.status,
        materials: lastClassMaterials,
        recording: lastClassRecording,
      }
    : null;

  let dashNextClass: DashboardNextClass | null = null;
  if (nextClassRaw) {
    const joinOpen = isJoinOpen(
      {
        scheduledAt: nextClassRaw.scheduledAt,
        durationMinutes: nextClassRaw.durationMinutes,
      },
      now,
    );
    dashNextClass = {
      id: nextClassRaw.id,
      title: nextClassRaw.title,
      subject: nextClassRaw.subject,
      scheduledAt: nextClassRaw.scheduledAt.getTime(),
      durationMinutes: nextClassRaw.durationMinutes,
      status: nextClassRaw.status,
      joinOpen,
      meetLink: joinOpen ? nextClassRaw.meetLink : null,
    };
  }

  return {
    hasAccess: true,
    lastClass: dashLastClass,
    nextClass: dashNextClass,
    weekClasses: weekClassRows.map((s) => ({
      id: s.id,
      title: s.title,
      subject: s.subject,
      scheduledAt: s.scheduledAt.getTime(),
      durationMinutes: s.durationMinutes,
      status: s.status,
    })),
    assignments: rawAssignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      subject: a.subject,
      dueAt: a.dueAt.getTime(),
      classSessionId: a.classSessionId,
      mySubmission: subMap.has(a.id)
        ? { status: subMap.get(a.id)! }
        : 'pending',
    })),
    upcomingTests,
    announcements: announcementRows.map((an) => ({
      id: an.id,
      title: an.title,
      body: an.body,
      pinned: an.pinned,
      createdAt: an.createdAt.getTime(),
    })),
  };
}
