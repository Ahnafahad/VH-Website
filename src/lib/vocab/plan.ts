/**
 * LexiCore free vs unlimited plan.
 *
 * Free: every word, but FREE_CARDS_PER_DAY flashcard ratings and FREE_QUIZZES_PER_DAY quizzes per Dhaka day.
 * Unlimited: staff, phase-1 users (existing students / admin-upgraded), IBA/FBS course access, or a live bKash
 * claim (status active|approved, accessUntil in the future). Nothing flips `phase`, so expiry and a rejected
 * claim simply fall back to free with no cron.
 */

import { db, users, userAccess, vocabUserProgress, lexicoreClaims, lexicoreDailyUsage } from '@/lib/db';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { isStaffRole } from '@/lib/auth/roles';

export const FREE_CARDS_PER_DAY   = 20;
export const FREE_QUIZZES_PER_DAY = 2;
export const PLAN_PRICE_BDT       = 200;
export const BKASH_NUMBER         = '01915424939';
/** Paid access ends 5 Dec 2026, 23:59:59 Dhaka. */
export const PAID_UNTIL           = new Date('2026-12-05T23:59:59+06:00');
export const PAID_UNTIL_TEXT      = '5 December 2026';
export const OWNER_EMAIL          = 'ahnaf816@gmail.com';
/** Discount codes → price in BDT. */
export const PROMO_CODES: Record<string, number> = { MAGNUS100: 100, SADAF100: 100 };

/** Valid code → { code, price }; blank → null; unknown → 'invalid'. */
export function promoPrice(raw: unknown): { code: string; price: number } | null | 'invalid' {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const code = raw.trim().toUpperCase();
  return code in PROMO_CODES ? { code, price: PROMO_CODES[code] } : 'invalid';
}

const COURSE_PRODUCTS = ['iba', 'fbs', 'fbs_detailed'];
const LIVE_STATUSES   = ['active', 'approved'];

export type QuotaKind = 'cards' | 'quizzes';

/** Dhaka calendar date (UTC+6, no DST) as YYYY-MM-DD. */
export function dhakaDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 6 * 3600_000).toISOString().slice(0, 10);
}

export function limitFor(kind: QuotaKind): number {
  return kind === 'cards' ? FREE_CARDS_PER_DAY : FREE_QUIZZES_PER_DAY;
}

export async function isUnlimited(userId: number): Promise<boolean> {
  const [u, prog, course, claim] = await Promise.all([
    db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get(),
    db.select({ phase: vocabUserProgress.phase }).from(vocabUserProgress).where(eq(vocabUserProgress.userId, userId)).get(),
    db.select({ id: userAccess.id }).from(userAccess)
      .where(and(eq(userAccess.userId, userId), eq(userAccess.active, true), inArray(userAccess.product, COURSE_PRODUCTS))).get(),
    db.select({ id: lexicoreClaims.id }).from(lexicoreClaims)
      .where(and(eq(lexicoreClaims.userId, userId), inArray(lexicoreClaims.status, LIVE_STATUSES), gt(lexicoreClaims.accessUntil, new Date()))).get(),
  ]);
  return isStaffRole(u?.role) || prog?.phase === 1 || !!course || !!claim;
}

export async function usageToday(userId: number): Promise<{ cards: number; quizzes: number }> {
  const row = await db.select({ cards: lexicoreDailyUsage.cards, quizzes: lexicoreDailyUsage.quizzes })
    .from(lexicoreDailyUsage)
    .where(and(eq(lexicoreDailyUsage.userId, userId), eq(lexicoreDailyUsage.day, dhakaDay()))).get();
  return { cards: row?.cards ?? 0, quizzes: row?.quizzes ?? 0 };
}

/** True when the user may do one more `kind` today. */
export async function hasQuota(userId: number, kind: QuotaKind): Promise<boolean> {
  if (await isUnlimited(userId)) return true;
  return (await usageToday(userId))[kind] < limitFor(kind);
}

/**
 * Count one use. Call after the work succeeded, so a failed quiz generation doesn't burn a quiz.
 * ponytail: check-then-record, so two parallel requests can each pass at limit-1 (one extra use at most).
 */
export async function recordUse(userId: number, kind: QuotaKind): Promise<void> {
  const day = dhakaDay();
  const col = kind === 'cards' ? sql`cards` : sql`quizzes`;
  await db.run(sql`INSERT INTO lexicore_daily_usage (user_id, day, ${col}) VALUES (${userId}, ${day}, 1)
    ON CONFLICT(user_id, day) DO UPDATE SET ${col} = ${col} + 1`);
}

/** The error body every gated route returns (HTTP 402), so the client can show one upgrade prompt. */
export function limitBody(kind: QuotaKind) {
  const n = limitFor(kind);
  return {
    error: kind === 'cards'
      ? `You've used today's ${n} free flashcards. Upgrade for unlimited, or come back tomorrow.`
      : `You've used today's ${n} free quizzes. Upgrade for unlimited, or come back tomorrow.`,
    code: 'LEXICORE_LIMIT' as const,
    kind,
    upgradeUrl: '/lexicore/upgrade',
  };
}

/** bKash TrxIDs are 10 alphanumerics; accept 8-20 to allow for typos the owner can still match. */
export function normalizeTrxId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{8,20}$/.test(t) ? t : null;
}
