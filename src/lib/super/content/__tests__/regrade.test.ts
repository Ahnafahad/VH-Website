import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { computeRegradeDiff, type RegradeInput } from '../regrade';
import { diffSnapshots, type TestSnapshot } from '../versions';

const input = (attemptId: number, oldScore: number, newScore: number): RegradeInput => ({
  attemptId, userId: attemptId, name: `S${attemptId}`,
  oldScore, newScore, oldCorrect: oldScore, newCorrect: newScore,
  oldWrong: 0, newWrong: 0, oldUnattempted: 0, newUnattempted: 0,
  oldSections: '[]', newSections: '[]',
});

describe('computeRegradeDiff', () => {
  it('reports changed counts and rank movement', () => {
    // before: A=10 (#1), B=8 (#2), C=5 (#3); after fix B=12 jumps to #1, A to #2
    const d = computeRegradeDiff([input(1, 10, 10), input(2, 8, 12), input(3, 5, 5)]);
    expect(d.total).toBe(3);
    expect(d.changedCount).toBe(1);
    expect(d.rankChangedCount).toBe(2);
    const b = d.rows.find(r => r.attemptId === 2)!;
    expect([b.oldRank, b.newRank, b.rankDelta]).toEqual([2, 1, 1]);
    expect(d.rows.find(r => r.attemptId === 1)!.rankDelta).toBe(-1);
    expect(d.topMovers.map(m => m.attemptId).sort()).toEqual([1, 2]);
  });

  it('flags nothing when nothing changed', () => {
    const d = computeRegradeDiff([input(1, 4, 4), input(2, 3, 3)]);
    expect(d.changedCount).toBe(0);
    expect(d.rankChangedCount).toBe(0);
    expect(d.topMovers).toEqual([]);
  });

  it('treats a section-breakdown-only change as changed', () => {
    const r = { ...input(1, 4, 4), newSections: '[{"x":1}]' };
    expect(computeRegradeDiff([r]).changedCount).toBe(1);
  });
});

describe('diffSnapshots', () => {
  const q = (id: number, key: string | null, stem = 's') => ({ id, number: id, stem, options: '[]', correctKey: key, imageUrl: null, explanation: null });
  const snap = (qs: ReturnType<typeof q>[]): TestSnapshot => ({ sections: [], groups: [], windows: [], questions: qs });
  it('counts key and content differences, additions and removals', () => {
    const old = snap([q(1, 'A'), q(2, 'B'), q(3, 'C', 'old')]);
    const cur = snap([q(1, 'B'), q(2, 'B'), q(3, 'C', 'new'), q(4, 'D')]);
    expect(diffSnapshots(old, cur)).toEqual({ questionsChanged: 1, keysChanged: 1, added: 1, removed: 0 });
  });
});
