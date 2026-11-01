/**
 * "Mock Access" is the `mock` product. Students of the batches below get it automatically (the same
 * choke point that grants LexiCore full access runs this, so every enrol/edit/rollover path is
 * covered); anyone else gets it from the Users admin, or by an approved mock registration.
 * An existing row is never touched, so a revoked grant stays revoked.
 */

import { db } from '@/lib/db';
import { userAccess } from '@/lib/db/schema';
import type { DbExecutor } from '@/lib/db-access-control';

const MOCK_ACCESS_BATCHES: { product: string; batch: string }[] = [
  { product: 'iba', batch: '2026-27' },
];

export function qualifiesForMockAccess(batch: string | null, products: string[]): boolean {
  if (!batch) return false;
  return MOCK_ACCESS_BATCHES.some(b => b.batch === batch && products.includes(b.product));
}

/** Inserts the `mock` product for an eligible user. No-op if not eligible or a row already exists. */
export async function grantMockAccessIfEligible(
  userId: number,
  batch: string | null,
  products: string[],
  exec: DbExecutor = db,
): Promise<void> {
  if (!qualifiesForMockAccess(batch, products)) return;
  await exec.insert(userAccess).values({ userId, product: 'mock', active: true }).onConflictDoNothing();
}
