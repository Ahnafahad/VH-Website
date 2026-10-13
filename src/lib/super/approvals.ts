/**
 * Delayed, cancellable destructive actions. proposeAction() only records intent; the cron
 * (runDueActions) or the proposer's "Execute now" runs it. A row is claimed with
 * UPDATE ... WHERE status='pending' (-> 'running'), so two concurrent runners can never both execute it.
 * ponytail: a crash mid-execution leaves the row 'running' (never retried — safer than a double destructive run);
 * the UI shows it so a human can inspect.
 */
import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { superPendingActions, users } from '@/lib/db/schema';
import { recordAudit } from '@/lib/audit-log';

export type Executor = (payload: unknown, ctx: { actionId: number }) => Promise<unknown>;
const executors = new Map<string, Executor>();

export function registerExecutor(action: string, fn: Executor): void {
  executors.set(action, fn);
}
export const hasExecutor = (action: string) => executors.has(action);

export interface ProposeParams { action: string; payload: unknown; summary: string; actorId: number; delayMinutes?: number }

export async function proposeAction(p: ProposeParams): Promise<number> {
  if (!executors.has(p.action)) throw new Error(`Unknown action: ${p.action}`);
  const delay = p.delayMinutes ?? 15;
  const row = await db.insert(superPendingActions).values({
    action: p.action,
    payload: JSON.stringify(p.payload ?? {}),
    summary: p.summary,
    requestedBy: p.actorId,
    executeAfter: new Date(Date.now() + delay * 60_000),
  }).returning({ id: superPendingActions.id }).get();
  await recordAudit({ actorUserId: p.actorId, action: 'approval.propose', entityType: 'super_action', entityId: row.id, after: { action: p.action, summary: p.summary, delayMinutes: delay } });
  return row.id;
}

/** Only a still-pending row can be cancelled. Returns false if it already ran/was cancelled. */
export async function cancelAction(id: number, actorId: number): Promise<boolean> {
  const r = await db.update(superPendingActions)
    .set({ status: 'cancelled', resolvedAt: new Date() })
    .where(and(eq(superPendingActions.id, id), eq(superPendingActions.status, 'pending')))
    .returning({ id: superPendingActions.id });
  if (!r.length) return false;
  await recordAudit({ actorUserId: actorId, action: 'approval.cancel', entityType: 'super_action', entityId: id });
  return true;
}

/** Claims then runs one row. `due` restricts to rows past executeAfter (cron); execute-now passes false. */
async function claimAndRun(id: number, due: boolean): Promise<'executed' | 'failed' | 'skipped'> {
  const conds = [eq(superPendingActions.id, id), eq(superPendingActions.status, 'pending')];
  if (due) conds.push(lte(superPendingActions.executeAfter, new Date()));
  const claimed = await db.update(superPendingActions).set({ status: 'running' }).where(and(...conds)).returning();
  if (!claimed.length) return 'skipped';
  const row = claimed[0];

  let status: 'executed' | 'failed' = 'executed';
  let result: unknown;
  try {
    const fn = executors.get(row.action);
    if (!fn) throw new Error(`No executor registered for ${row.action}`);
    // A queued destructive action dies with its proposer's authority.
    const proposer = row.requestedBy == null ? null : await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, row.requestedBy)).get();
    if (!proposer || proposer.role !== 'super_admin' || proposer.status !== 'active') throw new Error('Proposer is no longer an active super admin');
    result = await fn(JSON.parse(row.payload), { actionId: row.id });
  } catch (e) {
    status = 'failed';
    result = { error: e instanceof Error ? e.message : String(e) };
  }
  await db.update(superPendingActions)
    .set({ status, resolvedAt: new Date(), result: JSON.stringify(result ?? null) })
    .where(eq(superPendingActions.id, row.id));
  try {
    await recordAudit({ actorUserId: row.requestedBy, action: `approval.${status === 'executed' ? 'execute' : 'fail'}`, entityType: 'super_action', entityId: row.id, after: { action: row.action, result } });
  } catch (e) { console.error('[approvals] audit failed', e); }
  return status;
}

/** Proposer-only (caller enforces) immediate run, ignoring the delay. */
export async function executeActionNow(id: number): Promise<'executed' | 'failed' | 'skipped'> {
  return claimAndRun(id, false);
}

export async function runDueActions(): Promise<{ ran: number; failed: number }> {
  const due = await db.select({ id: superPendingActions.id }).from(superPendingActions)
    .where(and(eq(superPendingActions.status, 'pending'), lte(superPendingActions.executeAfter, new Date())))
    .orderBy(superPendingActions.executeAfter).limit(20);
  let ran = 0, failed = 0;
  for (const { id } of due) {
    const r = await claimAndRun(id, true);
    if (r === 'executed') ran++;
    else if (r === 'failed') failed++;
  }
  return { ran, failed };
}
