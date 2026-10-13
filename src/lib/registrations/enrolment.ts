/**
 * Pure logic for the Enrolments (registrations) admin page: age / "waiting too long" flag,
 * status transitions, inbox ordering, invoice lines and the product(s) a registration maps to.
 * No DB or React imports so it is unit-testable and safe in Server and Client Components.
 */

import { MOCK_PRICES, DU_FBS_FULL_FEES, IBA_COMBINED_FULL_FEE, type MockProgram } from '@/lib/registration/pricing';

export type RegistrationStatus = 'pending' | 'contacted' | 'enrolled' | 'cancelled';
export const REGISTRATION_STATUSES: readonly RegistrationStatus[] = ['pending', 'contacted', 'enrolled', 'cancelled'];

const DAY_MS = 86_400_000;

/** A pending registration older than this is "waiting too long". Same rule as the Overview data-health card. */
export const STALE_REGISTRATION_DAYS = 14;

/** Registrations created before this instant and still pending are stale (Overview data-health query). */
export function staleRegistrationCutoff(now: number = Date.now()): Date {
  return new Date(now - STALE_REGISTRATION_DAYS * DAY_MS);
}

/** Whole days since the registration was created (never negative). */
export function ageDays(createdAtMs: number, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - createdAtMs) / DAY_MS));
}

/** Same rule as the Overview card: status is exactly 'pending' and created before the cutoff. */
export function isStale(status: string, createdAtMs: number, now: number = Date.now()): boolean {
  return status === 'pending' && createdAtMs < staleRegistrationCutoff(now).getTime();
}

// ─── Status transitions ───────────────────────────────────────────────────────

const TRANSITIONS: Record<RegistrationStatus, readonly RegistrationStatus[]> = {
  pending:   ['contacted', 'enrolled', 'cancelled'],
  contacted: ['enrolled', 'cancelled'],
  enrolled:  [],
  cancelled: [],
};

export function isRegistrationStatus(v: unknown): v is RegistrationStatus {
  return typeof v === 'string' && (REGISTRATION_STATUSES as readonly string[]).includes(v);
}

export function canTransition(from: string, to: string): boolean {
  return isRegistrationStatus(from) && isRegistrationStatus(to) && TRANSITIONS[from].includes(to);
}

/** Open = still needs a human decision. */
export function isOpen(status: string): boolean {
  return status === 'pending' || status === 'contacted';
}

// ─── Inbox ordering / filtering ───────────────────────────────────────────────

export interface InboxSortable { status: string; createdAtMs: number }

/** Open registrations first (oldest waiting at the top), then closed ones newest first. */
export function compareInbox(a: InboxSortable, b: InboxSortable): number {
  const ao = isOpen(a.status), bo = isOpen(b.status);
  if (ao !== bo) return ao ? -1 : 1;
  return ao ? a.createdAtMs - b.createdAtMs : b.createdAtMs - a.createdAtMs;
}

export function sortInbox<T extends InboxSortable>(rows: readonly T[]): T[] {
  return [...rows].sort(compareInbox);
}

export function countByStatus(rows: readonly { status: string }[]): Record<RegistrationStatus, number> {
  const out: Record<RegistrationStatus, number> = { pending: 0, contacted: 0, enrolled: 0, cancelled: 0 };
  for (const r of rows) if (isRegistrationStatus(r.status)) out[r.status]++;
  return out;
}

// ─── Package / invoice ────────────────────────────────────────────────────────

export function parseJsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const COURSE_LABELS: Record<string, string> = {
  'du-iba': 'DU IBA mock', 'bup-iba': 'BUP IBA mock', 'du-fbs': 'DU FBS mock', 'bup-fbs': 'BUP FBS mock',
  'iba-combined': 'IBA Combined full course', 'du-fbs-full': 'DU FBS full course', 'bup-fbs-full': 'BUP FBS full course',
};

export function courseLabel(token: string): string {
  return COURSE_LABELS[token] ?? token.replace(/-/g, ' ').toUpperCase();
}

export interface InvoiceInput {
  programMode: string | null;
  selectedMocks: string | null;
  selectedFullCourses: string | null;
  pricingSubtotal: number | null;
  pricingDiscount: number | null;
  pricingFinalPrice: number | null;
  referralName: string | null;
  referralInstitution: string | null;
  referralBatch: string | null;
}

export interface InvoiceLine { label: string; amount: number | null }
export interface Invoice {
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  discountReason: string | null;
  finalAmount: number;
  referral: string | null;
}

function fullCoursePrice(token: string): number | null {
  if (token === 'du-fbs-full') return DU_FBS_FULL_FEES.admissionFee + DU_FBS_FULL_FEES.monthlyFee;
  if (token === 'iba-combined') return IBA_COMBINED_FULL_FEE;
  return null; // bup-fbs-full carries no fee today
}

/** Mock bundle discount tier, mirroring calculateMocksPricing in registration/pricing.ts. */
function bundleRatePercent(count: number): number {
  return count >= 4 ? 25 : count === 3 ? 15 : count === 2 ? 5 : 0;
}

export function buildInvoice(r: InvoiceInput): Invoice {
  const isMocks = r.programMode === 'mocks';
  const tokens = parseJsonList(isMocks ? r.selectedMocks : r.selectedFullCourses);
  const lines: InvoiceLine[] = tokens.map((t) => ({
    label: courseLabel(t),
    amount: isMocks ? (MOCK_PRICES[t as MockProgram] ?? null) : fullCoursePrice(t),
  }));

  const subtotal = r.pricingSubtotal ?? 0;
  const discount = r.pricingDiscount ?? 0;
  const finalAmount = r.pricingFinalPrice ?? Math.max(0, subtotal - discount);

  const reasons: string[] = [];
  if (discount > 0 && isMocks) {
    const pct = bundleRatePercent(tokens.length);
    if (pct > 0) reasons.push(`${tokens.length}-mock bundle (${pct}%)`);
  }
  const referral = r.referralName
    ? [r.referralName, r.referralInstitution, r.referralBatch].filter(Boolean).join(', ')
    : null;
  if (discount > 0 && referral) reasons.push(`referral from ${r.referralName}`);

  return { lines, subtotal, discount, discountReason: reasons.length ? reasons.join(' · ') : null, finalAmount, referral };
}

// ─── Access mapping ───────────────────────────────────────────────────────────

export type GrantProduct = 'iba' | 'fbs';

const PRODUCT_BY_TOKEN: Record<string, GrantProduct> = {
  'du-iba': 'iba', 'bup-iba': 'iba', 'iba-combined': 'iba',
  'du-fbs': 'fbs', 'bup-fbs': 'fbs', 'du-fbs-full': 'fbs', 'bup-fbs-full': 'fbs',
};

/** Which products (user_access.product) the chosen package grants. */
export function productsForRegistration(r: Pick<InvoiceInput, 'programMode' | 'selectedMocks' | 'selectedFullCourses'>): GrantProduct[] {
  const tokens = parseJsonList(r.programMode === 'mocks' ? r.selectedMocks : r.selectedFullCourses);
  const out = new Set<GrantProduct>();
  for (const t of tokens) { const p = PRODUCT_BY_TOKEN[t]; if (p) out.add(p); }
  return [...out];
}
