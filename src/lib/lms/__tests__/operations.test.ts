import { describe, expect, it } from 'vitest';
import { buildInstructorReport, extraClassInput, financialEntryInput, isOperationalAdmin } from '../operations';

const now = new Date('2026-03-15T12:00:00Z');
const session = (date: string, overrides = {}) => ({
  instructorId: 1, instructorName: 'Amina', scheduledAt: new Date(date), status: 'completed', ...overrides,
});

describe('instructor monthly history', () => {
  it('shows all months across years, including empty months and inactive instructors', () => {
    const result = buildInstructorReport([
      session('2025-11-10T12:00:00Z'), session('2026-03-01T12:00:00Z'),
      session('2025-12-01T12:00:00Z', { instructorId: 2, instructorName: 'Former teacher' }),
    ], [{ id: 1, name: 'Amina' }, { id: 3, name: 'No classes' }], now);
    expect(result.months.map(m => m.key)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
    expect(result.instructors).toEqual([
      { id: 1, name: 'Amina', counts: [1, 0, 0, 0, 1], total: 2 },
      { id: 2, name: 'Former teacher', counts: [0, 1, 0, 0, 0], total: 1 },
      { id: 3, name: 'No classes', counts: [0, 0, 0, 0, 0], total: 0 },
    ]);
  });

  it('counts the Dhaka month rather than the UTC month at midnight', () => {
    const result = buildInstructorReport([
      session('2026-01-31T17:59:59Z'), session('2026-01-31T18:00:00Z'),
    ], [], now);
    expect(result.months.map(m => m.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(result.instructors[0].counts).toEqual([1, 1, 0]);
  });

  it('excludes cancelled, draft, live, scheduled and future sessions', () => {
    const result = buildInstructorReport([
      ...['cancelled', 'draft', 'live', 'scheduled'].map(status => session('2025-01-01T00:00:00Z', { status })),
      session('2026-03-16T00:00:00Z'), session('2026-03-14T00:00:00Z'),
    ], [], now);
    expect(result.months).toHaveLength(1);
    expect(result.instructors[0].total).toBe(1);
  });

  it('exposes missing instructor assignments without inventing an attribution', () => {
    const result = buildInstructorReport([
      session('2026-03-01T00:00:00Z', { instructorId: null, instructorName: null }),
    ], [], now);
    expect(result.instructors).toEqual([{ id: null, name: 'Unassigned', counts: [1], total: 1 }]);
  });

  it('returns the current month and zero counts when there are no completed sessions', () => {
    const result = buildInstructorReport([], [{ id: 1, name: 'Amina' }], now);
    expect(result.months.map(m => m.key)).toEqual(['2026-03']);
    expect(result.instructors[0].counts).toEqual([0]);
  });
});

describe('operational record validation', () => {
  const entry = { date: '2026-02-28', amount: '0.29', category: 'Travel', description: 'Bus fare' };
  it('stores BDT exactly as integer paisa', () => {
    expect(financialEntryInput.parse(entry).amount).toBe(29);
    expect(financialEntryInput.parse({ ...entry, amount: '1234.5' }).amount).toBe(123450);
  });
  it.each(['0', '-1', 'Infinity', '1e3', '1.001', '99999999999999999'])('rejects invalid amount %s', amount => {
    expect(financialEntryInput.safeParse({ ...entry, amount }).success).toBe(false);
  });
  it.each(['2026-02-29', '2026-13-01', '2026-04-31', '2026-2-1'])('rejects invalid calendar date %s', date => {
    expect(financialEntryInput.safeParse({ ...entry, date }).success).toBe(false);
  });
  it('requires a category or income source', () => {
    expect(financialEntryInput.safeParse({ ...entry, category: ' ' }).success).toBe(false);
  });
  const extra = {
    instructorId: 1, subject: 'Math', startsAt: '2026-03-01T10:00:00+06:00',
    endsAt: '2026-03-01T11:00:00+06:00', roomNumber: '201', status: 'scheduled', notes: '',
  };
  it('accepts extra class timing and room details', () => {
    expect(extraClassInput.safeParse(extra).success).toBe(true);
  });
  it('rejects reversed or equal start/end times', () => {
    expect(extraClassInput.safeParse({ ...extra, endsAt: extra.startsAt }).success).toBe(false);
    expect(extraClassInput.safeParse({ ...extra, endsAt: '2026-03-01T09:00:00+06:00' }).success).toBe(false);
  });
  it('requires instructor and room', () => {
    expect(extraClassInput.safeParse({ ...extra, instructorId: 0 }).success).toBe(false);
    expect(extraClassInput.safeParse({ ...extra, roomNumber: ' ' }).success).toBe(false);
  });
});

describe('operational role restrictions', () => {
  it.each(['admin', 'super_admin'])('allows %s', role => expect(isOperationalAdmin(role)).toBe(true));
  it.each(['student', 'instructor', '', undefined])('rejects %s', role => expect(isOperationalAdmin(role)).toBe(false));
});
