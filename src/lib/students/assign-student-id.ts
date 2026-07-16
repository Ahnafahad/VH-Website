/**
 * Auto-assigns a random 6-digit student ID to students in qualifying cohorts
 * (currently IBA 2026-27). Called from the admin user create/update routes so
 * that any student newly added to — or moved into — the cohort receives an ID,
 * mirroring how `grantFullVocabAccessIfEligible` works.
 *
 * Uniqueness rule: every ID is a genuine 6-digit number (no leading zero) and
 * its last 5 digits are unique across all students. So even if the leading
 * digit is dropped (a 5-digit form), every student's ID stays distinct.
 */

import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

// Batches whose students receive an auto-generated student ID. Add pairs here
// as new cohorts are onboarded — no other code changes needed.
const STUDENT_ID_BATCHES: { product: string; batch: string }[] = [
  { product: 'iba', batch: '2026-27' },
];

export function qualifiesForStudentId(batch: string | null, products: string[]): boolean {
  if (!batch) return false;
  return STUDENT_ID_BATCHES.some((b) => b.batch === batch && products.includes(b.product));
}

/** Last 5 digits of a numeric student ID, used for the reduced-form uniqueness check. */
export function last5(studentId: string): number | null {
  return /^\d{5,6}$/.test(studentId) ? Number(studentId) % 100000 : null;
}

/**
 * Generate a 6-digit ID (100000–999999, no leading zero) whose last 5 digits
 * are not already taken.
 */
export function generateStudentId(usedLast5: Set<number>): string {
  for (let i = 0; i < 10000; i++) {
    const n = 100000 + Math.floor(Math.random() * 900000); // 100000..999999
    if (!usedLast5.has(n % 100000)) return String(n);
  }
  throw new Error('Unable to generate a unique student ID');
}

/**
 * Assigns a unique 6-digit student ID to the user if their batch+products
 * qualify and they don't already have one. Returns the ID in effect (the new
 * one, an existing one, or null when not eligible). No-op if not eligible.
 */
export async function assignStudentIdIfEligible(
  userId: number,
  batch: string | null,
  products: string[],
): Promise<string | null> {
  if (!qualifiesForStudentId(batch, products)) return null;

  const current = await db
    .select({ studentId: users.studentId })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (current?.studentId) return current.studentId; // keep an existing / manually-set ID

  // Retry to survive the rare race where two concurrent assignments collide on
  // the unique student_id column.
  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = await db.select({ studentId: users.studentId }).from(users);
    const usedLast5 = new Set<number>();
    for (const r of rows) {
      if (!r.studentId) continue;
      const l5 = last5(r.studentId);
      if (l5 !== null) usedLast5.add(l5);
    }

    const candidate = generateStudentId(usedLast5);
    try {
      await db
        .update(users)
        .set({ studentId: candidate, updatedAt: new Date() })
        .where(eq(users.id, userId));
      return candidate;
    } catch (err) {
      if (attempt === 4) throw err; // exhausted retries — surface the constraint error
    }
  }
  return null;
}
