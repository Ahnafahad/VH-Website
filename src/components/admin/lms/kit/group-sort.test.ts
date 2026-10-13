import { describe, it, expect } from 'vitest';
import {
  monthKey, monthLabel, currentMonthKey, groupByMonth, initialOpenMonths, classMarks,
  sortMaterials, groupInOrder, submissionShape, homeworkStatus, readPref, writePref,
} from './group-sort';
import { suggestClassForFile, type SuggestableClass } from './attach-suggest';

const D = (iso: string) => new Date(iso).getTime();

describe('month helpers (Dhaka calendar)', () => {
  it('uses Dhaka time at the month boundary', () => {
    // 18:30 UTC on 30 Sep is 00:30 on 1 Oct in Dhaka.
    expect(monthKey(D('2026-09-30T18:30:00Z'))).toBe('2026-10');
    expect(monthKey(D('2026-09-30T17:30:00Z'))).toBe('2026-09');
  });
  it('labels and current key', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(currentMonthKey(D('2026-10-13T06:00:00Z'))).toBe('2026-10');
  });
  it('groups newest first, items inside too', () => {
    const items = [
      { t: D('2026-09-20T06:00:00Z') }, { t: D('2026-10-11T06:00:00Z') },
      { t: D('2026-10-13T06:00:00Z') }, { t: D('2026-08-01T06:00:00Z') },
    ];
    const g = groupByMonth(items, (i) => i.t);
    expect(g.map((b) => b.key)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(g[0].items.map((i) => i.t)).toEqual([D('2026-10-13T06:00:00Z'), D('2026-10-11T06:00:00Z')]);
    expect(groupByMonth(items, (i) => i.t, false).map((b) => b.key)).toEqual(['2026-08', '2026-09', '2026-10']);
  });
  it('opens the current month, else the newest', () => {
    const now = D('2026-10-13T06:00:00Z');
    expect([...initialOpenMonths(['2026-10', '2026-09'], now)]).toEqual(['2026-10']);
    expect([...initialOpenMonths(['2026-09', '2026-08'], now)]).toEqual(['2026-09']);
    expect(initialOpenMonths([], now).size).toBe(0);
  });
});

describe('classMarks', () => {
  it('keeps bot and recording separate', () => {
    expect(classMarks({ recallBotId: 'b', recordingStatus: 'pending' })).toMatchObject({ bot: true, rec: false, complete: false });
    expect(classMarks({ recallBotId: null, recordingStatus: 'available' })).toMatchObject({ bot: false, rec: true });
  });
  it('is complete only with all four', () => {
    expect(classMarks({ recallBotId: 'b', recordingStatus: 'available', materialCount: 2, homeworkCount: 1 }).complete).toBe(true);
    expect(classMarks({ recallBotId: 'b', recordingStatus: 'available', materialCount: 0, homeworkCount: 1 }).complete).toBe(false);
  });
});

describe('sortMaterials', () => {
  const m = [
    { id: 1, title: 'b notes', type: 'pdf', fileSize: 100, createdAt: 10 },
    { id: 2, title: 'A deck', type: 'html', fileSize: 900, createdAt: 30 },
    { id: 3, title: 'a10', type: 'link', fileSize: null, createdAt: 20 },
    { id: 4, title: 'a2', type: 'pdf', fileSize: 500, createdAt: 20 },
  ];
  it('sorts each way', () => {
    expect(sortMaterials(m, 'newest').map((x) => x.id)).toEqual([2, 4, 3, 1]);
    expect(sortMaterials(m, 'oldest').map((x) => x.id)).toEqual([1, 3, 4, 2]);
    expect(sortMaterials(m, 'name').map((x) => x.id)).toEqual([2, 4, 3, 1]);
    expect(sortMaterials(m, 'size').map((x) => x.id)).toEqual([2, 4, 1, 3]);
    expect(sortMaterials(m, 'type').map((x) => x.id)).toEqual([2, 3, 4, 1]);
  });
  it('does not mutate input', () => {
    const copy = [...m];
    sortMaterials(m, 'name');
    expect(m).toEqual(copy);
  });
  it('groupInOrder keeps first-seen order', () => {
    const g = groupInOrder([1, 2, 3, 4], (n) => ({ key: n % 2 ? 'odd' : 'even', label: n % 2 ? 'Odd' : 'Even' }));
    expect(g.map((x) => x.key)).toEqual(['odd', 'even']);
    expect(g[0].items).toEqual([1, 3]);
  });
});

describe('homework', () => {
  const now = D('2026-10-13T06:00:00Z');
  it('shape: reviewed / waiting / missing', () => {
    expect(submissionShape({ dueAt: 0, submittedCount: 5, reviewedCount: 2, scopeCount: 8 }))
      .toEqual({ reviewed: 2, waiting: 3, missing: 3, total: 8 });
  });
  it('shape tolerates missing counts and out-of-scope submitters', () => {
    expect(submissionShape({ dueAt: 0 })).toEqual({ reviewed: 0, waiting: 0, missing: 0, total: 0 });
    expect(submissionShape({ dueAt: 0, submittedCount: 4, reviewedCount: 9, scopeCount: 2 }))
      .toEqual({ reviewed: 4, waiting: 0, missing: 0, total: 4 });
  });
  it('status: review beats open/closed', () => {
    expect(homeworkStatus({ dueAt: now - 1, submittedCount: 3, reviewedCount: 1, scopeCount: 5 }, now)).toBe('review');
    expect(homeworkStatus({ dueAt: now + 1, submittedCount: 3, reviewedCount: 3, scopeCount: 5 }, now)).toBe('open');
    expect(homeworkStatus({ dueAt: now - 1, submittedCount: 3, reviewedCount: 3, scopeCount: 5 }, now)).toBe('closed');
  });
});

describe('preferences', () => {
  const mem = () => {
    const s = new Map<string, string>();
    return { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => void s.set(k, v) };
  };
  it('round-trips and rejects unknown values', () => {
    const st = mem();
    expect(readPref('k', ['a', 'b'] as const, 'a', st)).toBe('a');
    writePref('k', 'b', st);
    expect(readPref('k', ['a', 'b'] as const, 'a', st)).toBe('b');
    writePref('k', 'zzz', st);
    expect(readPref('k', ['a', 'b'] as const, 'a', st)).toBe('a');
  });
  it('survives a throwing or missing storage', () => {
    const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readPref('k', ['a'] as const, 'a', bad)).toBe('a');
    expect(() => writePref('k', 'a', bad)).not.toThrow();
    expect(readPref('k', ['a'] as const, 'a', null)).toBe('a');
  });
});

describe('suggestClassForFile', () => {
  const cls = (o: Partial<SuggestableClass> & { id: number }): SuggestableClass => ({
    title: 'x', subject: 'english', product: 'iba', topic: null, classNumber: null,
    displayClassNumber: null, scheduledAt: 0, ...o,
  });
  const classes = [
    cls({ id: 1, subject: 'english', displayClassNumber: 6, title: 'IBA English Class 6' }),
    cls({ id: 2, subject: 'math', displayClassNumber: 6, title: 'IBA Math Class 6' }),
    cls({ id: 3, subject: 'english', displayClassNumber: 7, title: 'IBA English Class 7', scheduledAt: 5 }),
  ];
  it('matches subject and number', () => {
    expect(suggestClassForFile('IBA English Lecture 7.pdf', 'iba', classes)?.id).toBe(3);
    expect(suggestClassForFile('Maths Lecture 6.pdf', 'iba', classes)?.id).toBe(2);
  });
  it('returns null without a signal', () => {
    expect(suggestClassForFile('scan001.pdf', 'iba', classes)).toBeNull();
    expect(suggestClassForFile('English Lecture 99.pdf', 'iba', classes)).toBeNull();
  });
  it('does not cross products', () => {
    expect(suggestClassForFile('English Lecture 7.pdf', 'fbs', classes)).toBeNull();
  });
});
