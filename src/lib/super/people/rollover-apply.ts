/** DB side of the batch rollover: load context for the pure planner, then apply its plan atomically. */
import { and, eq, inArray } from 'drizzle-orm';
import type { InStatement } from '@libsql/client';
import { db, users, userAccess, batches } from '@/lib/db';
import { ApiException } from '@/lib/api-utils';
import { clearAccessControlCache } from '@/lib/db-access-control';
import { grantFullVocabAccessIfEligible } from '@/lib/vocab/full-access-batches';
import { assignStudentIdIfEligible } from '@/lib/students/assign-student-id';
import { recordAudit } from '@/lib/audit-log';
import type { SuperActor } from '@/lib/super/guard';
import { planRollover, type RolloverPlan, type RolloverStudent } from './rollover';

export interface RolloverRequest {
  product: string; oldBatch: string | null; newBatch: string; archiveOld: boolean; copyAccess: boolean; userIds: number[];
}

export async function loadRolloverContext(product: string, oldBatch: string | null) {
  const batchRows = await db.select().from(batches);
  const rows = oldBatch
    ? await db.select().from(users).where(and(eq(users.role, 'student'), eq(users.batch, oldBatch)))
    : [];
  const ids = rows.map(r => r.id);
  const access = ids.length
    ? await db.select().from(userAccess).where(and(inArray(userAccess.userId, ids), eq(userAccess.active, true)))
    : [];
  const students = rows.map(r => ({
    id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, batch: r.batch,
    products: access.filter(a => a.userId === r.id).map(a => a.product),
  }));
  return { batchRows, students, knownBatches: [...new Set([...batchRows.map(b => b.name)])] };
}

async function buildPlan(req: RolloverRequest): Promise<{ plan: RolloverPlan; students: (RolloverStudent & { email: string })[] }> {
  const newBatch = req.newBatch.trim();
  if (!/^[\w][\w .\-/]{0,39}$/.test(newBatch)) throw new ApiException('Invalid new batch name', 400);
  if (req.userIds.length === 0) throw new ApiException('Select at least one student', 400);
  const rows = await db.select().from(users).where(inArray(users.id, req.userIds));
  const access = await db.select().from(userAccess).where(and(inArray(userAccess.userId, req.userIds), eq(userAccess.active, true)));
  const students = rows.map(r => ({
    id: r.id, email: r.email, role: r.role, status: r.status, batch: r.batch,
    products: access.filter(a => a.userId === r.id).map(a => a.product),
  }));
  const batchRows = await db.select().from(batches);
  const plan = planRollover({
    product: req.product, newBatch, oldBatch: req.oldBatch, archiveOld: req.archiveOld, copyAccess: req.copyAccess, students, batchRows,
  });
  return { plan, students };
}

export async function previewRollover(req: RolloverRequest) {
  return (await buildPlan(req)).plan;
}

export async function applyRollover(actor: SuperActor, req: RolloverRequest) {
  const { plan, students } = await buildPlan(req);
  const newBatch = req.newBatch.trim();
  const stmts: InStatement[] = [];

  if (plan.createBatch || plan.reviveBatch) {
    stmts.push({
      sql: `INSERT INTO batches (name, product, status, created_at, updated_at) VALUES (?, ?, 'active', unixepoch(), unixepoch())
            ON CONFLICT(name, product) DO UPDATE SET status = 'active', updated_at = unixepoch()`,
      args: [newBatch, req.product],
    });
  }
  if (plan.archiveOld && req.oldBatch) {
    stmts.push({ sql: "UPDATE batches SET status = 'archived', updated_at = unixepoch() WHERE name = ? AND product = ?", args: [req.oldBatch, req.product] });
  }
  for (let i = 0; i < plan.repoint.length; i += 100) {
    const chunk = plan.repoint.slice(i, i + 100);
    stmts.push({ sql: `UPDATE users SET batch = ?, updated_at = unixepoch() WHERE id IN (${chunk.map(() => '?').join(',')})`, args: [newBatch, ...chunk] });
  }
  for (const id of plan.grantAccess) {
    stmts.push({
      sql: 'INSERT INTO user_access (user_id, product, active, granted_by) VALUES (?, ?, 1, ?) ON CONFLICT(user_id, product) DO UPDATE SET active = 1, granted_by = excluded.granted_by',
      args: [id, req.product, actor.id],
    });
  }
  if (stmts.length === 0) throw new ApiException('Nothing to change', 409);
  await db.$client.batch(stmts, 'write');

  // Same follow-ups the admin user PATCH route runs (self-guarding no-ops outside qualifying cohorts).
  const byId = new Map(students.map(s => [s.id, s]));
  for (const id of new Set([...plan.repoint, ...plan.grantAccess])) {
    const s = byId.get(id)!;
    clearAccessControlCache(s.email);
    const products = plan.grantAccess.includes(id) ? [...new Set([...s.products, req.product])] : s.products;
    await grantFullVocabAccessIfEligible(id, newBatch, products);
    await assignStudentIdIfEligible(id, newBatch, products);
  }

  await recordAudit({
    actorUserId: actor.id, action: 'batch.rollover', entityType: 'batch',
    before: { oldBatch: req.oldBatch, product: req.product, repointedFrom: plan.repoint.map(id => [id, byId.get(id)?.batch ?? null]) },
    after: { newBatch, createdBatch: plan.createBatch, archivedOld: plan.archiveOld, repointed: plan.repoint.length, accessGranted: plan.grantAccess, skipped: plan.skipped },
  }).catch(e => console.error('[super/people] audit failed', e));
  return plan;
}
