/**
 * Batches that get full LexiCore word access (phase 1) automatically, instead
 * of requiring a manual access-request approval per student (see
 * src/app/api/admin/access-requests/[id]/approve/route.ts for the manual path).
 *
 * Add more `{ product, batch }` pairs here as new cohorts are granted full
 * access — no other code changes needed.
 */

import { db } from '@/lib/db';
import { vocabUserProgress } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const FULL_ACCESS_BATCHES: { product: string; batch: string }[] = [
  { product: 'iba', batch: '2026-27' },
];

export function qualifiesForFullVocabAccess(batch: string | null, products: string[]): boolean {
  if (!batch) return false;
  return FULL_ACCESS_BATCHES.some((b) => b.batch === batch && products.includes(b.product));
}

/** Upgrades the user to vocab phase 1 if their current batch+products match a full-access batch. No-op otherwise, and no-op if already phase 1. */
export async function grantFullVocabAccessIfEligible(
  userId: number,
  batch: string | null,
  products: string[],
): Promise<void> {
  if (!qualifiesForFullVocabAccess(batch, products)) return;

  const existing = await db
    .select({ id: vocabUserProgress.id, phase: vocabUserProgress.phase })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, userId))
    .get();

  if (existing) {
    if (existing.phase !== 1) {
      await db
        .update(vocabUserProgress)
        .set({ phase: 1, updatedAt: new Date() })
        .where(eq(vocabUserProgress.userId, userId));
    }
  } else {
    await db.insert(vocabUserProgress).values({ userId, phase: 1 });
  }
}
