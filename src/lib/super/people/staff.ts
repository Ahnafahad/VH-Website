/**
 * Staff manager service: list admin/instructor/super_admin users, apply a guarded change, and the
 * instructor workload panel. Role semantics reuse assertRoleAssignable + clearAccessControlCache exactly as
 * /api/admin/users/[id] and its /suspend sibling do.
 */
import { and, count, eq, gte, inArray, isNotNull, max, or, sql } from 'drizzle-orm';
import {
  db, users, authEvents, classSessions, recordings, materials, essaySubmissions,
} from '@/lib/db';
import { ApiException } from '@/lib/api-utils';
import { assertRoleAssignable } from '@/lib/admin/role-guards';
import { clearAccessControlCache } from '@/lib/db-access-control';
import { recordAudit } from '@/lib/audit-log';
import type { SuperActor } from '@/lib/super/guard';
import { assertStaffChange, type StaffChange } from './guards';

export interface StaffRow {
  id: number; email: string; name: string; role: string; status: string;
  readOnly: boolean; isTeaching: boolean; lastSignIn: number | null; batches: string[];
}

export async function listStaff(): Promise<StaffRow[]> {
  const rows = await db.select().from(users)
    .where(or(inArray(users.role, ['admin', 'instructor', 'super_admin']), eq(users.isTeaching, true)))
    .orderBy(users.name);
  const ids = rows.map(r => r.id);
  if (ids.length === 0) return [];

  const [signins, taught] = await Promise.all([
    db.select({ userId: authEvents.userId, at: max(authEvents.createdAt) }).from(authEvents)
      .where(and(eq(authEvents.type, 'signin'), inArray(authEvents.userId, ids))).groupBy(authEvents.userId),
    db.selectDistinct({ instructorId: classSessions.instructorId, batch: classSessions.batch }).from(classSessions)
      .where(and(inArray(classSessions.instructorId, ids), isNotNull(classSessions.batch))),
  ]);
  const lastBy = new Map(signins.map(s => [s.userId, s.at]));
  const batchBy = new Map<number, string[]>();
  for (const t of taught) {
    if (t.instructorId == null || !t.batch) continue;
    batchBy.set(t.instructorId, [...(batchBy.get(t.instructorId) ?? []), t.batch]);
  }
  return rows.map(r => {
    const at = lastBy.get(r.id);
    return {
      id: r.id, email: r.email, name: r.name, role: r.role, status: r.status,
      readOnly: r.readOnly, isTeaching: !!r.isTeaching,
      lastSignIn: at ? new Date(at as unknown as number | Date).getTime() : null,
      batches: batchBy.get(r.id) ?? [],
    };
  });
}

export async function applyStaffChange(actor: SuperActor, userId: number, change: StaffChange) {
  const target = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!target) throw new ApiException('User not found', 404);

  const [{ n }] = await db.select({ n: count() }).from(users)
    .where(and(eq(users.role, 'super_admin'), eq(users.status, 'active')));

  if (change.kind === 'role') assertRoleAssignable(change.role, 'super_admin');
  assertStaffChange({ actorId: actor.id, target, change, activeSuperAdmins: n });

  const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  let action: string;
  let before: Record<string, unknown>;
  let after: Record<string, unknown>;
  let kickSessions = false;

  switch (change.kind) {
    case 'role':
      action = 'role.change'; before = { role: target.role }; after = { role: change.role };
      set.role = change.role; kickSessions = change.role !== target.role; break;
    case 'suspend':
    case 'unsuspend':
      action = 'user.suspend'; before = { status: target.status };
      set.status = change.kind === 'suspend' ? 'inactive' : 'active'; after = { status: set.status };
      kickSessions = change.kind === 'suspend'; break;
    case 'readonly':
      action = 'user.readonly'; before = { readOnly: target.readOnly }; after = { readOnly: change.value };
      set.readOnly = change.value; break;
    case 'teaching':
      action = 'user.teaching'; before = { isTeaching: !!target.isTeaching }; after = { isTeaching: change.value };
      set.isTeaching = change.value; break;
    case 'remove':
      action = 'staff.remove';
      before = { role: target.role, isTeaching: !!target.isTeaching, readOnly: target.readOnly };
      after = { role: 'student', isTeaching: false, readOnly: false };
      set.role = 'student'; set.isTeaching = false; set.readOnly = false; kickSessions = true; break;
  }
  if (kickSessions) set.sessionsInvalidatedAt = new Date();

  await db.update(users).set(set).where(eq(users.id, userId));
  clearAccessControlCache(target.email);
  await recordAudit({ actorUserId: actor.id, action, entityType: 'user', entityId: userId, before, after })
    .catch(e => console.error('[super/people] audit failed', e));
  return { ok: true };
}

export interface WorkloadRow {
  instructorId: number; classes: number; recordings: number; materials: number;
  essaysGraded: number; essaysAssignedPending: number;
}

/** One grouped query per metric over the last 30 days (backlog = currently pending, any age). */
export async function getWorkload(): Promise<{ rows: WorkloadRow[]; unassignedEssayBacklog: number }> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [classes, recs, mats, graded, pending, unassigned] = await Promise.all([
    db.select({ id: classSessions.instructorId, n: count() }).from(classSessions)
      .where(and(eq(classSessions.status, 'completed'), gte(classSessions.scheduledAt, since), isNotNull(classSessions.instructorId)))
      .groupBy(classSessions.instructorId),
    db.select({ id: classSessions.instructorId, n: count() }).from(recordings)
      .innerJoin(classSessions, eq(recordings.classSessionId, classSessions.id))
      .where(and(eq(recordings.status, 'available'), gte(recordings.createdAt, since), isNotNull(classSessions.instructorId)))
      .groupBy(classSessions.instructorId),
    db.select({ id: materials.uploadedBy, n: count() }).from(materials)
      .where(gte(materials.createdAt, since)).groupBy(materials.uploadedBy),
    db.select({ id: essaySubmissions.gradedBy, n: count() }).from(essaySubmissions)
      .where(and(eq(essaySubmissions.status, 'graded'), gte(essaySubmissions.gradedAt, since), isNotNull(essaySubmissions.gradedBy)))
      .groupBy(essaySubmissions.gradedBy),
    db.select({ id: essaySubmissions.assignedTo, n: count() }).from(essaySubmissions)
      .where(and(eq(essaySubmissions.status, 'submitted'), isNotNull(essaySubmissions.assignedTo)))
      .groupBy(essaySubmissions.assignedTo),
    db.select({ n: count() }).from(essaySubmissions)
      .where(and(eq(essaySubmissions.status, 'submitted'), sql`${essaySubmissions.assignedTo} IS NULL`)),
  ]);

  const map = new Map<number, WorkloadRow>();
  const row = (id: number) => {
    let r = map.get(id);
    if (!r) { r = { instructorId: id, classes: 0, recordings: 0, materials: 0, essaysGraded: 0, essaysAssignedPending: 0 }; map.set(id, r); }
    return r;
  };
  for (const x of classes) row(x.id!).classes = x.n;
  for (const x of recs) row(x.id!).recordings = x.n;
  for (const x of mats) row(x.id).materials = x.n;
  for (const x of graded) row(x.id!).essaysGraded = x.n;
  for (const x of pending) row(x.id!).essaysAssignedPending = x.n;
  return { rows: [...map.values()], unassignedEssayBacklog: unassigned[0]?.n ?? 0 };
}
