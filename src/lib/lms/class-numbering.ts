/**
 * DB fetch layer for computed-on-read class numbering. See
 * class-numbering-pure.ts for the numbering rules and the pure function.
 */

import { db } from '@/lib/db';
import { classSessions } from '@/lib/db/schema';
import { computeClassNumbers } from './class-numbering-pure';

export { computeClassNumbers, type NumberableSession } from './class-numbering-pure';

/** One query, all rows, minimal columns — safe to call from a list endpoint. */
export async function getDisplayClassNumbers(): Promise<Map<number, number | null>> {
  const rows = await db
    .select({
      id: classSessions.id,
      subject: classSessions.subject,
      product: classSessions.product,
      batch: classSessions.batch,
      scheduledAt: classSessions.scheduledAt,
      status: classSessions.status,
      classNumber: classSessions.classNumber,
    })
    .from(classSessions);

  return computeClassNumbers(rows);
}
