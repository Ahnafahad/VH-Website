import { describe, expect, it } from 'vitest';
import {
  UNSORTED,
  buildHistogram,
  computeScoreStats,
  groupByCategory,
  markingRuleLabel,
  pickWindow,
  normalizeCategory, inferCategory } from '../library';

describe('normalizeCategory', () => {
  it('trims, collapses whitespace, and maps empty/Unsorted to null', () => {
    expect(normalizeCategory('  English   Tests ')).toBe('English Tests');
    expect(normalizeCategory('')).toBeNull();
    expect(normalizeCategory('   ')).toBeNull();
    expect(normalizeCategory('unsorted')).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
  });
});

describe('groupByCategory', () => {
  const t = (id: number, category: string | null) => ({ id, category });

  it('sorts named categories alphabetically with Unsorted last', () => {
    const groups = groupByCategory([t(1, 'English Tests'), t(2, null), t(3, 'analytical'), t(4, 'English Tests')]);
    expect(groups.map(g => g.label)).toEqual(['analytical', 'English Tests', UNSORTED]);
    expect(groups[1].tests.map(x => x.id)).toEqual([1, 4]);
    expect(groups[2].category).toBeNull();
  });

  it('always returns an Unsorted group, even when empty', () => {
    const groups = groupByCategory([t(1, 'A')]);
    expect(groups[groups.length - 1]).toMatchObject({ label: UNSORTED, tests: [] });
  });

  it('adds empty groups for extra categories without duplicating existing ones', () => {
    const groups = groupByCategory([t(1, 'A')], ['B', 'A', ' ', 'unsorted']);
    expect(groups.map(g => [g.label, g.tests.length])).toEqual([['A', 1], ['B', 0], [UNSORTED, 0]]);
  });

  it('treats whitespace-variant categories as the same group', () => {
    const groups = groupByCategory([t(1, 'A  B'), t(2, ' A B ')]);
    expect(groups).toHaveLength(2);
    expect(groups[0].tests).toHaveLength(2);
  });
});

describe('computeScoreStats', () => {
  it('returns null with no scores', () => {
    expect(computeScoreStats([], 100)).toBeNull();
  });

  it('computes average %, median, top and pass rate', () => {
    const s = computeScoreStats([30, 40, 60, 90], 100)!;
    expect(s.count).toBe(4);
    expect(s.averagePct).toBe(55);
    expect(s.medianScore).toBe(50);
    expect(s.topScore).toBe(90);
    expect(s.passRate).toBe(75); // 40, 60, 90 are >= 40%
  });

  it('is safe when total marks is 0', () => {
    const s = computeScoreStats([5], 0)!;
    expect(s.averagePct).toBe(0);
    expect(s.passRate).toBe(0);
  });
});

describe('buildHistogram', () => {
  it('bins by % of total marks, clamping negatives and 100% into the end bins', () => {
    const h = buildHistogram([-5, 0, 4, 50, 100, 120], 100, 10);
    expect(h.bins).toHaveLength(10);
    expect(h.bins[0]).toBe(3); // -5, 0, 4
    expect(h.bins[5]).toBe(1); // 50
    expect(h.bins[9]).toBe(2); // 100 and overflow
    expect(h.max).toBe(3);
    expect(h.binWidthPct).toBe(10);
  });

  it('locates the pass bin', () => {
    expect(buildHistogram([], 100, 20, 40).passBin).toBe(8);
    expect(buildHistogram([], 100, 10, 40).passBin).toBe(4);
  });

  it('handles no scores', () => {
    const h = buildHistogram([], 100, 4);
    expect(h.bins).toEqual([0, 0, 0, 0]);
    expect(h.max).toBe(0);
  });
});

describe('markingRuleLabel', () => {
  it('describes uniform rules', () => {
    expect(markingRuleLabel([{ marksPerCorrect: 1, penaltyPerWrong: 0.25 }, { marksPerCorrect: 1, penaltyPerWrong: 0.25 }]))
      .toBe('+1 / −0.25 per question');
    expect(markingRuleLabel([{ marksPerCorrect: 1, penaltyPerWrong: 0 }])).toBe('+1, no penalty');
  });

  it('flags mixed and missing sections', () => {
    expect(markingRuleLabel([{ marksPerCorrect: 1, penaltyPerWrong: 0.25 }, { marksPerCorrect: 2, penaltyPerWrong: 0 }]))
      .toBe('Mixed (per section)');
    expect(markingRuleLabel([])).toBeNull();
  });
});

describe('pickWindow', () => {
  const w = (mode: string, opensAt: number, state: 'upcoming' | 'open' | 'closed') =>
    ({ mode, opensAt, closesAt: opensAt + 10, state });

  it('prefers open, then soonest upcoming, then latest closed, per mode', () => {
    const ws = [w('online', 1, 'closed'), w('online', 5, 'closed'), w('online', 20, 'upcoming'), w('online', 30, 'upcoming'), w('offline', 2, 'closed')];
    expect(pickWindow(ws, 'online')?.opensAt).toBe(20);
    expect(pickWindow([...ws, w('online', 9, 'open')], 'online')?.opensAt).toBe(9);
    expect(pickWindow([w('online', 1, 'closed'), w('online', 5, 'closed')], 'online')?.opensAt).toBe(5);
    expect(pickWindow(ws, 'offline')?.opensAt).toBe(2);
  });

  it('returns null when the mode has no windows', () => {
    expect(pickWindow([w('online', 1, 'open')], 'offline')).toBeNull();
  });
});

describe('inferCategory', () => {
  it('puts every "Week N" test in Vocabulary Quizzes, whatever the topic words say', () => {
    expect(inferCategory('Week 1 — Power, Hierarchy & Legitimacy + Dissent, Ideology & Conspiracy')).toBe('Vocabulary Quizzes');
    expect(inferCategory('Week 13 — Illness, Action & Exceptional Figures + Limits, Measurement & Conflict')).toBe('Vocabulary Quizzes');
    expect(inferCategory('Week 5 — Moral Failure, Guilt & Rebuke + Virtue, Resolve & Arrogance')).toBe('Vocabulary Quizzes');
  });
  it('names the rest after their subject', () => {
    expect(inferCategory('IBA Vocabulary Diagnostic — 60 Questions')).toBe('Vocabulary Quizzes');
    expect(inferCategory('English Test 2')).toBe('English Tests');
    expect(inferCategory('IBA Mathematics Diagnostic Test')).toBe('Maths Tests');
    expect(inferCategory('BTH Topical Exam Maths 2')).toBe('Maths Tests');
    expect(inferCategory('Accounting Test 1')).toBe('Accounting Tests');
    expect(inferCategory('Business Studies Test 1')).toBe('Business Studies Tests');
    expect(inferCategory('FBS Diagnostic — Assessment 1')).toBe('Diagnostics');
    expect(inferCategory('IBA Mock Test 4')).toBe('Mock Tests');
  });
  it('returns null when nothing matches', () => {
    expect(inferCategory('Untitled paper')).toBeNull();
  });
});
