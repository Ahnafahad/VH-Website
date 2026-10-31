/**
 * Public mock registration (/mock-register): phone → bKash proof → staff approval → 30 days of
 * LexiCore full access (vocab phase 1) + Zap. Pure helpers are exported for tests; the rest is DB.
 */

import { eq, and, lt, desc } from 'drizzle-orm';
import { db, mockRegistrations, users, vocabUserProgress } from '@/lib/db';
import { ApiException } from '@/lib/api-utils';
import { r2Delete, r2PresignGet } from '@/lib/storage/r2';
import { sendStudentNotice } from '@/lib/email';
import { MOCK_ACCESS_DAYS, MOCK_FEE_BDT, accessUntil, paymentReference, normalizeBdPhone, type MockRegStatus } from './registration-pure';

export { MOCK_ACCESS_DAYS, type MockRegStatus };

export const MOCK_CONTACT_WHATSAPP = '+8801835200626';
// ponytail: assumed to be the same number as WhatsApp — change here if the bKash personal number differs.
export const MOCK_BKASH_NUMBER = '01835200626';
export const MOCK_REGISTER_URL = 'https://www.vh-beyondthehorizons.org/mock-register';

export interface MyMockRegistration {
  name: string;
  email: string;
  reference: string;
  bkashNumber: string;
  fee: number;
  whatsapp: string;
  registration: null | {
    status: MockRegStatus;
    phone: string;
    trxId: string | null;
    hasScreenshot: boolean;
    note: string | null;
    accessUntil: number | null;
  };
}

async function userByEmail(email: string) {
  const u = await db.select({ id: users.id, name: users.name, email: users.email }).from(users)
    .where(eq(users.email, email.toLowerCase())).get();
  if (!u) throw new ApiException('User not found', 404);
  return u;
}

export async function userIdByEmail(email: string): Promise<number> {
  return (await userByEmail(email)).id;
}

export async function getMyRegistration(email: string): Promise<MyMockRegistration> {
  const u = await userByEmail(email);
  const r = await db.select().from(mockRegistrations).where(eq(mockRegistrations.userId, u.id)).get();
  return {
    name: u.name, email: u.email, reference: paymentReference(u.name),
    bkashNumber: MOCK_BKASH_NUMBER, fee: MOCK_FEE_BDT, whatsapp: MOCK_CONTACT_WHATSAPP,
    registration: r ? {
      status: r.status as MockRegStatus, phone: r.phone, trxId: r.trxId,
      hasScreenshot: !!r.screenshotKey, note: r.note,
      accessUntil: r.accessUntil ? r.accessUntil.getTime() : null,
    } : null,
  };
}

/** Step 1: phone number. Re-posting only updates the phone while payment hasn't been approved. */
export async function savePhone(email: string, rawPhone: string): Promise<void> {
  const phone = normalizeBdPhone(rawPhone);
  if (!phone) throw new ApiException('Enter a valid Bangladeshi mobile number, e.g. 01XXXXXXXXX', 400);
  const u = await userByEmail(email);
  const r = await db.select({ status: mockRegistrations.status }).from(mockRegistrations)
    .where(eq(mockRegistrations.userId, u.id)).get();
  if (!r) { await db.insert(mockRegistrations).values({ userId: u.id, phone }); return; }
  if (r.status === 'approved') throw new ApiException('Already approved', 409);
  await db.update(mockRegistrations).set({ phone, updatedAt: new Date() }).where(eq(mockRegistrations.userId, u.id));
}

export function screenshotKeyFor(userId: number, fileName: string): string {
  return `mock-registrations/${userId}/${Date.now()}-${fileName.replace(/[^\w.\-]/g, '_').slice(0, 100)}`;
}

/** Step 2: transaction ID and/or screenshot. At least one is required. */
export async function submitPayment(email: string, input: { trxId?: string; screenshotKey?: string }): Promise<void> {
  const trxId = input.trxId?.trim().toUpperCase().slice(0, 40) || null;
  const u = await userByEmail(email);
  const r = await db.select().from(mockRegistrations).where(eq(mockRegistrations.userId, u.id)).get();
  if (!r) throw new ApiException('Add your phone number first', 400);
  if (r.status === 'approved') throw new ApiException('Already approved', 409);
  if (input.screenshotKey && !input.screenshotKey.startsWith(`mock-registrations/${u.id}/`)) {
    throw new ApiException('Invalid screenshot', 400);
  }
  const screenshotKey = input.screenshotKey || r.screenshotKey;
  if (!trxId && !screenshotKey) throw new ApiException('Enter the bKash transaction ID or upload a screenshot', 400);
  if (r.screenshotKey && screenshotKey !== r.screenshotKey) await r2Delete(r.screenshotKey).catch(() => {});

  await db.update(mockRegistrations).set({
    trxId: trxId ?? r.trxId, screenshotKey, status: 'submitted', note: null,
    submittedAt: new Date(), updatedAt: new Date(),
  }).where(eq(mockRegistrations.userId, u.id));

  await sendStudentNotice(u.email, 'We received your mock registration', {
    kicker: 'Mock registration', heading: 'Awaiting verification', name: u.name,
    message: 'We have your payment details and will verify them shortly. You will get another email as soon as your registration is approved. You can check the status any time with the button below.',
    ctaLabel: 'Track my registration', ctaUrl: MOCK_REGISTER_URL,
  }).catch(() => {});
}

// ── Staff ────────────────────────────────────────────────────────────────────

export interface AdminMockRegistration {
  id: number; name: string; email: string; phone: string; trxId: string | null; reference: string;
  screenshotUrl: string | null; status: MockRegStatus; note: string | null;
  submittedAt: number | null; accessUntil: number | null;
}

export async function listRegistrations(): Promise<AdminMockRegistration[]> {
  const rows = await db.select({ r: mockRegistrations, name: users.name, email: users.email })
    .from(mockRegistrations).innerJoin(users, eq(users.id, mockRegistrations.userId))
    .orderBy(desc(mockRegistrations.updatedAt));
  return Promise.all(rows.map(async ({ r, name, email }) => ({
    id: r.id, name, email, phone: r.phone, trxId: r.trxId, reference: paymentReference(name),
    screenshotUrl: r.screenshotKey ? await r2PresignGet(r.screenshotKey, 3600).catch(() => null) : null,
    status: r.status as MockRegStatus, note: r.note,
    submittedAt: r.submittedAt ? r.submittedAt.getTime() : null,
    accessUntil: r.accessUntil ? r.accessUntil.getTime() : null,
  })));
}

export async function decideRegistration(id: number, action: 'approve' | 'reject', staffId: number, note?: string): Promise<void> {
  const row = await db.select({ r: mockRegistrations, name: users.name, email: users.email })
    .from(mockRegistrations).innerJoin(users, eq(users.id, mockRegistrations.userId))
    .where(eq(mockRegistrations.id, id)).get();
  if (!row) throw new ApiException('Registration not found', 404);
  const { r } = row;
  const now = new Date();

  if (action === 'reject') {
    await db.update(mockRegistrations).set({ status: 'rejected', note: note?.trim() || null, decidedAt: now, decidedBy: staffId, updatedAt: now })
      .where(eq(mockRegistrations.id, id));
    await sendStudentNotice(row.email, 'About your mock registration', {
      kicker: 'Mock registration', heading: 'We could not verify your payment', name: row.name,
      message: `${note?.trim() || 'We could not match your payment.'}\n\nPlease check the details and submit again, or message us on WhatsApp ${MOCK_CONTACT_WHATSAPP}.`,
      ctaLabel: 'Fix my registration', ctaUrl: MOCK_REGISTER_URL,
    }).catch(() => {});
    return;
  }

  // Approve: 30 days of LexiCore full access. Only flip the phase for users who aren't already
  // full-access, so the expiry sweep never downgrades a paying student.
  const until = accessUntil(now);
  const prog = await db.select({ phase: vocabUserProgress.phase }).from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, r.userId)).get();
  let grant = false;
  if (!prog) { await db.insert(vocabUserProgress).values({ userId: r.userId, phase: 1 }); grant = true; }
  else if (prog.phase !== 1) {
    await db.update(vocabUserProgress).set({ phase: 1, fullAccessDeadlineSetAt: null, updatedAt: now })
      .where(eq(vocabUserProgress.userId, r.userId));
    grant = true;
  }
  await db.update(mockRegistrations).set({
    status: 'approved', note: null, vocabGranted: grant || r.vocabGranted, accessUntil: until,
    screenshotKey: null, decidedAt: now, decidedBy: staffId, updatedAt: now,
  }).where(eq(mockRegistrations.id, id));
  if (r.screenshotKey) await r2Delete(r.screenshotKey).catch(() => {});

  const untilText = until.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
  await sendStudentNotice(row.email, 'Your mock is confirmed', {
    kicker: 'Mock registration', heading: 'Congratulations, you are in', name: row.name,
    message: `Your mock registration is approved.\n\nYou now have access to LexiCore, our vocabulary app, for ${MOCK_ACCESS_DAYS} days (until ${untilText}). LexiCore turns the words you need for admission tests into short daily practice with spaced review.\n\nYou can also play Zap, our mental-math game.`,
    ctaLabel: 'Open my registration', ctaUrl: MOCK_REGISTER_URL,
  }).catch(() => {});
}

/** Daily sweep (vocab decay cron): end the 30-day LexiCore access we granted. */
export async function expireMockVocabAccess(now = new Date()): Promise<number> {
  const due = await db.select({ id: mockRegistrations.id, userId: mockRegistrations.userId }).from(mockRegistrations)
    .where(and(eq(mockRegistrations.vocabGranted, true), lt(mockRegistrations.accessUntil, now)));
  for (const d of due) {
    await db.update(vocabUserProgress).set({ phase: 2, updatedAt: now }).where(eq(vocabUserProgress.userId, d.userId));
    await db.update(mockRegistrations).set({ vocabGranted: false, updatedAt: now }).where(eq(mockRegistrations.id, d.id));
  }
  return due.length;
}
