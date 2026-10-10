import { describe, expect, it } from 'vitest';
import { cleanMarks, completeTotal, computeStats, histogram, isReadyToPublish, isValidMark, normalizeSections } from '../stats';

const sections = [
  { key: 'content', name: 'Content', max: 10 },
  { key: 'grammar', name: 'Grammar', max: 5 },
];

describe('marks', () => {
  it('accepts half marks within range only', () => {
    expect(isValidMark(4.5, 5)).toBe(true);
    expect(isValidMark(5.5, 5)).toBe(false);
    expect(isValidMark(-1, 5)).toBe(false);
    expect(isValidMark(2.25, 5)).toBe(false);
  });

  it('cleans marks to known sections and rejects invalid values', () => {
    expect(cleanMarks({ content: 7, grammar: null, extra: 3 }, sections)).toEqual({ content: 7, grammar: null });
    expect(cleanMarks({ content: 11 }, sections)).toBeNull();
  });

  it('totals only when every section is marked', () => {
    expect(completeTotal({ content: 7, grammar: null }, sections)).toBeNull();
    expect(completeTotal({ content: 7, grammar: 3.5 }, sections)).toBe(10.5);
  });
});

describe('normalizeSections', () => {
  it('validates names and maxima and assigns keys', () => {
    expect(normalizeSections([{ name: 'Content', max: 10 }, { name: 'Grammar', max: 5 }])).toEqual([
      { key: 's1', name: 'Content', max: 10 },
      { key: 's2', name: 'Grammar', max: 5 },
    ]);
    expect(normalizeSections([{ name: '', max: 5 }])).toBeNull();
    expect(normalizeSections([{ name: 'X', max: 0 }])).toBeNull();
    expect(normalizeSections([])).toBeNull();
  });
});

describe('stats', () => {
  it('bins a 20-mark scale in single marks and puts the max in the last bin', () => {
    const bins = histogram([0, 10, 20, 19.5], 20);
    expect(bins).toHaveLength(20);
    expect(bins[0].count).toBe(1);
    expect(bins[10].count).toBe(1);
    expect(bins[19].count).toBe(2);
  });

  it('computes average, highest and lowest', () => {
    const s = computeStats([10, 15, 20], 20);
    expect(s).toMatchObject({ count: 3, average: 15, highest: 20, lowest: 10 });
    expect(computeStats([], 20).average).toBeNull();
  });
});

describe('isReadyToPublish', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const past = new Date('2026-10-10T10:00:00Z');
  const future = new Date('2026-10-10T14:00:00Z');

  it('waits for the deadline', () => {
    expect(isReadyToPublish({ deadline: future, now, publishedAt: null, statuses: ['graded'] })).toBe(false);
  });
  it('waits until nothing is left to mark', () => {
    expect(isReadyToPublish({ deadline: past, now, publishedAt: null, statuses: ['graded', 'submitted'] })).toBe(false);
  });
  it('publishes when every script is graded or rejected', () => {
    expect(isReadyToPublish({ deadline: past, now, publishedAt: null, statuses: ['graded', 'rejected'] })).toBe(true);
  });
  it('never republishes and never publishes an empty series', () => {
    expect(isReadyToPublish({ deadline: past, now, publishedAt: past, statuses: ['graded'] })).toBe(false);
    expect(isReadyToPublish({ deadline: past, now, publishedAt: null, statuses: [] })).toBe(false);
  });
});
