/**
 * Batch rollover planner (pure). Decides, for a chosen set of students, who gets re-pointed to the new batch,
 * whether the batch row must be created, whether the old one gets archived and who needs the product granted.
 * The apply step (DB writes) lives in rollover-apply.ts and only executes what this returns.
 */

export interface RolloverStudent { id: number; role: string; status: string; batch: string | null; products: string[] }
export interface RolloverBatchRow { name: string; product: string; status: string }

export interface RolloverInput {
  product: string;
  newBatch: string;
  oldBatch: string | null;
  archiveOld: boolean;
  copyAccess: boolean;
  students: RolloverStudent[];
  batchRows: RolloverBatchRow[];
}

export interface RolloverPlan {
  createBatch: boolean;
  reviveBatch: boolean;        // new batch row exists but is archived -> set active
  archiveOld: boolean;
  repoint: number[];           // user ids whose users.batch changes
  alreadyThere: number[];      // already in the new batch
  grantAccess: number[];       // user ids that need an active `product` access row
  skipped: { id: number; reason: string }[];
}

export function planRollover(i: RolloverInput): RolloverPlan {
  const newBatch = i.newBatch.trim();
  const existing = i.batchRows.find(b => b.name === newBatch && b.product === i.product);
  const old = i.oldBatch ? i.batchRows.find(b => b.name === i.oldBatch && b.product === i.product) : undefined;

  const plan: RolloverPlan = {
    createBatch: !existing,
    reviveBatch: !!existing && existing.status !== 'active',
    archiveOld: i.archiveOld && !!old && old.status === 'active' && old.name !== newBatch,
    repoint: [], alreadyThere: [], grantAccess: [], skipped: [],
  };

  for (const s of i.students) {
    if (s.role !== 'student') { plan.skipped.push({ id: s.id, reason: `role is ${s.role}` }); continue; }
    if (s.status !== 'active') { plan.skipped.push({ id: s.id, reason: `status is ${s.status}` }); continue; }
    if (s.batch === newBatch) plan.alreadyThere.push(s.id); else plan.repoint.push(s.id);
    if (i.copyAccess && !s.products.includes(i.product)) plan.grantAccess.push(s.id);
  }
  return plan;
}
