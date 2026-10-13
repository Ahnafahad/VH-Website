import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';

const mocks = vi.hoisted(() => ({
  values: vi.fn(), set: vi.fn(), where: vi.fn(), returning: vi.fn(), get: vi.fn(),
  insert: vi.fn(), update: vi.fn(), select: vi.fn(), del: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: { insert: mocks.insert, update: mocks.update, select: mocks.select, delete: mocks.del, transaction: (fn: (tx: { update: typeof mocks.update }) => unknown) => fn({ update: mocks.update }) } }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/db-access-control', () => ({ isEmailAuthorized: vi.fn() }));
vi.mock('@/lib/vocab/error-log', () => ({ logVocabErrorSafe: vi.fn() }));

import { operationalEntries, operationalExtraClasses } from '@/lib/db/schema';
import { deleteOperationalRecord, reimburseExpenses, saveOperationalRecord } from '../operations-store';

const entry = { date: '2026-10-06', amount: '123.45', category: 'Travel', description: 'Bus fare' };
const expense = { ...entry, category: 'Transport', paidBy: null, reimbursedAt: null };
const payloads = { expenses: expense, income: entry } as const;
const extra = {
  instructorId: 2, subject: 'Math', startsAt: '2026-10-06T10:00:00+06:00',
  endsAt: '2026-10-06T11:00:00+06:00', roomNumber: '201', status: 'scheduled', notes: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  const chain = { values: mocks.values, set: mocks.set, where: mocks.where, returning: mocks.returning, get: mocks.get };
  mocks.insert.mockReturnValue(chain);
  mocks.update.mockReturnValue(chain);
  mocks.del.mockReturnValue(chain);
  mocks.values.mockReturnValue(chain);
  mocks.set.mockReturnValue(chain);
  mocks.where.mockReturnValue(chain);
  mocks.returning.mockResolvedValue([{ id: 9 }]);
  mocks.select.mockReturnValue({ from: () => chain });
  mocks.get.mockResolvedValue({ id: 2, isTeaching: true });
});

describe('operational storage writes (mocked database)', () => {
  it.each([['expenses', 'expense'], ['income', 'income']] as const)('creates %s with exact paisa and the authenticated creator', async (section, kind) => {
    const body = payloads[section];
    await expect(saveOperationalRecord(section, body, 7)).resolves.toEqual({ id: 9 });
    expect(mocks.insert).toHaveBeenCalledWith(operationalEntries);
    const expenseOnly = section === 'expenses' ? {
      payee: null, paymentMethod: null, referenceNo: null, receiptKey: null, product: null, batch: null,
      classSessionId: null, location: null, tags: null, updatedBy: 7,
    } : {};
    expect(mocks.values).toHaveBeenCalledWith({ kind, date: entry.date, amountMinor: 12345, category: body.category, description: entry.description, paidBy: null, reimbursedAt: null, ...expenseOnly, createdBy: 7 });
  });

  it.each([['expenses', 'expense'], ['income', 'income']] as const)('scopes %s edits to both ID and record kind', async (section, kind) => {
    await saveOperationalRecord(section, payloads[section], 7, 9);
    expect(mocks.update).toHaveBeenCalledWith(operationalEntries);
    const condition = mocks.where.mock.calls[0][0];
    expect(new SQLiteSyncDialect().sqlToQuery(condition).params).toEqual([9, kind]);
    expect(mocks.set.mock.calls[0][0]).not.toHaveProperty('createdBy');
  });

  it('saves the tracker detail fields and records who last edited', async () => {
    await saveOperationalRecord('expenses', {
      ...expense, payee: 'Dhaka Print', paymentMethod: 'bKash', referenceNo: 'TXN-1', receiptKey: 'expense-receipts/1-a.pdf',
      product: 'IBA', batch: '2026-27', classSessionId: 5, location: 'Mirpur', tags: ['mock', 'print'],
    }, 7);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
      payee: 'Dhaka Print', paymentMethod: 'bKash', referenceNo: 'TXN-1', receiptKey: 'expense-receipts/1-a.pdf',
      product: 'IBA', batch: '2026-27', classSessionId: 5, location: 'Mirpur', tags: 'mock,print', updatedBy: 7,
    }));
  });

  it.each(['admin', 'super_admin', 'instructor'])('accepts a %s as the payer', async role => {
    mocks.get.mockResolvedValueOnce({ role });
    await expect(saveOperationalRecord('expenses', { ...expense, paidBy: 4 }, 7)).resolves.toEqual({ id: 9 });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ paidBy: 4 }));
  });

  it.each(['student', undefined])('rejects %s or a missing user as the payer', async role => {
    mocks.get.mockResolvedValueOnce(role ? { role } : undefined);
    await expect(saveOperationalRecord('expenses', { ...expense, paidBy: 4 }, 7)).rejects.toMatchObject({ status: 400 });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects a link to a class that does not exist', async () => {
    mocks.get.mockResolvedValueOnce(undefined);
    await expect(saveOperationalRecord('expenses', { ...expense, classSessionId: 99 }, 7)).rejects.toMatchObject({ status: 400 });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('reports a missing record instead of silently succeeding', async () => {
    mocks.returning.mockResolvedValue([]);
    await expect(saveOperationalRecord('expenses', expense, 7, 9)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects invalid entries before any database write', async () => {
    await expect(saveOperationalRecord('expenses', { ...expense, amount: '-1' }, 7)).rejects.toMatchObject({ status: 400 });
    await expect(saveOperationalRecord('expenses', { ...expense, category: 'Travel' }, 7)).rejects.toMatchObject({ status: 400 });
    await expect(saveOperationalRecord('expenses', { ...expense, reimbursedAt: '2026-10-07' }, 7)).rejects.toMatchObject({ status: 400 });
    await expect(saveOperationalRecord('instructors', {}, 7)).rejects.toMatchObject({ status: 405 });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('creates internal extra classes with the specified timing and room', async () => {
    await saveOperationalRecord('extra-classes', extra, 7);
    expect(mocks.insert).toHaveBeenCalledWith(operationalExtraClasses);
    expect(mocks.values).toHaveBeenCalledWith({
      ...extra, startsAt: new Date('2026-10-06T04:00:00Z'), endsAt: new Date('2026-10-06T05:00:00Z'), createdBy: 7,
    });
  });

  it('rejects a student selected as instructor', async () => {
    mocks.get.mockResolvedValue({ id: 2, isTeaching: false });
    await expect(saveOperationalRecord('extra-classes', extra, 7)).rejects.toMatchObject({ status: 400 });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('allows editing an existing extra class after its instructor stops teaching', async () => {
    mocks.get.mockResolvedValueOnce({ id: 9, instructorId: 2 }).mockResolvedValueOnce({ id: 2, isTeaching: false });
    await expect(saveOperationalRecord('extra-classes', extra, 7, 9)).resolves.toEqual({ id: 9 });
    expect(mocks.update).toHaveBeenCalledWith(operationalExtraClasses);
  });

  it('rejects a missing extra class before writing', async () => {
    mocks.get.mockResolvedValueOnce(undefined);
    await expect(saveOperationalRecord('extra-classes', extra, 7, 9)).rejects.toMatchObject({ status: 404 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe('operational deletes', () => {
  it('deletes a financial entry scoped to its kind', async () => {
    await expect(deleteOperationalRecord('expenses', 9)).resolves.toEqual({ deleted: true });
    expect(mocks.del).toHaveBeenCalledWith(operationalEntries);
    expect(new SQLiteSyncDialect().sqlToQuery(mocks.where.mock.calls[0][0]).params).toEqual([9, 'expense']);
  });

  it('deletes an extra class and reports a missing record', async () => {
    await deleteOperationalRecord('extra-classes', 4);
    expect(mocks.del).toHaveBeenCalledWith(operationalExtraClasses);
    mocks.returning.mockResolvedValue([]);
    await expect(deleteOperationalRecord('income', 99)).rejects.toMatchObject({ status: 404 });
  });

  it('keeps the instructor report read-only', async () => {
    await expect(deleteOperationalRecord('instructors', 1)).rejects.toMatchObject({ status: 405 });
  });
});

describe('reimburseExpenses', () => {
  it('marks only person-paid outstanding rows in one transaction and reports the count', async () => {
    mocks.returning.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    await expect(reimburseExpenses({ ids: [1, 2, 3] }, 7)).resolves.toEqual({ updated: 2 });
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ reimbursedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), updatedBy: 7 }));
    const params = new SQLiteSyncDialect().sqlToQuery(mocks.where.mock.calls[0][0]).params;
    expect(params).toEqual(expect.arrayContaining([1, 2, 3, 'expense']));
  });

  it.each([{}, { ids: [] }, { ids: [0] }, { ids: ['1'] }])('rejects invalid body %j before writing', async body => {
    await expect(reimburseExpenses(body, 7)).rejects.toMatchObject({ status: 400 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
