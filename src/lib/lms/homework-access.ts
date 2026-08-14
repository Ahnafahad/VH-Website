// ─── Homework solution gating ──────────────────────────────────────────────
// A solution material (assignments.solutionMaterialId) must stay hidden from
// a student until they have a submission row for that assignment — everywhere
// materials are listed or fetched, not just the assignment detail page.
// Staff always see everything (mirrors canAccessLmsContent's staff bypass).

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { assignments, assignmentSubmissions } from '@/lib/db/schema';
import type { UserWithProducts } from '@/lib/db/schema';
import { isStaffRole } from '@/lib/auth/roles';

/**
 * Pure: given assignment rows (id + solutionMaterialId) and the set of
 * assignment ids the student has submitted, returns the solution material
 * ids that must stay hidden. A material used as more than one assignment's
 * solution stays gated until ALL of those assignments are submitted.
 */
export function computeGatedSolutionMaterialIds(
  assignmentRows: Array<{ id: number; solutionMaterialId: number | null }>,
  submittedAssignmentIds: Set<number>,
): Set<number> {
  const gated = new Set<number>();
  for (const a of assignmentRows) {
    if (a.solutionMaterialId !== null && !submittedAssignmentIds.has(a.id)) {
      gated.add(a.solutionMaterialId);
    }
  }
  return gated;
}

/**
 * DB-backed: which of `materialIds` are gated solution materials for `user`.
 * Staff get an empty set (no gating). Use this on any read path that fetches
 * materials by id and doesn't already have the assignments/submissions rows
 * in hand (subject-data.ts reuses computeGatedSolutionMaterialIds directly
 * instead, since it already fetched both).
 */
export async function getGatedSolutionMaterialIds(
  user: UserWithProducts,
  materialIds: number[],
): Promise<Set<number>> {
  if (isStaffRole(user.role) || materialIds.length === 0) return new Set();

  const linked = await db
    .select({ id: assignments.id, solutionMaterialId: assignments.solutionMaterialId })
    .from(assignments)
    .where(inArray(assignments.solutionMaterialId, materialIds));

  if (linked.length === 0) return new Set();

  const submitted = await db
    .select({ assignmentId: assignmentSubmissions.assignmentId })
    .from(assignmentSubmissions)
    .where(
      and(
        inArray(assignmentSubmissions.assignmentId, linked.map((a) => a.id)),
        eq(assignmentSubmissions.userId, user.id),
      ),
    );

  return computeGatedSolutionMaterialIds(linked, new Set(submitted.map((s) => s.assignmentId)));
}
