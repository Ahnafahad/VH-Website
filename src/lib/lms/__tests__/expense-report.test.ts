import { describe, expect, it } from 'vitest';
import {
  categoryTotals, csvCell, expensesCsv, filterEntries, groupByDay, groupByPerson, monthKpis, roleLabel, shiftMonth, toCsv,
} from '../expense-report';
import { expenseEntryInput, type FinancialEntryRecord } from '../operations';

let nextId = 1;
const entry = (over: Partial<FinancialEntryRecord> = {}): FinancialEntryRecord => ({
  id: nextId++, date: '2026-10-05', amountMinor: 10000, category: 'Rent', description: '', paidBy: null,
  paidByName: null, paidByRole: null, reimbursedAt: null, payee: null, paymentMethod: null, referenceNo: null, receiptKey: null,
  product: null, batch: null, classSessionId: null, classLabel: null, location: null, tags: [],
  updatedAt: '2026-10-05T00:00:00.000Z', ...over,
});

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(1234.5)).toBe('1234.5');
  });
  it.each(['=SUM(A1)', '+1', '-2', '@cmd', '\tx', '\rx'])('neutralises formula start %j', v => {
    expect(csvCell(v).replace(/^"/, '').startsWith("'")).toBe(true);
  });
  it('leaves harmless text alone and guards only the first character', () => {
    expect(csvCell('Dhaka Print')).toBe('Dhaka Print');
    expect(csvCell('a=b')).toBe('a=b');
  });
  it('guards injected cells in a whole export', () => {
    const csv = expensesCsv([entry({ payee: '=HYPERLINK("http://x")', description: '@evil' })]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(",'@evil,");
    expect(toCsv([['a', 'b']])).toBe('a,b\r\n');
  });
});

describe('expense input', () => {
  const base = { date: '2026-10-05', amount: '10', category: 'Rent', paidBy: null, reimbursedAt: null };
  it('turns missing optional fields into null and tags into a joined string', () => {
    const r = expenseEntryInput.parse({ ...base, payee: '  ', tags: ['a', 'b'] });
    expect(r).toMatchObject({ payee: null, paymentMethod: null, receiptKey: null, classSessionId: null, tags: 'a,b' });
  });
  it('only accepts our receipt keys or https links', () => {
    expect(expenseEntryInput.safeParse({ ...base, receiptKey: 'expense-receipts/1-a.pdf' }).success).toBe(true);
    expect(expenseEntryInput.safeParse({ ...base, receiptKey: 'https://x.test/a.pdf' }).success).toBe(true);
    expect(expenseEntryInput.safeParse({ ...base, receiptKey: 'materials/other.pdf' }).success).toBe(false);
    expect(expenseEntryInput.safeParse({ ...base, receiptKey: 'javascript:alert(1)' }).success).toBe(false);
    expect(expenseEntryInput.safeParse({ ...base, receiptKey: 'expense-receipts/../x' }).success).toBe(false);
  });
});

describe('KPIs', () => {
  const entries = [
    entry({ date: '2026-10-02', amountMinor: 30000, category: 'Rent' }),
    entry({ date: '2026-10-09', amountMinor: 10000, category: 'Food', paidBy: 4, paidByName: 'Rahim' }),
    entry({ date: '2026-09-20', amountMinor: 20000, category: 'Food', paidBy: 4, paidByName: 'Rahim' }),
    entry({ date: '2026-09-21', amountMinor: 5000, category: 'Food', paidBy: 4, reimbursedAt: '2026-09-25' }),
  ];
  it('computes spend, month-over-month change, owed money and top category', () => {
    expect(monthKpis(entries, '2026-10')).toEqual({
      spent: 40000, previousSpent: 25000, deltaPct: 60, toReimburse: 30000, toReimburseCount: 2,
      topCategory: { category: 'Rent', amount: 30000, pct: 75 },
    });
  });
  it('has no percent change or top category for empty months', () => {
    expect(monthKpis(entries, '2026-01')).toMatchObject({ spent: 0, deltaPct: null, topCategory: null });
  });
  it('rolls months across year ends', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('totals categories largest first', () => {
    expect(categoryTotals(entries.slice(0, 2)).map(c => c.category)).toEqual(['Rent', 'Food']);
  });
});

describe('filter and grouping', () => {
  const a = entry({ id: 1, date: '2026-10-01', amountMinor: 100, payee: 'Dhaka Print', referenceNo: 'TXN-1' });
  const b = entry({ id: 2, date: '2026-10-03', amountMinor: 200, description: 'Markers', category: 'Stationery' });
  const c = entry({ id: 3, date: '2026-10-03', amountMinor: 400, paidBy: 9, category: 'Stationery' });
  const d = entry({ id: 4, date: '2026-09-30', amountMinor: 800 });
  const all = [a, b, c, d];

  it('searches payee, item and reference, and combines filters', () => {
    expect(filterEntries(all, { q: 'dhaka' })).toEqual([a]);
    expect(filterEntries(all, { q: 'txn-1' })).toEqual([a]);
    expect(filterEntries(all, { q: 'mark' })).toEqual([b]);
    expect(filterEntries(all, { month: '2026-10', category: 'Stationery' })).toEqual([b, c]);
    expect(filterEntries(all, { unreimbursed: true })).toEqual([c]);
  });

  it('groups newest day first with true running month-to-date even when filtered', () => {
    const month = filterEntries(all, { month: '2026-10' });
    const groups = groupByDay(filterEntries(month, { category: 'Stationery' }), month);
    expect(groups.map(g => g.date)).toEqual(['2026-10-03']);
    expect(groups[0].total).toBe(600);
    expect(groups[0].rows.map(r => [r.entry.id, r.monthToDate])).toEqual([[3, 700], [2, 300]]);
  });
});

describe('groupByPerson (Paid by people tab)', () => {
  const paid = (paidBy: number, name: string, role: string, over: Partial<FinancialEntryRecord> = {}) =>
    entry({ paidBy, paidByName: name, paidByRole: role, ...over });

  it('returns nothing when only the organisation paid', () => {
    expect(groupByPerson([entry(), entry()])).toEqual([]);
    expect(groupByPerson([])).toEqual([]);
  });

  it('totals per person and splits reimbursed from outstanding', () => {
    const groups = groupByPerson([
      paid(1, 'Rahim', 'admin', { amountMinor: 5000 }),
      paid(1, 'Rahim', 'admin', { amountMinor: 2500, reimbursedAt: '2026-10-09' }),
      paid(2, 'Amina', 'instructor', { amountMinor: 9000 }),
      entry({ amountMinor: 99999 }),
    ]);
    expect(groups.map(g => g.name)).toEqual(['Amina', 'Rahim']); // most owed first
    const rahim = groups.find(g => g.personId === 1)!;
    expect(rahim).toMatchObject({ total: 7500, owed: 5000, owedCount: 1, reimbursed: 2500, role: 'admin' });
    expect(groups[0]).toMatchObject({ total: 9000, owed: 9000, reimbursed: 0, role: 'instructor' });
  });

  it('lists a person entries newest first and breaks owed ties by name', () => {
    const groups = groupByPerson([
      paid(2, 'Zed', 'admin', { date: '2026-10-01', reimbursedAt: '2026-10-02' }),
      paid(1, 'Abe', 'super_admin', { date: '2026-10-01', reimbursedAt: '2026-10-02' }),
      paid(1, 'Abe', 'super_admin', { date: '2026-10-07', reimbursedAt: '2026-10-08' }),
    ]);
    expect(groups.map(g => g.name)).toEqual(['Abe', 'Zed']);
    expect(groups[0].entries.map(e => e.date)).toEqual(['2026-10-07', '2026-10-01']);
  });

  it('filterEntries byPeople keeps only person-paid rows', () => {
    const rows = [entry(), paid(1, 'Rahim', 'admin')];
    expect(filterEntries(rows, { byPeople: true })).toEqual([rows[1]]);
  });

  it('labels roles and carries them into the CSV', () => {
    expect(roleLabel('instructor')).toBe('Instructor');
    expect(roleLabel('super_admin')).toBe('Super admin');
    expect(expensesCsv([paid(2, 'Amina', 'instructor')])).toContain('Amina (Instructor)');
  });
});
