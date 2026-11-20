/**
 * bKash claims for LexiCore unlimited. A first claim grants access at once ('active') and emails the owner,
 * who then approves or rejects in /admin/lexicore-claims. A claim from someone with an earlier rejection is
 * 'held' (no access until approved), so fake TrxIDs can't be repeated for free access.
 */

import { db, users, lexicoreClaims } from '@/lib/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { ApiException } from '@/lib/api-utils';
import { sendHtmlEmail } from '@/lib/email';
import { esc } from '@/lib/mocks/registration-emails';
import { r2PresignGet } from '@/lib/storage/r2';
import {
  FREE_CARDS_PER_DAY, FREE_QUIZZES_PER_DAY, PLAN_PRICE_BDT, BKASH_NUMBER, PAID_UNTIL, PAID_UNTIL_TEXT,
  OWNER_EMAIL, isUnlimited, usageToday, normalizeTrxId, promoPrice,
} from '@/lib/vocab/plan';

const SITE = 'https://www.vh-beyondthehorizons.org';

export function screenshotKeyFor(userId: number, fileName: string): string {
  return `lexicore-claims/${userId}/${Date.now()}-${fileName.replace(/[^\w.\-]/g, '_').slice(0, 100)}`;
}

export async function getPlanStatus(userId: number, promo?: unknown) {
  const p = promoPrice(promo);
  if (p === 'invalid') throw new ApiException('That code is not valid.', 400);
  const [unlimited, usage, claim] = await Promise.all([
    isUnlimited(userId),
    usageToday(userId),
    db.select({ status: lexicoreClaims.status, trxId: lexicoreClaims.trxId, accessUntil: lexicoreClaims.accessUntil, note: lexicoreClaims.note })
      .from(lexicoreClaims).where(eq(lexicoreClaims.userId, userId)).orderBy(desc(lexicoreClaims.id)).get(),
  ]);
  return {
    unlimited,
    usage,
    limits: { cards: FREE_CARDS_PER_DAY, quizzes: FREE_QUIZZES_PER_DAY },
    price: p?.price ?? PLAN_PRICE_BDT,
    promoCode: p?.code ?? null,
    bkashNumber: BKASH_NUMBER,
    paidUntil: PAID_UNTIL.toISOString(),
    paidUntilText: PAID_UNTIL_TEXT,
    claim: claim ? { ...claim, accessUntil: claim.accessUntil.toISOString() } : null,
  };
}

export async function submitClaim(
  userId: number,
  input: { trxId?: unknown; senderNumber?: unknown; screenshotKey?: unknown; promoCode?: unknown },
): Promise<void> {
  const trxId = normalizeTrxId(input.trxId);
  if (!trxId) throw new ApiException('Enter the bKash Transaction ID (letters and numbers, e.g. 9JK4ABC123)', 400);
  const senderNumber = typeof input.senderNumber === 'string' ? input.senderNumber.replace(/[^\d+]/g, '').slice(0, 15) || null : null;
  const screenshotKey = typeof input.screenshotKey === 'string' && input.screenshotKey.startsWith(`lexicore-claims/${userId}/`)
    ? input.screenshotKey : null;
  const promo = promoPrice(input.promoCode);
  if (promo === 'invalid') throw new ApiException('That code is not valid.', 400);
  const amount = promo?.price ?? PLAN_PRICE_BDT;
  if (PAID_UNTIL <= new Date()) throw new ApiException('Upgrades are closed right now.', 400);

  const mine = await db.select({ status: lexicoreClaims.status, accessUntil: lexicoreClaims.accessUntil })
    .from(lexicoreClaims).where(eq(lexicoreClaims.userId, userId));
  const now = new Date();
  if (mine.some(c => c.status !== 'rejected' && c.accessUntil > now)) {
    throw new ApiException('You already have a payment claim. We will confirm it soon.', 409);
  }
  const status = mine.some(c => c.status === 'rejected') ? 'held' : 'active';

  const taken = await db.select({ id: lexicoreClaims.id }).from(lexicoreClaims).where(eq(lexicoreClaims.trxId, trxId)).get();
  if (taken) throw new ApiException('This Transaction ID has already been used.', 409);

  await db.insert(lexicoreClaims).values({
    userId, trxId, senderNumber, screenshotKey, amount, promoCode: promo?.code ?? null, status, accessUntil: PAID_UNTIL,
  });

  // Never fail the claim because the email failed.
  try {
    const u = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).get();
    const who = `${u?.name ?? 'Unknown'} <${u?.email ?? '?'}>`;
    const line = status === 'held'
      ? 'This user had a claim rejected before, so they do NOT have access until you approve.'
      : 'They have full access now. Reject it if the money did not arrive.';
    await sendHtmlEmail(OWNER_EMAIL, {
      subject: `LexiCore bKash claim: ${amount} BDT from ${u?.name ?? u?.email ?? 'a user'}`,
      text: `${who} says they sent ${amount} BDT by bKash.\nTrxID: ${trxId}\nSender: ${senderNumber ?? '-'}\nScreenshot: ${screenshotKey ? 'yes' : 'no'}\nCode: ${promo?.code ?? '-'}\n${line}\nReview: ${SITE}/admin/lexicore-claims`,
      html: `<p><b>${esc(who)}</b> says they sent <b>${amount} BDT</b> by bKash to ${BKASH_NUMBER}.</p>
<p>TrxID: <b>${esc(trxId)}</b><br>Sender number: ${esc(senderNumber ?? '-')}<br>Screenshot: ${screenshotKey ? 'yes' : 'no'}<br>Code: ${esc(promo?.code ?? '-')}</p>
<p>${line}</p><p><a href="${SITE}/admin/lexicore-claims">Review the claim</a></p>`,
    });
  } catch (e) {
    console.error('[lexicore-claims] owner email failed:', e);
  }
}

export async function listClaims() {
  const rows = await db.select({
    id: lexicoreClaims.id, trxId: lexicoreClaims.trxId, senderNumber: lexicoreClaims.senderNumber,
    screenshotKey: lexicoreClaims.screenshotKey, amount: lexicoreClaims.amount, promoCode: lexicoreClaims.promoCode, status: lexicoreClaims.status,
    accessUntil: lexicoreClaims.accessUntil, note: lexicoreClaims.note, createdAt: lexicoreClaims.createdAt,
    decidedAt: lexicoreClaims.decidedAt, userName: users.name, userEmail: users.email,
  }).from(lexicoreClaims).innerJoin(users, eq(users.id, lexicoreClaims.userId)).orderBy(desc(lexicoreClaims.id)).limit(500);

  return Promise.all(rows.map(async ({ screenshotKey, ...r }) => ({
    ...r,
    accessUntil: r.accessUntil.toISOString(),
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    screenshotUrl: screenshotKey ? await r2PresignGet(screenshotKey, 3600).catch(() => null) : null,
  })));
}

export async function decideClaim(id: number, action: 'approve' | 'reject', adminId: number, note?: string): Promise<void> {
  const from = action === 'approve' ? ['active', 'held', 'rejected'] : ['active', 'held', 'approved'];
  const res = await db.update(lexicoreClaims)
    .set({
      status: action === 'approve' ? 'approved' : 'rejected',
      note: note?.trim().slice(0, 300) || null,
      decidedAt: new Date(),
      decidedBy: adminId,
    })
    .where(and(eq(lexicoreClaims.id, id), inArray(lexicoreClaims.status, from)))
    .returning({ id: lexicoreClaims.id });
  if (res.length === 0) throw new ApiException('Claim not found or already in that state', 404);
}
