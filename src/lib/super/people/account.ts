/** Account tools: merge, email fix, studentId reassignment. All audited; root account is never involved. */
import { and, eq, ne } from 'drizzle-orm';
import { db, users } from '@/lib/db';
import { ApiException } from '@/lib/api-utils';
import { clearAccessControlCache } from '@/lib/db-access-control';
import { recordAudit } from '@/lib/audit-log';
import { generateStudentId, last5 } from '@/lib/students/assign-student-id';
import { isRootEmail, type SuperActor } from '@/lib/super/guard';
import { applyMerge, previewMerge, type MergePreview } from './merge';
import { checkStudentId } from './student-id';

const audit = (p: Parameters<typeof recordAudit>[0]) =>
  recordAudit(p).catch(e => console.error('[super/people] audit failed', e));

async function getUser(id: number) {
  const u = await db.select().from(users).where(eq(users.id, id)).get();
  if (!u) throw new ApiException(`User ${id} not found`, 404);
  return u;
}

export async function mergeAccounts(actor: SuperActor, sourceId: number, targetId: number, apply: boolean): Promise<MergePreview> {
  if (sourceId === targetId) throw new ApiException('Source and target must differ', 400);
  const [source, target] = [await getUser(sourceId), await getUser(targetId)];
  if (isRootEmail(source.email)) throw new ApiException('The root account cannot be merged away', 403, 'ROOT_PROTECTED');
  if (source.role !== 'student' || target.role !== 'student') throw new ApiException('Only student accounts can be merged', 409);
  if (!apply) return previewMerge(db.$client, sourceId, targetId);

  const preview = await applyMerge(db.$client, source, target);
  clearAccessControlCache(source.email);
  clearAccessControlCache(target.email);
  await audit({
    actorUserId: actor.id, action: 'account.merge', entityType: 'user', entityId: targetId,
    before: { sourceId, sourceEmail: source.email, sourceStatus: source.status, sourceStudentId: source.studentId },
    after: { targetId, targetEmail: target.email, moved: preview.rows.map(r => ({ table: r.table, moved: r.moved, left: r.conflicts })), registrations: preview.registrations },
  });
  return preview;
}

export async function changeEmail(actor: SuperActor, userId: number, rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiException('Invalid email', 400);
  const user = await getUser(userId);
  if (isRootEmail(user.email) || isRootEmail(email)) throw new ApiException('The root account email cannot be changed', 403, 'ROOT_PROTECTED');
  if (user.email.toLowerCase() === email) throw new ApiException('Email is unchanged', 400);
  const clash = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (clash) throw new ApiException('Another account already uses that email (use Merge instead)', 409);

  // Sessions carry the old email, so force a fresh sign-in.
  await db.update(users).set({ email, sessionsInvalidatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  clearAccessControlCache(user.email);
  clearAccessControlCache(email);
  await audit({ actorUserId: actor.id, action: 'user.email.change', entityType: 'user', entityId: userId, before: { email: user.email }, after: { email } });
  return { email };
}

export async function reassignStudentId(actor: SuperActor, userId: number, mode: 'set' | 'generate' | 'clear', value?: string) {
  const user = await getUser(userId);
  const others = (await db.select({ s: users.studentId }).from(users).where(and(ne(users.id, userId)))).map(r => r.s);
  let next: string | null;
  if (mode === 'clear') next = null;
  else if (mode === 'generate') {
    next = generateStudentId(new Set(others.map(o => (o ? last5(o) : null)).filter((n): n is number => n !== null)));
  } else {
    next = (value ?? '').trim();
    const problem = checkStudentId(next, others);
    if (problem) throw new ApiException(problem, 409);
  }
  await db.update(users).set({ studentId: next, updatedAt: new Date() }).where(eq(users.id, userId));
  clearAccessControlCache(user.email);
  await audit({ actorUserId: actor.id, action: 'user.studentId.change', entityType: 'user', entityId: userId, before: { studentId: user.studentId }, after: { studentId: next } });
  return { studentId: next };
}
