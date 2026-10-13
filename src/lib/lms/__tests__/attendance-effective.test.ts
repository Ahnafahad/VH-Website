import { describe, it, expect } from 'vitest';
import {
  isEffectivelyPresent, staffStateFromRow, effectiveAttendanceMap, resolveAttendanceWrite, inferredWriteBlocked,
} from '../attendance-effective';

const TAKEN = new Date('2026-10-01T10:00:00Z');

describe('isEffectivelyPresent', () => {
  it.each([
    // [name, takenAt, row, sessionHasRows, expected]
    ['untaken, no rows at all, no row -> present (not marked)', null, undefined, false, true],
    ['legacy (rows exist, no taken_at), no row -> absent', null, undefined, true, false],
    ['legacy, present row -> present', null, { status: 'present' }, true, true],
    ['untaken, explicit absent -> absent', null, { status: 'absent' }, true, false],
    ['taken, no row -> present', TAKEN, undefined, true, true],
    ['taken, no row, no rows at all -> present', TAKEN, undefined, false, true],
    ['taken, present row -> present', TAKEN, { status: 'present' }, true, true],
    ['taken, explicit absent -> absent', TAKEN, { status: 'absent' }, true, false],
  ] as const)('%s', (_n, takenAt, row, hasRows, expected) => {
    expect(isEffectivelyPresent(takenAt, row, hasRows)).toBe(expected);
  });
});

describe('staffStateFromRow', () => {
  it('maps rows to the three staff states', () => {
    expect(staffStateFromRow(undefined)).toBe('unmarked');
    expect(staffStateFromRow({ status: 'present' })).toBe('present');
    expect(staffStateFromRow({ status: 'absent' })).toBe('absent');
  });
});

describe('effectiveAttendanceMap', () => {
  const sessions = [
    { id: 1, attendanceTakenAt: null },   // untaken, no rows at all
    { id: 2, attendanceTakenAt: TAKEN },  // new flow, no row
    { id: 3, attendanceTakenAt: TAKEN },  // new flow, online present
    { id: 4, attendanceTakenAt: TAKEN },  // new flow, explicit absent
    { id: 5, attendanceTakenAt: null },   // legacy with rows (other students)
    { id: 6, attendanceTakenAt: null },   // legacy, this student has a row
  ];
  it('covers the three session kinds and explicit absent', () => {
    const m = effectiveAttendanceMap(
      sessions,
      [
        { sessionId: 3, mode: 'online', status: 'present' },
        { sessionId: 4, mode: 'offline', status: 'absent' },
        { sessionId: 6, mode: 'online', status: 'present' },
      ],
      new Set([3, 4, 5, 6]),
    );
    expect(m.get(1)).toBe('offline');  // not marked -> present
    expect(m.get(2)).toBe('offline');  // taken, no row
    expect(m.get(3)).toBe('online');
    expect(m.has(4)).toBe(false);      // explicit absent
    expect(m.has(5)).toBe(false);      // legacy, no row for this student
    expect(m.get(6)).toBe('online');
  });
});

describe('resolveAttendanceWrite', () => {
  it('state input', () => {
    expect(resolveAttendanceWrite({ userId: 1, state: 'unmarked' })).toEqual({ userId: 1, action: 'delete' });
    expect(resolveAttendanceWrite({ userId: 1, state: 'absent', mode: 'online' }))
      .toEqual({ userId: 1, action: 'upsert', status: 'absent', mode: 'offline' });
    expect(resolveAttendanceWrite({ userId: 1, state: 'present', mode: 'online' }))
      .toEqual({ userId: 1, action: 'upsert', status: 'present', mode: 'online' });
  });
  it('legacy boolean input keeps its meaning', () => {
    expect(resolveAttendanceWrite({ userId: 1, present: true, mode: 'offline' }))
      .toEqual({ userId: 1, action: 'upsert', status: 'present', mode: 'offline' });
    expect(resolveAttendanceWrite({ userId: 1, present: false })).toEqual({ userId: 1, action: 'delete' });
  });
});

describe('inferredWriteBlocked', () => {
  it('only an explicit absent row blocks inferred writes', () => {
    expect(inferredWriteBlocked({ status: 'absent' })).toBe(true);
    expect(inferredWriteBlocked({ status: 'present' })).toBe(false);
    expect(inferredWriteBlocked(undefined)).toBe(false);
  });
});
