import { describe, it, expect } from 'vitest';
import {
  buildAttendanceTicks, buildHomeworkStates, lastMarks, describeTicks, describeHomework,
  matchesQuery, filterAndSortStudents, computeMarkDomain, mapPosition, buildMapPoints,
} from '../progress-pure';
import type { StudentSummary } from '../progress-types';

const day = (n: number) => new Date(2026, 0, n);

function student(over: Partial<StudentSummary> & { id: number; name: string }): StudentSummary {
  return {
    email: `${over.name.toLowerCase().replace(/\s/g, '.')}@x.com`,
    studentId: null, products: ['iba'], attendancePercent: 50, attendedSessions: 0, totalSessions: 0,
    lastTest: null, lexicorePoints: 0, testsTaken: 0, avgTestPercentage: 60, trend: null,
    homeworkSubmitted: 0, homeworkDue: 0, whatsapp: null, recentAttendance: [], recentHomework: [], recentMarks: [],
    ...over,
  };
}

describe('buildAttendanceTicks', () => {
  const sessions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => ({ id: i, scheduledAt: day(i) }));

  it('keeps the last 8 classes', () => {
    expect(buildAttendanceTicks([...sessions].reverse(), new Map())).toHaveLength(8);
  });

  it('maps offline to present, online to online, missing to absent', () => {
    const ticks = buildAttendanceTicks(sessions.slice(0, 3), new Map([[1, 'offline'], [2, 'online']]));
    expect(ticks).toEqual(['present', 'online', 'absent']);
  });

  it('orders by date, not by input order or id', () => {
    const s = [{ id: 1, scheduledAt: day(5) }, { id: 2, scheduledAt: day(1) }];
    expect(buildAttendanceTicks(s, new Map([[2, 'offline']]))).toEqual(['present', 'absent']);
  });

  it('returns an empty list when there are no classes', () => {
    expect(buildAttendanceTicks([], new Map())).toEqual([]);
  });
});

describe('buildHomeworkStates', () => {
  it('maps reviewed, submitted and missing and keeps the last 6', () => {
    const hw = [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ id: i, dueAt: day(i) }));
    const states = buildHomeworkStates(hw, new Map([[8, 'reviewed'], [7, 'submitted']]));
    expect(states).toHaveLength(6);
    expect(states.slice(-2)).toEqual(['waiting', 'reviewed']);
    expect(states[0]).toBe('missing');
  });
});

describe('lastMarks', () => {
  it('rounds and keeps the last 6', () => {
    expect(lastMarks([1.4, 2.4, 3, 4, 5, 6, 7.6])).toEqual([2, 3, 4, 5, 6, 8]);
  });
});

describe('describe helpers', () => {
  it('counts each state', () => {
    expect(describeTicks(['present', 'online', 'absent', 'absent'])).toBe('Last 4 classes: 1 present, 1 online, 2 absent');
    expect(describeHomework(['reviewed', 'waiting', 'missing'])).toBe('Last 3 homeworks: 1 reviewed, 1 waiting for review, 1 missing');
    expect(describeTicks([])).toBe('No classes yet');
  });
});

describe('matchesQuery', () => {
  const s = student({ id: 1, name: 'Aanya Rahman', email: 'aanya@x.com' });
  it('matches name and email, ignoring case and surrounding spaces', () => {
    expect(matchesQuery(s, '  RAHM ')).toBe(true);
    expect(matchesQuery(s, 'aanya@')).toBe(true);
    expect(matchesQuery(s, 'zzz')).toBe(false);
    expect(matchesQuery(s, '')).toBe(true);
  });
});

describe('filterAndSortStudents', () => {
  const a = student({ id: 1, name: 'Aanya', attendancePercent: 90, avgTestPercentage: 70 });
  const b = student({ id: 2, name: 'Bilal', attendancePercent: 40, avgTestPercentage: null });
  const c = student({ id: 3, name: 'Chowdhury', attendancePercent: null, avgTestPercentage: 55 });
  const base = { query: '', onlyRisk: false, riskIds: new Set<number>(), sortKey: 'name' as const, dir: 'asc' as const };

  it('sorts by name both ways', () => {
    expect(filterAndSortStudents([c, a, b], base).map(s => s.id)).toEqual([1, 2, 3]);
    expect(filterAndSortStudents([c, a, b], { ...base, dir: 'desc' }).map(s => s.id)).toEqual([3, 2, 1]);
  });

  it('puts missing values last in either direction', () => {
    expect(filterAndSortStudents([a, b, c], { ...base, sortKey: 'avg', dir: 'asc' }).map(s => s.id)).toEqual([3, 1, 2]);
    expect(filterAndSortStudents([a, b, c], { ...base, sortKey: 'avg', dir: 'desc' }).map(s => s.id)).toEqual([1, 3, 2]);
    expect(filterAndSortStudents([a, b, c], { ...base, sortKey: 'attendance', dir: 'desc' }).map(s => s.id)).toEqual([1, 2, 3]);
  });

  it('filters by query and at-risk only', () => {
    expect(filterAndSortStudents([a, b, c], { ...base, query: 'bil' }).map(s => s.id)).toEqual([2]);
    expect(filterAndSortStudents([a, b, c], { ...base, onlyRisk: true, riskIds: new Set([3]) }).map(s => s.id)).toEqual([3]);
  });

  it('does not mutate the input', () => {
    const input = [c, a, b];
    filterAndSortStudents(input, base);
    expect(input.map(s => s.id)).toEqual([3, 1, 2]);
  });
});

describe('cohort map', () => {
  it('pads and snaps the mark domain to tens, at least 20 wide', () => {
    expect(computeMarkDomain([44, 84])).toEqual({ lo: 30, hi: 90, ticks: [30, 60, 90] });
    expect(computeMarkDomain([60, 62])).toEqual({ lo: 50, hi: 70, ticks: [50, 60, 70] });
    expect(computeMarkDomain([])).toEqual({ lo: 0, hi: 100, ticks: [0, 50, 100] });
  });

  it('stays inside 0..100 at the edges', () => {
    const d = computeMarkDomain([98, 100]);
    expect(d.hi).toBe(100);
    expect(d.hi - d.lo).toBeGreaterThanOrEqual(20);
  });

  it('positions a student within the box', () => {
    const d = { lo: 40, hi: 90, ticks: [40, 65, 90] };
    expect(mapPosition(50, 65, d)).toEqual({ x: 50, y: 50 });
    expect(mapPosition(120, 200, d)).toEqual({ x: 100, y: 100 });
  });

  it('counts students that cannot be plotted', () => {
    const d = { lo: 0, hi: 100, ticks: [0, 50, 100] };
    const { points, unplotted } = buildMapPoints([
      student({ id: 1, name: 'A', attendancePercent: 80, avgTestPercentage: 60 }),
      student({ id: 2, name: 'B', attendancePercent: null }),
      student({ id: 3, name: 'C', avgTestPercentage: null }),
    ], d);
    expect(points).toHaveLength(1);
    expect(unplotted).toBe(2);
  });
});
