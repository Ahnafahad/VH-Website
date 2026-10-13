import { describe, expect, it } from 'vitest';
import {
  DAY_MS, WEEK_MS, TREND_WEEKS, lookbackDays, masterySplit, rankGames, sanitisePeriod, shapeGame, shapeSets,
  summariseLastWord, weeklyBuckets, type GameDef, type PlayRow,
} from '../games';

// Wednesday 2026-10-14 12:00 UTC (18:00 in Dhaka).
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);
const def: GameDef = { id: 'g', label: 'Game', quality: 'exact', source: 'test' };
const ago = (days: number) => NOW - days * DAY_MS;

describe('sanitisePeriod / lookbackDays', () => {
  it('accepts only 7, 30 or 90 and defaults to 30', () => {
    expect(sanitisePeriod('7')).toBe(7);
    expect(sanitisePeriod(90)).toBe(90);
    expect(sanitisePeriod('14')).toBe(30);
    expect(sanitisePeriod(null)).toBe(30);
    expect(sanitisePeriod('abc')).toBe(30);
  });
  it('always fetches enough history for the 7-week trend', () => {
    expect(lookbackDays(7)).toBe(49);
    expect(lookbackDays(30)).toBe(49);
    expect(lookbackDays(90)).toBe(90);
  });
});

describe('weeklyBuckets', () => {
  it('returns TREND_WEEKS zeros for no data', () => {
    expect(weeklyBuckets([], NOW)).toEqual(new Array(TREND_WEEKS).fill(0));
  });
  it('puts now in the last bucket and the oldest edge in the first', () => {
    const out = weeklyBuckets([NOW, NOW - 1000, NOW - TREND_WEEKS * WEEK_MS + 1], NOW);
    expect(out[TREND_WEEKS - 1]).toBe(2);
    expect(out[0]).toBe(1);
  });
  it('ignores timestamps outside the window', () => {
    const out = weeklyBuckets([NOW - TREND_WEEKS * WEEK_MS - 1, NOW + 5], NOW);
    expect(out.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('shapeGame', () => {
  const rows: PlayRow[] = [
    { key: 'a', at: ago(1), done: true },
    { key: 'a', at: ago(2), done: false },
    { key: 'b', at: ago(1), done: true },
    { key: 'c', at: ago(40), done: true }, // outside a 30-day period, inside the trend
  ];

  it('counts plays, players and plays per player inside the period', () => {
    const s = shapeGame(def, rows, NOW, 30);
    expect(s.plays).toBe(3);
    expect(s.players).toBe(2);
    expect(s.perPlayer).toBe(1.5);
  });

  it('keeps older plays in the weekly trend even when the period is short', () => {
    const s = shapeGame(def, rows, NOW, 7);
    expect(s.plays).toBe(3);
    expect(s.weekly.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('computes finish rate only from rows that say whether they finished', () => {
    expect(shapeGame(def, rows, NOW, 30).finishRate).toBe(67);
    expect(shapeGame(def, rows.map(r => ({ key: r.key, at: r.at })), NOW, 30).finishRate).toBeNull();
  });

  it('counts repeat players by distinct Dhaka days', () => {
    const s = shapeGame(def, rows, NOW, 30);
    expect(s.repeatPlayers).toBe(50); // a played on two days, b on one
  });

  it('names the busiest Dhaka weekday', () => {
    const s = shapeGame(def, rows, NOW, 30);
    expect(s.busiestDay).toBe('Tuesday'); // two of three plays fall on 2026-10-13
  });

  it('is empty-safe', () => {
    const s = shapeGame({ ...def, quality: 'none' }, [], NOW, 30);
    expect(s).toMatchObject({ plays: 0, players: 0, perPlayer: null, finishRate: null, repeatPlayers: null, busiestDay: null });
    expect(s.weekly).toHaveLength(TREND_WEEKS);
  });
});

describe('rankGames', () => {
  it('orders by plays then name without mutating the input', () => {
    const mk = (label: string, plays: number) => ({ ...shapeGame({ ...def, label }, [], NOW, 30), plays });
    const input = [mk('Zap', 5), mk('Alpha', 5), mk('Big', 9)];
    expect(rankGames(input).map(g => g.label)).toEqual(['Big', 'Alpha', 'Zap']);
    expect(input[0].label).toBe('Zap');
  });
});

describe('shapeSets', () => {
  it('rounds the best-answer rate, flags sets under 60% and sorts by sessions', () => {
    const out = shapeSets([
      { setId: 'set-7', sessions: 96, decisions: 100, best: 58 },
      { setId: 'set-12', sessions: 312, decisions: 200, best: 182 },
      { setId: 'empty', sessions: 3, decisions: 0, best: 0 },
    ]);
    expect(out.map(s => s.setId)).toEqual(['set-12', 'set-7']);
    expect(out[0]).toMatchObject({ bestRate: 91, low: false });
    expect(out[1]).toMatchObject({ bestRate: 58, low: true });
  });
  it('respects the limit', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ setId: `s${i}`, sessions: i + 1, decisions: 10, best: 5 }));
    expect(shapeSets(rows, 5)).toHaveLength(5);
  });
});

describe('masterySplit', () => {
  it('groups edge statuses into mastered, learning and not started', () => {
    const m = masterySplit({ Mastered: 2, Fluent: 2, Reliable: 1, Distinguishing: 2, Exploring: 1, Unseen: 2 });
    expect(m).toMatchObject({ mastered: 4, learning: 4, notStarted: 2, total: 10 });
    expect(m.pct).toEqual({ mastered: 40, learning: 40, notStarted: 20 });
  });
  it('percentages add to 100 despite rounding', () => {
    const m = masterySplit({ Mastered: 1, Exploring: 1, Unseen: 1 });
    expect(m.pct.mastered + m.pct.learning + m.pct.notStarted).toBe(100);
  });
  it('treats unknown statuses as not started and handles empty input', () => {
    expect(masterySplit({ Weird: 3 }).notStarted).toBe(3);
    expect(masterySplit({})).toMatchObject({ total: 0, pct: { mastered: 0, learning: 0, notStarted: 0 } });
  });
});

describe('summariseLastWord', () => {
  it('derives rate and per-session figures, null when there is nothing', () => {
    expect(summariseLastWord({ sessions: 4, decisions: 50, best: 40, players: 3 })).toEqual({
      sessions: 4, decisions: 50, players: 3, bestRate: 80, decisionsPerSession: 12.5,
    });
    expect(summariseLastWord({ sessions: 0, decisions: 0, best: 0, players: 0 })).toMatchObject({ bestRate: null, decisionsPerSession: null });
  });
});
