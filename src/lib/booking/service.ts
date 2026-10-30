/**
 * 1-on-1 session requests: student asks with a few times → instructor accepts
 * one or counters (specific times / ranges) → student picks → once both sides
 * have agreed, a Meet link (online) or a calendar event (offline) is created.
 *
 * status: pending (waiting on the instructor) → proposed (waiting on the
 * student) ⇄ pending → scheduled | declined | cancelled
 *
 * Every state change is a conditional UPDATE ... WHERE status = <expected>
 * RETURNING, so two people acting at once cannot both win.
 */

import { and, desc, eq, gt, inArray, lt, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sessionRequests, type UserWithProducts } from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import { isStaffRole, isSuperAdminRole } from '@/lib/auth/roles';
import { SUBJECTS, SUBJECT_LABELS, isLmsSubject, productForSubject } from '@/lib/lms/subject-constants';
import { createMeetEvent, createInPersonEvent, deleteMeetEvent } from '@/lib/google/calendar';
import {
  CANCEL_CUTOFF_MS,
  isStartAllowed,
  overlaps,
  parsePreferredTimes,
  parseProposals,
  resolveMode,
  validatePreferredTimes,
  validateProposals,
  type Proposal,
} from './logic';
import { canHandleProduct, getEligibleInstructors, getInstructorProducts, getPeople, type Person } from './people';
import { mails, sendAll, type RequestFacts } from './notify';

type RequestRow = typeof sessionRequests.$inferSelect;

const MAX_OPEN_REQUESTS = 2;
const VALID_PREFERRED_MODES = ['online', 'offline', 'either'] as const;

// ─── Views ───────────────────────────────────────────────────────────────────

export interface RequestView {
  id: number;
  userId: number;
  studentName: string;
  subject: string;
  subjectLabel: string;
  product: string;
  topic: string;
  preferredMode: string;
  durationMinutes: number;
  notes: string | null;
  status: string;
  preferredTimes: number[];
  proposals: Proposal[];
  instructorId: number | null;
  instructorName: string | null;
  mode: string | null;
  location: string | null;
  startAt: number | null;
  endAt: number | null;
  meetLink: string | null;
  staffNote: string | null;
  createdAt: number;
}

function toView(r: RequestRow, people: Map<number, Person>): RequestView {
  return {
    id: r.id,
    userId: r.userId,
    studentName: people.get(r.userId)?.name ?? 'Student',
    subject: r.subject,
    subjectLabel: isLmsSubject(r.subject) ? SUBJECT_LABELS[r.subject] : r.subject,
    product: r.product,
    topic: r.topic,
    preferredMode: r.preferredMode,
    durationMinutes: r.durationMinutes,
    notes: r.notes,
    status: r.status,
    preferredTimes: parsePreferredTimes(r.preferredTimes),
    proposals: parseProposals(r.proposals),
    instructorId: r.instructorId,
    instructorName: r.instructorId ? (people.get(r.instructorId)?.name ?? null) : null,
    mode: r.mode,
    location: r.location,
    startAt: r.startAt ? r.startAt.getTime() : null,
    endAt: r.endAt ? r.endAt.getTime() : null,
    meetLink: r.meetLink,
    staffNote: r.staffNote,
    createdAt: r.createdAt.getTime(),
  };
}

async function viewsFor(rows: RequestRow[]): Promise<RequestView[]> {
  const people = await getPeople(rows.flatMap((r) => [r.userId, ...(r.instructorId ? [r.instructorId] : [])]));
  return rows.map((r) => toView(r, people));
}

function facts(r: RequestRow, studentName: string): RequestFacts {
  return {
    studentName,
    subjectLabel: isLmsSubject(r.subject) ? SUBJECT_LABELS[r.subject] : r.subject,
    topic: r.topic,
    durationMinutes: r.durationMinutes,
    modeLabel: r.preferredMode === 'either' ? 'Online or in person' : r.preferredMode === 'online' ? 'Online' : 'In person',
    notes: r.notes,
  };
}

async function load(id: number): Promise<RequestRow> {
  const [r] = await db.select().from(sessionRequests).where(eq(sessionRequests.id, id)).limit(1);
  if (!r) throw new ApiException('Request not found', 404, 'REQUEST_NOT_FOUND');
  return r;
}

/** Conditional state change; null means someone else changed the request first. */
async function transition(
  id: number,
  from: string[],
  set: Partial<typeof sessionRequests.$inferInsert>,
): Promise<RequestRow | null> {
  const [row] = await db
    .update(sessionRequests)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(sessionRequests.id, id), inArray(sessionRequests.status, from)))
    .returning();
  return row ?? null;
}

const RACE = () => new ApiException('This request was just updated by someone else. Refresh and try again.', 409, 'REQUEST_CHANGED');

// ─── Student: list + create ──────────────────────────────────────────────────

export async function listMine(me: UserWithProducts): Promise<RequestView[]> {
  const rows = await db
    .select()
    .from(sessionRequests)
    .where(eq(sessionRequests.userId, me.id))
    .orderBy(desc(sessionRequests.createdAt))
    .limit(50);
  return viewsFor(rows);
}

/** Subjects this user may request (their products; staff get all, for testing). */
export function requestableSubjects(me: UserWithProducts): string[] {
  if (isStaffRole(me.role)) return [...SUBJECTS];
  return SUBJECTS.filter((s) => {
    const p = productForSubject(s);
    return p === 'iba' ? me.products.includes('iba') : me.products.includes('fbs') || me.products.includes('fbs_detailed');
  });
}

export async function createRequest(
  me: UserWithProducts,
  body: {
    subject?: string; topic?: string; preferredMode?: string;
    durationMinutes?: number; notes?: string; preferredTimes?: unknown[];
  },
): Promise<RequestView> {
  const { subject, topic, preferredMode, durationMinutes, notes } = body;
  if (!subject || !isLmsSubject(subject) || !requestableSubjects(me).includes(subject)) {
    throw new ApiException('Choose one of your subjects.', 400);
  }
  if (!topic || typeof topic !== 'string' || !topic.trim()) throw new ApiException('Topic is required.', 400);
  if (!preferredMode || !(VALID_PREFERRED_MODES as readonly string[]).includes(preferredMode)) {
    throw new ApiException('Mode must be online, in person, or either.', 400);
  }
  if (typeof durationMinutes !== 'number' || durationMinutes < 15 || durationMinutes > 120) {
    throw new ApiException('Session length must be between 15 and 120 minutes.', 400);
  }
  const times = Array.isArray(body.preferredTimes) ? body.preferredTimes : [];
  const timeError = validatePreferredTimes(times, Date.now());
  if (timeError) throw new ApiException(timeError, 400);

  const open = await db
    .select({ id: sessionRequests.id })
    .from(sessionRequests)
    .where(and(eq(sessionRequests.userId, me.id), inArray(sessionRequests.status, ['pending', 'proposed'])));
  if (open.length >= MAX_OPEN_REQUESTS) {
    throw new ApiException(`You already have ${MAX_OPEN_REQUESTS} open requests. Wait for a reply or cancel one first.`, 409, 'TOO_MANY_OPEN');
  }

  const product = productForSubject(subject) ?? 'iba';
  const [created] = await db
    .insert(sessionRequests)
    .values({
      userId: me.id,
      subject,
      product,
      batch: me.batch ?? null,
      topic: topic.trim(),
      preferredMode,
      durationMinutes,
      notes: notes?.trim() || null,
      status: 'pending',
      preferredTimes: JSON.stringify(times),
    })
    .returning();

  const instructors = await getEligibleInstructors(product);
  await sendAll(instructors.map((i) => mails.requested(i.email, facts(created, me.name), times as number[], false)));

  return (await viewsFor([created]))[0];
}

// ─── Staff: list ─────────────────────────────────────────────────────────────

export async function listForStaff(me: UserWithProducts): Promise<RequestView[]> {
  if (!isStaffRole(me.role)) throw new ApiException('Staff access required', 403, 'FORBIDDEN');
  const rows = await db.select().from(sessionRequests).orderBy(desc(sessionRequests.createdAt)).limit(300);

  let visible = rows;
  if (!isSuperAdminRole(me.role)) {
    const mine = await getInstructorProducts(me.id);
    visible = rows.filter((r) => mine.includes(r.product) && (r.instructorId === null || r.instructorId === me.id));
  }
  return viewsFor(visible);
}

// ─── Confirming: both sides have agreed ──────────────────────────────────────

async function finalize(
  r: RequestRow,
  from: 'pending' | 'proposed',
  a: { startAt: number; instructor: Person; mode: 'online' | 'offline'; location: string | null },
): Promise<RequestView> {
  const start = new Date(a.startAt);
  const end = new Date(a.startAt + r.durationMinutes * 60_000);

  // Neither side may be double-booked.
  const clashes = await db
    .select()
    .from(sessionRequests)
    .where(and(
      eq(sessionRequests.status, 'scheduled'),
      ne(sessionRequests.id, r.id),
      lt(sessionRequests.startAt, end),
      gt(sessionRequests.endAt, start),
    ));
  for (const c of clashes) {
    if (!c.startAt || !c.endAt || !overlaps(a.startAt, end.getTime(), c.startAt.getTime(), c.endAt.getTime())) continue;
    if (c.instructorId === a.instructor.id) throw new ApiException('The instructor already has a session at that time.', 409, 'INSTRUCTOR_BUSY');
    if (c.userId === r.userId) throw new ApiException('The student already has a session at that time.', 409, 'STUDENT_BUSY');
  }

  const claimed = await transition(r.id, [from], {
    status: 'scheduled',
    startAt: start,
    endAt: end,
    instructorId: a.instructor.id,
    mode: a.mode,
    location: a.location,
  });
  if (!claimed) throw RACE();

  const people = await getPeople([r.userId]);
  const student = people.get(r.userId);
  const title = `1-on-1: ${isLmsSubject(r.subject) ? SUBJECT_LABELS[r.subject] : r.subject} — ${r.topic}`;
  const description = `Student: ${student?.name ?? ''}\nInstructor: ${a.instructor.name}`;
  const attendeeEmails = [student?.email, a.instructor.email].filter((e): e is string => !!e);

  let meetLink: string | null = null;
  let eventId: string | null = null;
  try {
    if (a.mode === 'online') {
      const res = await createMeetEvent({ title, description, startISO: start.toISOString(), endISO: end.toISOString(), attendeeEmails });
      if (!res) throw new Error('Google Calendar is not connected');
      meetLink = res.meetLink;
      eventId = res.eventId;
    } else {
      const res = await createInPersonEvent({ title, description, location: a.location ?? undefined, startISO: start.toISOString(), endISO: end.toISOString(), attendeeEmails });
      eventId = res?.eventId ?? null; // an in-person session is still valid without a calendar entry
    }
  } catch (err) {
    console.error('[booking] calendar event failed:', err);
    if (a.mode === 'online') {
      // A confirmed online session must never lack a link: put the request back.
      await db
        .update(sessionRequests)
        .set({
          status: from, startAt: null, endAt: null, instructorId: r.instructorId,
          mode: r.mode, location: r.location, updatedAt: new Date(),
        })
        .where(eq(sessionRequests.id, r.id));
      throw new ApiException('Could not create the Meet link. Nothing was confirmed; please try again in a minute.', 502, 'MEET_FAILED');
    }
  }

  const [done] = await db
    .update(sessionRequests)
    .set({ meetLink, googleEventId: eventId, updatedAt: new Date() })
    .where(eq(sessionRequests.id, r.id))
    .returning();

  const f = facts(r, student?.name ?? 'Student');
  const where = a.mode === 'online' ? meetLink : a.location;
  const mailsOut = [mails.confirmed(a.instructor.email, f, a.startAt, student?.name ?? 'the student', a.mode === 'online', where, false)];
  if (student) mailsOut.push(mails.confirmed(student.email, f, a.startAt, a.instructor.name, a.mode === 'online', where, true));
  await sendAll(mailsOut);

  return (await viewsFor([done]))[0];
}

// ─── Instructor actions ──────────────────────────────────────────────────────

export async function staffAct(
  me: UserWithProducts,
  id: number,
  body: {
    action?: string; startAt?: number; proposals?: Proposal[];
    mode?: string; location?: string; note?: string;
  },
): Promise<RequestView> {
  if (!isStaffRole(me.role)) throw new ApiException('Staff access required', 403, 'FORBIDDEN');
  const r = await load(id);
  if (!(await canHandleProduct(me, r.product))) {
    throw new ApiException(`You don't handle ${r.product.toUpperCase()} sessions.`, 403, 'NOT_YOUR_PRODUCT');
  }
  const superAdmin = isSuperAdminRole(me.role);
  const owns = r.instructorId === null || r.instructorId === me.id || superAdmin;
  const durationMs = r.durationMinutes * 60_000;
  const meP: Person = { id: me.id, name: me.name, email: me.email };
  const student = (await getPeople([r.userId])).get(r.userId);
  const f = facts(r, student?.name ?? 'Student');

  switch (body.action) {
    case 'accept': {
      if (r.status !== 'pending') throw new ApiException(`This request is already ${r.status}.`, 409, 'ALREADY_RESOLVED');
      if (!owns) throw new ApiException('Another instructor already took this request.', 409, 'TAKEN');
      if (typeof body.startAt !== 'number' || !isStartAllowed(body.startAt, parsePreferredTimes(r.preferredTimes), durationMs)) {
        throw new ApiException("Pick one of the student's times.", 400);
      }
      const m = resolveMode(r.preferredMode, body.mode, body.location);
      if ('error' in m) throw new ApiException(m.error, 400);
      return finalize(r, 'pending', { startAt: body.startAt, instructor: meP, ...m });
    }

    case 'propose': {
      if (r.status !== 'pending') throw new ApiException(`This request is already ${r.status}.`, 409, 'ALREADY_RESOLVED');
      if (!owns) throw new ApiException('Another instructor already took this request.', 409, 'TAKEN');
      const proposals = (body.proposals ?? []).map((p) =>
        p.endAt === undefined || p.endAt === null ? { startAt: p.startAt } : { startAt: p.startAt, endAt: p.endAt });
      const err = validateProposals(proposals, r.durationMinutes, Date.now());
      if (err) throw new ApiException(err, 400);
      const m = resolveMode(r.preferredMode, body.mode, body.location);
      if ('error' in m) throw new ApiException(m.error, 400);
      const row = await transition(id, ['pending'], {
        status: 'proposed', proposals: JSON.stringify(proposals), instructorId: me.id, mode: m.mode, location: m.location,
      });
      if (!row) throw RACE();
      if (student) await sendAll([mails.proposed(student.email, f, me.name, proposals)]);
      return (await viewsFor([row]))[0];
    }

    case 'decline': {
      if (r.status !== 'pending') throw new ApiException(`This request is already ${r.status}.`, 409, 'ALREADY_RESOLVED');
      if (!owns) throw new ApiException('Another instructor already took this request.', 409, 'TAKEN');
      const note = body.note?.trim() || null;
      const row = await transition(id, ['pending'], { status: 'declined', instructorId: me.id, staffNote: note });
      if (!row) throw RACE();
      if (student) await sendAll([mails.declined(student.email, f, me.name, note)]);
      return (await viewsFor([row]))[0];
    }

    case 'cancel': {
      if (r.status !== 'scheduled') throw new ApiException('Only a confirmed session can be cancelled here.', 409);
      if (r.instructorId !== me.id && !superAdmin) throw new ApiException('This is not your session.', 403, 'NOT_YOURS');
      return cancelScheduled(r, student ?? null, me.name, false);
    }

    default:
      throw new ApiException('action must be accept, propose, decline or cancel', 400);
  }
}

// ─── Student actions ─────────────────────────────────────────────────────────

export async function studentAct(
  me: UserWithProducts,
  id: number,
  body: { action?: string; startAt?: number; preferredTimes?: unknown[] },
): Promise<RequestView> {
  const r = await load(id);
  if (r.userId !== me.id) throw new ApiException('This is not your request.', 403, 'NOT_YOURS');
  const durationMs = r.durationMinutes * 60_000;

  switch (body.action) {
    case 'accept': {
      if (r.status !== 'proposed') throw new ApiException(`This request is ${r.status}, nothing to accept.`, 409);
      if (typeof body.startAt !== 'number' || !isStartAllowed(body.startAt, parseProposals(r.proposals), durationMs)) {
        throw new ApiException("Pick one of the instructor's times.", 400);
      }
      if (body.startAt < Date.now()) throw new ApiException('That time has already passed.', 409, 'EXPIRED');
      const instructor = r.instructorId ? (await getPeople([r.instructorId])).get(r.instructorId) : null;
      if ((r.mode !== 'online' && r.mode !== 'offline') || !instructor) throw new ApiException('This request has no instructor yet.', 409);
      return finalize(r, 'proposed', { startAt: body.startAt, instructor, mode: r.mode, location: r.location });
    }

    case 'counter': {
      if (r.status !== 'proposed') throw new ApiException(`This request is ${r.status}.`, 409);
      const times = Array.isArray(body.preferredTimes) ? body.preferredTimes : [];
      const err = validatePreferredTimes(times, Date.now());
      if (err) throw new ApiException(err, 400);
      const row = await transition(id, ['proposed'], {
        status: 'pending', preferredTimes: JSON.stringify(times), proposals: '[]',
      });
      if (!row) throw RACE();
      const targets: Person[] = r.instructorId
        ? [...(await getPeople([r.instructorId])).values()]
        : await getEligibleInstructors(r.product);
      await sendAll(targets.map((t) => mails.requested(t.email, facts(r, me.name), times as number[], true)));
      return (await viewsFor([row]))[0];
    }

    case 'cancel': {
      if (r.status === 'scheduled') {
        if (!r.startAt || r.startAt.getTime() - Date.now() < CANCEL_CUTOFF_MS) {
          throw new ApiException('Sessions can only be cancelled more than 2 hours before they start.', 409, 'TOO_LATE_TO_CANCEL');
        }
        return cancelScheduled(r, { id: me.id, name: me.name, email: me.email }, me.name, true);
      }
      const row = await transition(id, ['pending', 'proposed'], { status: 'cancelled' });
      if (!row) throw RACE();
      return (await viewsFor([row]))[0];
    }

    default:
      throw new ApiException('action must be accept, counter or cancel', 400);
  }
}

async function cancelScheduled(r: RequestRow, student: Person | null, byName: string, byStudent: boolean): Promise<RequestView> {
  const row = await transition(r.id, ['scheduled'], { status: 'cancelled', meetLink: null, googleEventId: null });
  if (!row) throw RACE();
  if (r.googleEventId) {
    try { await deleteMeetEvent(r.googleEventId); } catch (err) { console.warn('[booking] delete event failed (non-fatal):', err); }
  }
  const f = facts(r, student?.name ?? 'Student');
  const startAt = r.startAt ? r.startAt.getTime() : null;
  const other = byStudent
    ? (r.instructorId ? (await getPeople([r.instructorId])).get(r.instructorId) : undefined)
    : student;
  if (other) await sendAll([mails.cancelled(other.email, f, byName, startAt, !byStudent)]);
  return (await viewsFor([row]))[0];
}
