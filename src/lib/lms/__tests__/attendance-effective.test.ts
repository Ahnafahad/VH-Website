import { describe, it, expect } from 'vitest';
import {
  isEffectivelyPresent, staffStateFromRow, effectiveAttendanceMap, resolveAttendanceWrite, inferredWriteBlocked,
} from '../attendance-effective';

const TAKEN = new Date('2026-10-01T10:00:00Z');

describe('isEffectivelyPresent', () => {
  it.each([
    // [takenAt, row, expected]
    ['legacy, no row -> absent', null, undefined, false],
    ['legacy, present row -> present', null, { status: 'present' }, true],
    ['taken, no row -> present', TAKEN, undefined, true],
    ['taken, present row -> present', TAKEN, { status: 'present' }, true],
    ['taken, explicit absent -> absent', TAKEN, { status: 'absent' }, false],
  ] as const)('%s', (_n, takenAt, row, expected) => {
    expect(isEffectivelyPresent(takenAt, row)).toBe(expected);
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
    { id: 1, attendanceTakenAt: null },   // legacy
    { id: 2, attendanceTakenAt: TAKEN },  // taken
    { id: 3, attendanceTakenAt: TAKEN },  // taken
    { id: 4, attendanceTakenAt: TAKEN },  // taken
  ];
  it('applies legacy rule to untaken sessions and present-by-default to taken ones', () => {
    const m = effectiveAttendanceMap(sessions, [
      { sessionId: 3, mode: 'online', status: 'present' },
      { sessionId: 4, mode: 'offline', status: 'absent' },
    ]);
    expect(m.has(1)).toBe(false);      // legacy, no row
    expect(m.get(2)).toBe('offline');  // taken, no row
    expect(m.get(3)).toBe('online');
    expect(m.has(4)).toBe(false);      // explicit absent
  });
  it('legacy numbers do not change: untaken sessions count rows only', () => {
    const legacy = [{ id: 1, attendanceTakenAt: null }, { id: 2, attendanceTakenAt: null }];
    expect([...effectiveAttendanceMap(legacy, [{ sessionId: 1, mode: 'offline', status: 'present' }]).keys()]).toEqual([1]);
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
