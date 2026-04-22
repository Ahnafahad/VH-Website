import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub out @/lib/db so the module doesn't try to create a real libsql client
// during test eval. The helper accepts an injected runner, so the top-level
// `db` is never actually used in this test.
vi.mock('@/lib/db', () => ({
  db: {},
  vocabUserProgress: {},
}));

import { ensureDailyLoginAwarded, DAILY_LOGIN_POINTS } from '../daily-login';

interface ProgressRow {
  lastStudyDate: Date | null;
  totalPoints:   number;
  streakDays:    number;
  longestStreak: number;
}

/**
 * Minimal in-memory fake of the subset of drizzle used by ensureDailyLoginAwarded.
 * Matches the chain: runner.select({...}).from(table).where(...).limit(1) → [row]
 * and              runner.update(table).set({...}).where(...).
 *
 * The helper never inspects `table`, so we just pass it through.
 */
function makeFakeDb(initial: ProgressRow | null) {
  const state: { row: ProgressRow | null; lastUpdate: Record<string, unknown> | null } = {
    row: initial ? { ...initial } : null,
    lastUpdate: null,
  };

  const selectChain = () => ({
    from: (_t: unknown) => ({
      where: (_w: unknown) => ({
        limit: async (_n: number) => (state.row ? [{ ...state.row }] : []),
      }),
    }),
  });

  const updateChain = () => ({
    set: (patch: Record<string, unknown>) => ({
      where: async (_w: unknown) => {
        state.lastUpdate = patch;
        // Apply scalar fields so consecutive helper calls inside a test see new state.
        if (state.row) {
          if (typeof patch.streakDays    === 'number') state.row.streakDays    = patch.streakDays;
          if (typeof patch.longestStreak === 'number') state.row.longestStreak = patch.longestStreak;
          if (patch.lastStudyDate instanceof Date)    state.row.lastStudyDate = patch.lastStudyDate;
          // totalPoints is an sql`total_points + N` — simulate numerically.
          state.row.totalPoints += DAILY_LOGIN_POINTS;
        }
      },
    }),
  });

  const runner = {
    select: () => selectChain(),
    update: (_t: unknown) => updateChain(),
  } as unknown as Parameters<typeof ensureDailyLoginAwarded>[2];

  return { runner, state };
}

describe('ensureDailyLoginAwarded', () => {
  let userId: number;

  beforeEach(() => {
    userId = 42;
  });

  it('returns awarded=false when no progress row exists', async () => {
    const { runner, state } = makeFakeDb(null);
    const res = await ensureDailyLoginAwarded(userId, new Date('2026-04-22T12:00:00Z'), runner);
    expect(res.awarded).toBe(false);
    expect(state.lastUpdate).toBeNull();
  });

  it('awards +5 and starts streak=1 on first study ever', async () => {
    const { runner, state } = makeFakeDb({
      lastStudyDate: null, totalPoints: 0, streakDays: 0, longestStreak: 0,
    });
    const res = await ensureDailyLoginAwarded(userId, new Date('2026-04-22T12:00:00Z'), runner);
    expect(res.awarded).toBe(true);
    expect(res.streakDays).toBe(1);
    expect(res.longestStreak).toBe(1);
    expect(state.lastUpdate).not.toBeNull();
  });

  it('is idempotent within the same calendar day', async () => {
    const now = new Date('2026-04-22T12:00:00Z');
    const { runner } = makeFakeDb({
      lastStudyDate: new Date('2026-04-22T01:00:00Z'),
      totalPoints: 100, streakDays: 3, longestStreak: 5,
    });
    const res = await ensureDailyLoginAwarded(userId, now, runner);
    expect(res.awarded).toBe(false);
    expect(res.streakDays).toBe(3);
    expect(res.longestStreak).toBe(5);
  });

  it('advances streak +1 when last study was yesterday', async () => {
    const now = new Date('2026-04-22T12:00:00Z');
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const { runner } = makeFakeDb({
      lastStudyDate: yesterday,
      totalPoints: 100, streakDays: 4, longestStreak: 7,
    });
    const res = await ensureDailyLoginAwarded(userId, now, runner);
    expect(res.awarded).toBe(true);
    expect(res.streakDays).toBe(5);
    expect(res.longestStreak).toBe(7);
  });

  it('resets streak to 1 after a gap > 1 day', async () => {
    const now = new Date('2026-04-22T12:00:00Z');
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { runner } = makeFakeDb({
      lastStudyDate: threeDaysAgo,
      totalPoints: 100, streakDays: 10, longestStreak: 12,
    });
    const res = await ensureDailyLoginAwarded(userId, now, runner);
    expect(res.awarded).toBe(true);
    expect(res.streakDays).toBe(1);
    expect(res.longestStreak).toBe(12);
  });

  it('longestStreak is monotonic (watermark)', async () => {
    const now = new Date('2026-04-22T12:00:00Z');
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const { runner } = makeFakeDb({
      lastStudyDate: yesterday,
      totalPoints: 0, streakDays: 10, longestStreak: 10,
    });
    const res = await ensureDailyLoginAwarded(userId, now, runner);
    expect(res.streakDays).toBe(11);
    expect(res.longestStreak).toBe(11);
  });
});
