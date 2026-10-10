/**
 * PrintDesk service — every DB read/write for print requests.
 *
 * Who can use it: students with a batch and an LMS product (iba / fbs /
 * fbs_detailed). What they can request: the PDF materials they can already
 * see (shared LMS scope rule), minus solutions — both docType 'solution' and
 * any material used as a homework answer key. Staff (instructors + admins,
 * same rights) download a print pack, which marks the requests printed.
 */

import { after } from 'next/server';
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  assignments,
  materials,
  printRequestItems,
  printRequests,
  users,
  type PrintRequestStatus,
  type UserWithProducts,
} from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import { isStaffRole } from '@/lib/auth/roles';
import { lmsScopeConditions } from '@/lib/lms/access';
import { SUBJECT_LABELS } from '@/lib/lms/subject-constants';
import { notifyStudents } from '@/lib/notifications/notify-students';
import { resolveFileUrl } from '@/lib/storage/r2';
import { LIVE_STATUSES, canStaffMove, isPrintableMaterial, validateSelection } from './rules';

const LMS_PRODUCTS = ['iba', 'fbs', 'fbs_detailed'];

export function printDeskEligibility(user: UserWithProducts): { ok: true } | { ok: false; reason: string } {
  if (isStaffRole(user.role)) return { ok: false, reason: 'staff' };
  if (!user.products.some(p => LMS_PRODUCTS.includes(p))) return { ok: false, reason: 'PrintDesk is for enrolled IBA and FBS students.' };
  if (!user.batch) return { ok: false, reason: 'PrintDesk opens once you have been assigned to a batch.' };
  return { ok: true };
}

function requireEligible(user: UserWithProducts) {
  const e = printDeskEligibility(user);
  if (!e.ok) throw new ApiException(e.reason === 'staff' ? 'Staff manage print requests from the admin panel' : e.reason, 403, 'PRINTDESK_INELIGIBLE');
}

async function solutionMaterialIds(): Promise<Set<number>> {
  const rows = await db.select({ id: assignments.solutionMaterialId }).from(assignments).where(isNotNull(assignments.solutionMaterialId));
  return new Set(rows.map(r => r.id!));
}

export interface PrintableMaterial {
  id: number;
  title: string;
  subject: string;
  docType: string | null;
  number: string | null;
  topic: string | null;
  createdAt: number;
}

export async function printableMaterialsFor(user: UserWithProducts): Promise<PrintableMaterial[]> {
  const rows = await db
    .select()
    .from(materials)
    .where(and(eq(materials.type, 'pdf'), ...lmsScopeConditions(user, materials)))
    .orderBy(asc(materials.subject), desc(materials.createdAt));
  const solutions = await solutionMaterialIds();
  return rows
    .filter(m => isPrintableMaterial(m, solutions, m.id))
    .map(m => ({ id: m.id, title: m.title, subject: m.subject, docType: m.docType, number: m.number, topic: m.topic, createdAt: m.createdAt.getTime() }));
}

async function itemsFor(requestIds: number[]) {
  if (requestIds.length === 0) return [];
  return db
    .select({ requestId: printRequestItems.requestId, materialId: materials.id, title: materials.title, subject: materials.subject, docType: materials.docType })
    .from(printRequestItems)
    .innerJoin(materials, eq(materials.id, printRequestItems.materialId))
    .where(inArray(printRequestItems.requestId, requestIds))
    .orderBy(asc(materials.subject), asc(materials.title));
}

/** Material ids on the student's live requests, optionally ignoring one request (when editing it). */
async function takenMaterialIds(userId: number, exceptRequestId?: number): Promise<Set<number>> {
  const rows = await db
    .select({ requestId: printRequests.id, materialId: printRequestItems.materialId })
    .from(printRequestItems)
    .innerJoin(printRequests, eq(printRequests.id, printRequestItems.requestId))
    .where(and(eq(printRequests.userId, userId), inArray(printRequests.status, LIVE_STATUSES)));
  return new Set(rows.filter(r => r.requestId !== exceptRequestId).map(r => r.materialId));
}

// ─── Student ─────────────────────────────────────────────────────────────────

export async function getStudentView(user: UserWithProducts) {
  const e = printDeskEligibility(user);
  if (!e.ok) return { eligible: false as const, reason: e.reason === 'staff' ? 'Staff manage print requests from Admin → PrintDesk.' : e.reason };
  const [mats, requests] = await Promise.all([
    printableMaterialsFor(user),
    db.select().from(printRequests).where(eq(printRequests.userId, user.id)).orderBy(desc(printRequests.createdAt)),
  ]);
  const items = await itemsFor(requests.map(r => r.id));
  const taken = await takenMaterialIds(user.id);
  return {
    eligible: true as const,
    materials: mats.map(m => ({ ...m, alreadyRequested: taken.has(m.id) })),
    requests: requests.map(r => ({
      id: r.id,
      status: r.status as PrintRequestStatus,
      rejectReason: r.rejectReason,
      createdAt: r.createdAt.toISOString(),
      printedAt: r.printedAt?.toISOString() ?? null,
      collectedAt: r.collectedAt?.toISOString() ?? null,
      items: items.filter(i => i.requestId === r.id).map(i => ({ materialId: i.materialId, title: i.title, subject: i.subject })),
    })),
  };
}

export async function createRequest(user: UserWithProducts, rawIds: unknown) {
  requireEligible(user);
  const printable = new Set((await printableMaterialsFor(user)).map(m => m.id));
  const v = validateSelection(rawIds, printable, await takenMaterialIds(user.id));
  if ('error' in v) throw new ApiException(v.error, 400);
  const id = await db.transaction(async tx => {
    const [row] = await tx.insert(printRequests).values({ userId: user.id }).returning({ id: printRequests.id });
    await tx.insert(printRequestItems).values(v.ids.map(materialId => ({ requestId: row.id, materialId })));
    return row.id;
  });
  return { id };
}

async function ownRequest(user: UserWithProducts, id: number) {
  const r = await db.select().from(printRequests).where(and(eq(printRequests.id, id), eq(printRequests.userId, user.id))).get();
  if (!r) throw new ApiException('Request not found', 404);
  if (r.status !== 'requested') throw new ApiException('This request is already being handled and can no longer be changed', 409, 'NOT_EDITABLE');
  return r;
}

export async function updateRequest(user: UserWithProducts, id: number, rawIds: unknown) {
  requireEligible(user);
  await ownRequest(user, id);
  const printable = new Set((await printableMaterialsFor(user)).map(m => m.id));
  const v = validateSelection(rawIds, printable, await takenMaterialIds(user.id, id));
  if ('error' in v) throw new ApiException(v.error, 400);
  await db.transaction(async tx => {
    // Re-check inside the transaction so a staff download can't race the edit.
    const still = await tx.select({ status: printRequests.status }).from(printRequests).where(eq(printRequests.id, id)).get();
    if (still?.status !== 'requested') throw new ApiException('This request is already being handled and can no longer be changed', 409, 'NOT_EDITABLE');
    await tx.delete(printRequestItems).where(eq(printRequestItems.requestId, id));
    await tx.insert(printRequestItems).values(v.ids.map(materialId => ({ requestId: id, materialId })));
    await tx.update(printRequests).set({ updatedAt: new Date() }).where(eq(printRequests.id, id));
  });
  return { id };
}

export async function cancelRequest(user: UserWithProducts, id: number) {
  await ownRequest(user, id);
  const now = new Date();
  const done = await db
    .update(printRequests)
    .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
    .where(and(eq(printRequests.id, id), eq(printRequests.status, 'requested')))
    .returning({ id: printRequests.id });
  if (done.length === 0) throw new ApiException('This request is already being handled and can no longer be changed', 409, 'NOT_EDITABLE');
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export async function listRequestsForStaff() {
  const rows = await db
    .select({ r: printRequests, name: users.name, email: users.email, studentId: users.studentId, batch: users.batch })
    .from(printRequests)
    .innerJoin(users, eq(users.id, printRequests.userId))
    .orderBy(desc(printRequests.createdAt));
  const items = await itemsFor(rows.map(x => x.r.id));
  const staffIds = [...new Set(rows.flatMap(x => [x.r.printedBy, x.r.collectedBy, x.r.rejectedBy]).filter((v): v is number => v !== null))];
  const staff = staffIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, staffIds)) : [];
  const nameOf = (id: number | null) => (id === null ? null : staff.find(s => s.id === id)?.name ?? null);
  return rows.map(({ r, name, email, studentId, batch }) => ({
    id: r.id,
    status: r.status as PrintRequestStatus,
    student: { id: r.userId, name, email, studentId, batch },
    items: items.filter(i => i.requestId === r.id).map(i => ({ materialId: i.materialId, title: i.title, subject: i.subject })),
    rejectReason: r.rejectReason,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    printedAt: r.printedAt?.toISOString() ?? null,
    printedBy: nameOf(r.printedBy),
    collectedAt: r.collectedAt?.toISOString() ?? null,
    collectedBy: nameOf(r.collectedBy),
    rejectedBy: nameOf(r.rejectedBy),
  }));
}

function parseIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) throw new ApiException('requestIds must be a list', 400);
  const ids = [...new Set(raw.map(Number))].filter(n => Number.isInteger(n) && n > 0);
  if (ids.length === 0) throw new ApiException('Select at least one request', 400);
  return ids;
}

function notifyPrinted(userIds: number[]) {
  after(() =>
    notifyStudents(userIds, {
      kicker: 'VH PrintDesk',
      subject: 'Your printed materials are ready',
      heading: 'Ready to collect',
      message: 'The materials you requested on PrintDesk have been printed. Collect them from the centre on your next visit.',
      path: '/printdesk',
      ctaLabel: 'View my requests',
    }).catch(err => console.error('[printdesk] notify failed', err)),
  );
}

/**
 * Builds a print pack for the selected requests: every distinct material with
 * a fetchable URL and the students who asked for it. Requests still in
 * 'requested' are marked printed by this call (downloading = approving);
 * already-printed ones can be re-downloaded without changing anything.
 */
export async function buildPack(staff: UserWithProducts, rawIds: unknown) {
  const ids = parseIds(rawIds);
  const rows = await db
    .select({ id: printRequests.id, status: printRequests.status, userId: printRequests.userId, name: users.name })
    .from(printRequests)
    .innerJoin(users, eq(users.id, printRequests.userId))
    .where(and(inArray(printRequests.id, ids), inArray(printRequests.status, ['requested', 'printed'])));
  if (rows.length === 0) throw new ApiException('None of those requests can be printed', 409);

  const now = new Date();
  const toMark = rows.filter(r => r.status === 'requested').map(r => r.id);
  const marked = toMark.length
    ? await db
        .update(printRequests)
        .set({ status: 'printed', printedAt: now, printedBy: staff.id, updatedAt: now })
        .where(and(inArray(printRequests.id, toMark), eq(printRequests.status, 'requested')))
        .returning({ id: printRequests.id, userId: printRequests.userId })
    : [];
  if (marked.length) notifyPrinted(marked.map(m => m.userId));

  const items = await itemsFor(rows.map(r => r.id));
  const byMaterial = new Map<number, { materialId: number; title: string; subject: string; students: string[] }>();
  for (const it of items) {
    const student = rows.find(r => r.id === it.requestId)!.name;
    const e = byMaterial.get(it.materialId) ?? {
      materialId: it.materialId, title: it.title, subject: SUBJECT_LABELS[it.subject as keyof typeof SUBJECT_LABELS] ?? it.subject, students: [],
    };
    e.students.push(student);
    byMaterial.set(it.materialId, e);
  }
  const refs = await db
    .select({ id: materials.id, blobUrl: materials.blobUrl, fileName: materials.fileName })
    .from(materials)
    .where(inArray(materials.id, [...byMaterial.keys()]));
  const lines = await Promise.all(
    [...byMaterial.values()].map(async l => {
      const ref = refs.find(r => r.id === l.materialId);
      return { ...l, fileName: ref?.fileName ?? null, url: ref ? await resolveFileUrl(ref.blobUrl, 3600) : null };
    }),
  );
  lines.sort((a, b) => a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title));
  return { requestIds: rows.map(r => r.id), markedPrinted: marked.length, generatedAt: now.toISOString(), lines };
}

export async function setStatus(staff: UserWithProducts, rawIds: unknown, rawStatus: unknown, rawReason: unknown) {
  const ids = parseIds(rawIds);
  const to = rawStatus as PrintRequestStatus;
  if (!['printed', 'collected', 'rejected', 'requested'].includes(to)) throw new ApiException('Invalid status', 400);
  const reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, 500) : '';
  if (to === 'rejected' && !reason) throw new ApiException('Give the student a reason', 400);

  const rows = await db.select().from(printRequests).where(inArray(printRequests.id, ids));
  const movable = rows.filter(r => canStaffMove(r.status as PrintRequestStatus, to));
  if (movable.length === 0) throw new ApiException('Those requests can’t be moved to that status', 409);

  const now = new Date();
  const patch =
    to === 'printed' ? { status: to, printedAt: now, printedBy: staff.id, collectedAt: null, collectedBy: null }
    : to === 'collected' ? { status: to, collectedAt: now, collectedBy: staff.id }
    : to === 'rejected' ? { status: to, rejectReason: reason, rejectedAt: now, rejectedBy: staff.id }
    : { status: to, printedAt: null, printedBy: null };
  let moved: { id: number; userId: number; from: string }[] = [];
  for (const r of movable) {
    const done = await db
      .update(printRequests)
      .set({ ...patch, updatedAt: now })
      .where(and(eq(printRequests.id, r.id), eq(printRequests.status, r.status)))
      .returning({ id: printRequests.id, userId: printRequests.userId });
    if (done.length) moved = [...moved, { ...done[0], from: r.status }];
  }

  if (to === 'printed') notifyPrinted(moved.filter(m => m.from === 'requested').map(m => m.userId));
  if (to === 'rejected' && moved.length) {
    after(() =>
      notifyStudents(moved.map(m => m.userId), {
        kicker: 'VH PrintDesk',
        subject: 'Your print request was declined',
        heading: 'Print request declined',
        message: `Your PrintDesk request was declined.\nReason: ${reason}\nThe materials are free to request again.`,
        path: '/printdesk',
        ctaLabel: 'Open PrintDesk',
      }).catch(err => console.error('[printdesk] notify failed', err)),
    );
  }
  return { moved: moved.length, skipped: ids.length - moved.length };
}
