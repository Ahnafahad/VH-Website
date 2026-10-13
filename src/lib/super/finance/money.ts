/**
 * Pure finance maths. UNITS: registrationPayments.amount and registrations.pricing* are whole BDT;
 * operational_entries.amountMinor is integer paisa (1 BDT = 100 paisa). Convert only through these helpers.
 */
import { calculateMocksPricing, isMockProgram, IBA_COMBINED_FULL_FEE } from '@/lib/registration/pricing';

export const paisaToBdt = (paisa: number): number => Math.round(paisa) / 100;
export const bdtToPaisa = (bdt: number): number => Math.round(bdt * 100);

export type PaymentState = 'pending' | 'partial' | 'paid' | 'refunded';

function parseList(json: string | null): string[] {
  try { const v = JSON.parse(json ?? '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

/** Fees due in BDT: the stored final price, else recomputed from the selection; 0 when it cannot be derived. */
export function feesDue(r: { pricingFinalPrice: number | null; programMode: string | null; selectedMocks: string | null; selectedFullCourses: string | null }): number {
  if (r.pricingFinalPrice && r.pricingFinalPrice > 0) return Math.round(r.pricingFinalPrice);
  if (r.programMode === 'mocks') {
    return calculateMocksPricing(parseList(r.selectedMocks).filter(isMockProgram)).finalPrice;
  }
  if (parseList(r.selectedFullCourses).includes('iba-combined')) return IBA_COMBINED_FULL_FEE;
  return 0;
}

/** Net paid in BDT: paid + refund rows (refunds are negative); 'pending' rows are promises, not money. */
export function paidTotal(payments: { amount: number; status: string }[]): number {
  return payments.filter(p => p.status !== 'pending').reduce((s, p) => s + p.amount, 0);
}

export function deriveStatus(due: number, paid: number, hadRefund: boolean): PaymentState {
  if (hadRefund && paid <= 0) return 'refunded';
  if (paid <= 0) return 'pending';
  return due > 0 && paid < due ? 'partial' : 'paid';
}

export function groupBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => number): { label: string; bdt: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + value(r));
  return [...m].map(([label, bdt]) => ({ label, bdt })).sort((a, b) => b.bdt - a.bdt);
}

export const dhakaMonth = (ms: number): string => new Date(ms + 6 * 3600_000).toISOString().slice(0, 7);

export function productLabel(r: { programMode: string | null; selectedFullCourses: string | null }): string {
  if (r.programMode === 'full') return parseList(r.selectedFullCourses).join(' + ') || 'full course';
  return r.programMode === 'mocks' ? 'mocks' : 'other';
}

export interface MonthRow { month: string; registrations: number; opIncome: number; opExpense: number; net: number }

/** Monthly BDT totals. regPayments are whole BDT; ops entries are paisa and converted explicitly here. */
export function monthlyTotals(
  regPayments: { amount: number; createdAtMs: number }[],
  ops: { kind: string; date: string; amountMinor: number }[],
): MonthRow[] {
  const m = new Map<string, MonthRow>();
  const row = (month: string) => { let x = m.get(month); if (!x) { x = { month, registrations: 0, opIncome: 0, opExpense: 0, net: 0 }; m.set(month, x); } return x; };
  for (const p of regPayments) row(dhakaMonth(p.createdAtMs)).registrations += p.amount;
  for (const o of ops) row(o.date.slice(0, 7))[o.kind === 'income' ? 'opIncome' : 'opExpense'] += paisaToBdt(o.amountMinor);
  const out = [...m.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const x of out) { x.opIncome = round2(x.opIncome); x.opExpense = round2(x.opExpense); x.net = round2(x.registrations + x.opIncome - x.opExpense); }
  return out;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/** CSV with formula-injection protection: text cells starting with = + - @ tab or CR get a leading apostrophe; numbers are left alone. */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null): string => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map(r => r.map(cell).join(',')).join('\r\n');
}
