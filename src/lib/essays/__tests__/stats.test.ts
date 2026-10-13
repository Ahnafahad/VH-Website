import { describe, expect, it } from 'vitest';
import { computeStats, histogram, isReadyToPublish, normalizeSections, statsByEssay } from '../stats';

describe('statsByEssay', () => {
  it('keeps each essay on its own scale', () => {
    const essays = [{ prompt: '', max: 10 }, { prompt: '', max: 15 }];
    const [e1, e2] = statsByEssay([
      { essayIndex: 1, total: 8 },
      { essayIndex: 1, total: 6 },
      { essayIndex: 2, total: 15 },
    ], essays);
    expect(e1).toMatchObject({ essayIndex: 1, max: 10, count: 2, average: 7, highest: 8 });
    expect(e1.histogram).toHaveLength(10);
    expect(e2).toMatchObject({ essayIndex: 2, max: 15, count: 1, average: 15 });
    expect(e2.histogram).toHaveLength(15);
    expect(e2.histogram[14].count).toBe(1);
  });

  it('reports an essay with nothing graded as empty', () => {
    expect(statsByEssay([], [{ prompt: '', max: 10 }])[0]).toMatchObject({ count: 0, average: null });
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
