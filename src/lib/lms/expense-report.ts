import type { FinancialEntryRecord } from './operations';

// Pure helpers for the expenses tracker: CSV export, KPIs, filtering, day grouping.
// Dates are Bangladesh calendar dates (YYYY-MM-DD) and months are 'YYYY-MM'.

// ── CSV ──────────────────────────────────────────────────────────────────────

// A cell opening with = + - @ (or tab/CR) is run as a formula by Excel/Sheets.
// Prefixing a single quote makes it plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const minorToDecimal = (minor: number) => (minor / 100).toFixed(2);

export function expensesCsv(entries: FinancialEntryRecord[]): string {
  return toCsv([
    ['Date', 'Payee', 'Item', 'Category', 'Amount (BDT)', 'Paid by', 'Payment method', 'Reference',
      'Product', 'Batch', 'Class', 'Location', 'Tags', 'Reimbursement', 'Reimbursed on', 'Receipt'],
    ...entries.map(e => [
      e.date, e.payee, e.description, e.category, minorToDecimal(e.amountMinor),
      e.paidBy === null ? 'Organization' : (e.paidByName ?? 'Unknown'), e.paymentMethod, e.referenceNo,
      e.product, e.batch, e.classLabel, e.location, e.tags.join('; '),
      e.paidBy === null ? 'Not applicable' : e.reimbursedAt ? 'Reimbursed' : 'To reimburse',
      e.reimbursedAt, e.receiptKey ? 'Yes' : 'No',
    ]),
  ]);
}

// ── Months ───────────────────────────────────────────────────────────────────

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function dhakaToday(now = new Date()): string {
  return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

// ── Filtering and totals ─────────────────────────────────────────────────────

export const needsReimbursement = (e: Pick<FinancialEntryRecord, 'paidBy' | 'reimbursedAt'>) =>
  e.paidBy !== null && !e.reimbursedAt;

export interface ExpenseFilter {
  month?: string;
  category?: string;
  unreimbursed?: boolean;
  q?: string;
}

export function filterEntries(entries: FinancialEntryRecord[], f: ExpenseFilter): FinancialEntryRecord[] {
  const q = f.q?.trim().toLowerCase();
  return entries.filter(e =>
    (!f.month || e.date.startsWith(f.month)) &&
    (!f.category || e.category === f.category) &&
    (!f.unreimbursed || needsReimbursement(e)) &&
    (!q || [e.payee, e.description, e.referenceNo].some(v => v?.toLowerCase().includes(q))));
}

export const sumMinor = (entries: { amountMinor: number }[]) => entries.reduce((s, e) => s + e.amountMinor, 0);

export function categoryTotals(entries: FinancialEntryRecord[]): { category: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const e of entries) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amountMinor);
  return [...totals].map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

export interface ExpenseKpis {
  spent: number;
  previousSpent: number;
  /** Percent change vs the previous month, rounded; null when the previous month had no spend. */
  deltaPct: number | null;
  /** Owed to people who paid out of pocket, across all months. */
  toReimburse: number;
  toReimburseCount: number;
  topCategory: { category: string; amount: number; pct: number } | null;
}

export function monthKpis(entries: FinancialEntryRecord[], month: string): ExpenseKpis {
  const current = entries.filter(e => e.date.startsWith(month));
  const spent = sumMinor(current);
  const previousSpent = sumMinor(entries.filter(e => e.date.startsWith(shiftMonth(month, -1))));
  const owed = entries.filter(needsReimbursement);
  const top = categoryTotals(current)[0];
  return {
    spent, previousSpent,
    deltaPct: previousSpent > 0 ? Math.round(((spent - previousSpent) / previousSpent) * 100) : null,
    toReimburse: sumMinor(owed), toReimburseCount: owed.length,
    topCategory: top ? { ...top, pct: Math.round((top.amount / spent) * 100) } : null,
  };
}

// ── Day grouping with running month-to-date ──────────────────────────────────

export interface DayGroup {
  date: string;
  total: number;
  rows: { entry: FinancialEntryRecord; monthToDate: number }[];
}

/**
 * Newest day first. `monthEntries` is the whole month (unfiltered) so the running
 * total is the true month-to-date even while a filter narrows what is shown.
 */
export function groupByDay(shown: FinancialEntryRecord[], monthEntries: FinancialEntryRecord[]): DayGroup[] {
  const running = new Map<number, number>();
  let total = 0;
  for (const e of [...monthEntries].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)) {
    total += e.amountMinor;
    running.set(e.id, total);
  }
  const groups = new Map<string, DayGroup>();
  for (const e of [...shown].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)) {
    const group = groups.get(e.date) ?? { date: e.date, total: 0, rows: [] };
    group.total += e.amountMinor;
    group.rows.push({ entry: e, monthToDate: running.get(e.id) ?? 0 });
    groups.set(e.date, group);
  }
  return [...groups.values()];
}
