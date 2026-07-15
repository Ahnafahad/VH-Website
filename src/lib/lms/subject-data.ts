/**
 * Per-subject dashboard aggregate query — powers /dashboard/subjects/[subject].
 *
 * Mirrors the conventions of dashboard-data.ts: server-side Drizzle queries,
 * parallelised with Promise.all, scoped via lmsScopeConditions/canAccessLmsContent.
 */

import { db } from '@/lib/db';
import {
  materials,
  assignments,
  assignmentSubmissions,
  tests,
  testAttempts,
} from '@/lib/db/schema';
import type { UserWithProducts, LmsSubject } from '@/lib/db/schema';
import { and, eq, inArray, desc, asc } from 'drizzle-orm';
import { lmsScopeConditions } from './access';
import { canAccessTest } from '@/lib/tests/access';
import { resolveFileUrl } from '@/lib/storage/r2';

// Re-exported for server-side consumers (page.tsx etc.) — client components
// must import these from subject-constants.ts directly, never from here,
// since this module also pulls in the DB client.
export { SUBJECTS, isLmsSubject, SUBJECT_LABELS } from './subject-constants';

// ─── Best-effort subject match for mock-test sections ─────────────────────────
// Mock tests aren't subject-tagged yet (they're one test covering all
// sections) — sections are matched to a subject by keyword. Once tests carry
// their own `subject` column this can be replaced with a direct filter.

function matchSectionToSubject(sectionTitle: string): LmsSubject | null {
  const title = sectionTitle.toLowerCase();
  if (/math|quantitative|numerical|algebra|geometry/.test(title)) return 'math';
  if (/language|communication|english|verbal|grammar|vocabulary|reading/.test(title)) return 'english';
  if (/analytical|logic|reasoning|writing/.test(title)) return 'analytical';
  return null;
}

// ─── Return shape ─────────────────────────────────────────────────────────────

export interface SubjectMaterial {
  id: number;
  title: string;
  type: string;
  blobUrl: string;
  fileName: string | null;
  fileSize: number | null;
  createdAt: number;
}

export interface SubjectAssignment {
  id: number;
  title: string;
  description: string;
  dueAt: number;
  mySubmission: { status: string } | 'pending';
}

export interface SubjectTestSection {
  testId: number;
  testSlug: string;
  testTitle: string;
  bucket: string;
  sectionTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: number;
}

export interface SubjectData {
  subject: LmsSubject;
  lectureSheets: SubjectMaterial[];
  otherMaterials: SubjectMaterial[];
  currentHomework: SubjectAssignment[];
  previousHomework: SubjectAssignment[];
  testSections: SubjectTestSection[];
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function getSubjectData(
  user: UserWithProducts,
  subject: LmsSubject,
): Promise<SubjectData> {
  const now = new Date();

  const [subjectMaterials, subjectAssignments, publishedTests] = await Promise.all([
    db
      .select()
      .from(materials)
      .where(
        and(
          eq(materials.subject, subject),
          ...lmsScopeConditions(user, materials),
        ),
      )
      .orderBy(desc(materials.createdAt)),

    db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.subject, subject),
          ...lmsScopeConditions(user, assignments),
        ),
      )
      .orderBy(asc(assignments.dueAt)),

    db.select().from(tests).where(eq(tests.status, 'published')),
  ]);

  // ─── Materials: lecture sheets (pdf) vs other materials (links) ─────────────
  const lectureSheets: SubjectMaterial[] = [];
  const otherMaterials: SubjectMaterial[] = [];

  for (const m of subjectMaterials) {
    const entry: SubjectMaterial = {
      id: m.id,
      title: m.title,
      type: m.type,
      blobUrl: (await resolveFileUrl(m.blobUrl)) ?? m.blobUrl,
      fileName: m.fileName,
      fileSize: m.fileSize,
      createdAt: m.createdAt.getTime(),
    };
    if (m.type === 'pdf') lectureSheets.push(entry);
    else otherMaterials.push(entry);
  }

  // ─── Homework: my submissions, then split current vs previous ───────────────
  const assignmentIds = subjectAssignments.map((a) => a.id);
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

  const currentHomework: SubjectAssignment[] = [];
  const previousHomework: SubjectAssignment[] = [];
  const nowMs = now.getTime();

  for (const a of subjectAssignments) {
    const mySubmission = subMap.has(a.id) ? { status: subMap.get(a.id)! } : ('pending' as const);
    const entry: SubjectAssignment = {
      id: a.id,
      title: a.title,
      description: a.description,
      dueAt: a.dueAt.getTime(),
      mySubmission,
    };
    if (entry.dueAt >= nowMs) currentHomework.push(entry);
    else previousHomework.push(entry);
  }
  // Current: soonest due first. Previous: most recently due first.
  currentHomework.sort((a, b) => a.dueAt - b.dueAt);
  previousHomework.sort((a, b) => b.dueAt - a.dueAt);

  // ─── Test sections matching this subject ─────────────────────────────────────
  const accessibleTests = publishedTests.filter(
    (t) => t.resultsPublishedAt !== null && canAccessTest(user, t),
  );
  const accessibleTestIds = accessibleTests.map((t) => t.id);

  const testSections: SubjectTestSection[] = [];

  if (accessibleTestIds.length > 0) {
    const myAttempts = await db
      .select()
      .from(testAttempts)
      .where(
        and(
          inArray(testAttempts.testId, accessibleTestIds),
          eq(testAttempts.userId, user.id),
          eq(testAttempts.status, 'submitted'),
        ),
      )
      .orderBy(desc(testAttempts.submittedAt));

    const testMap = new Map(accessibleTests.map((t) => [t.id, t]));

    for (const attempt of myAttempts) {
      if (!attempt.sectionScores) continue;
      const t = testMap.get(attempt.testId);
      if (!t) continue;

      try {
        const parsed = JSON.parse(attempt.sectionScores) as Array<{
          title?: string;
          score?: number;
          maxScore?: number;
        }>;
        if (!Array.isArray(parsed)) continue;

        for (const section of parsed) {
          if (!section.title || matchSectionToSubject(section.title) !== subject) continue;
          const score = section.score ?? 0;
          const maxScore = section.maxScore ?? 0;
          testSections.push({
            testId: t.id,
            testSlug: t.slug,
            testTitle: t.title,
            bucket: t.bucket,
            sectionTitle: section.title,
            score,
            maxScore,
            percentage: maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0,
            submittedAt: attempt.submittedAt?.getTime() ?? 0,
          });
        }
      } catch {
        // malformed sectionScores JSON — skip this attempt
      }
    }
  }

  return {
    subject,
    lectureSheets,
    otherMaterials,
    currentHomework,
    previousHomework,
    testSections,
  };
}
