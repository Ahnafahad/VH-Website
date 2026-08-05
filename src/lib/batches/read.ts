/**
 * Read helper for the `batches` table — the DB-backed replacement for the
 * hardcoded BATCHES constant in src/lib/naming/taxonomy.ts. Server-only
 * (imports the db client), unlike taxonomy.ts which is imported into client
 * components — do not merge the two.
 */

import { db } from '@/lib/db';
import { batches } from '@/lib/db/schema';
import type { Batch, UserProduct } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';

/** Active batches, optionally scoped to one product. Newest first. */
export async function getActiveBatches(product?: UserProduct): Promise<Batch[]> {
  const conditions = [eq(batches.status, 'active')];
  if (product) conditions.push(eq(batches.product, product));

  return db
    .select()
    .from(batches)
    .where(and(...conditions))
    .orderBy(desc(batches.createdAt));
}
