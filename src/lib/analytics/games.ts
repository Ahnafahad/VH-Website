/**
 * Statistics > Games: pure shaping logic (no database, no React).
 * `queries.ts` fetches raw rows; everything that turns rows into numbers lives here so it can be unit-tested.
 */

import { dhakaDayString } from '@/lib/vocab/dhaka-time';

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;
export const TREND_WEEKS = 7;

export type GamePeriod = 7 | 30 | 90;
export const GAME_PERIODS: readonly GamePeriod[] = [7, 30, 90];

/** exact: the game writes its own table. estimated: counted from feature-tracker events. none: nothing recorded. */
export type DataQuality = 'exact' | 'estimated' | 'none';

export interface PlayRow {
  /** Stable player identity (user id, or anonymous id for tracker events). */
  key: string;
  /** Epoch ms of the play. */
  at: number;
  /** True when the play reached its end. Omit when the source cannot say. */
  done?: boolean;
}

export interface GameDef {
  id: string;
  label: string;
  quality: DataQuality;
  /** One line shown in the row detail: where the number comes from. */
  source: string;
}

export interface GameStat {
  id: string;
  label: string;
  quality: DataQuality;
  source: string;
  plays: number;
  players: number;
  /** null when there are no players. */
  perPlayer: number | null;
  /** Plays per week, oldest first, always TREND_WEEKS long. */
  weekly: number[];
  /** Share of plays that finished, 0-100, null when the source has no finished flag. */
  finishRate: number | null;
  /** Share of players who played on two or more days, 0-100, null with no players. */
  repeatPlayers: number | null;
  /** Dhaka weekday with most plays, null with no plays. */
  busiestDay: string | null;
}

export function sanitisePeriod(value: unknown): GamePeriod {
  const n = Number(value);
  return (GAME_PERIODS as readonly number[]).includes(n) ? (n as GamePeriod) : 30;
}

/** Days of history a query must fetch so both the period totals and the 7-week trend are covered. */
export function lookbackDays(period: GamePeriod): number {
  return Math.max(period, TREND_WEEKS * 7);
}

/** Counts per rolling week ending at `now`, oldest first. Timestamps outside the window are ignored. */
export function weeklyBuckets(times: readonly number[], now: number, weeks = TREND_WEEKS): number[] {
  const out = new Array<number>(weeks).fill(0);
  const start = now - weeks * WEEK_MS;
  for (const t of times) {
    if (t < start || t > now) continue;
    const idx = Math.min(weeks - 1, Math.floor((t - start) / WEEK_MS));
    out[idx]++;
  }
  return out;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Weekday name of a Dhaka calendar day string ("YYYY-MM-DD"). */
function weekdayOf(day: string): string {
  return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
}

const pct = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 100) : null);

/** Turns raw play rows into one game's scoreboard line. Rows older than the period still feed the trend. */
export function shapeGame(def: GameDef, rows: readonly PlayRow[], now: number, period: GamePeriod): GameStat {
  const since = now - period * DAY_MS;
  const inPeriod = rows.filter(r => r.at >= since && r.at <= now);
  const players = new Set(inPeriod.map(r => r.key));

  const daysByPlayer = new Map<string, Set<string>>();
  const dayCounts = new Map<string, number>();
  for (const r of inPeriod) {
    const day = dhakaDayString(new Date(r.at));
    if (!daysByPlayer.has(r.key)) daysByPlayer.set(r.key, new Set());
    daysByPlayer.get(r.key)!.add(day);
    const weekday = weekdayOf(day);
    dayCounts.set(weekday, (dayCounts.get(weekday) ?? 0) + 1);
  }
  let repeaters = 0;
  for (const days of daysByPlayer.values()) if (days.size >= 2) repeaters++;

  let busiestDay: string | null = null;
  let best = 0;
  for (const [day, n] of dayCounts) {
    if (n > best) { best = n; busiestDay = day; }
  }

  const known = inPeriod.filter(r => r.done !== undefined);
  return {
    id: def.id,
    label: def.label,
    quality: def.quality,
    source: def.source,
    plays: inPeriod.length,
    players: players.size,
    perPlayer: players.size > 0 ? Math.round((inPeriod.length / players.size) * 10) / 10 : null,
    weekly: weeklyBuckets(rows.map(r => r.at), now),
    finishRate: known.length > 0 ? pct(known.filter(r => r.done).length, known.length) : null,
    repeatPlayers: pct(repeaters, players.size),
    busiestDay,
  };
}

/** The scoreboard ranks games by plays, then name, so equal games keep a stable order. */
export function rankGames(stats: readonly GameStat[]): GameStat[] {
  return [...stats].sort((a, b) => b.plays - a.plays || a.label.localeCompare(b.label));
}

// ─── Last Word ────────────────────────────────────────────────────────────────

export interface SetRow {
  setId: string;
  sessions: number;
  decisions: number;
  best: number;
}

export interface SetStat {
  setId: string;
  sessions: number;
  decisions: number;
  /** Share of decisions where the best answer was chosen, 0-100. */
  bestRate: number;
  /** Below the 60% line: flagged in the chart. */
  low: boolean;
}

export const LOW_ACCURACY_LINE = 60;

/** Busiest sets first. Sets with no decisions are dropped. */
export function shapeSets(rows: readonly SetRow[], limit = 12): SetStat[] {
  return rows
    .filter(r => r.decisions > 0)
    .map(r => {
      const bestRate = Math.round((r.best / r.decisions) * 100);
      return { setId: r.setId, sessions: r.sessions, decisions: r.decisions, bestRate, low: bestRate < LOW_ACCURACY_LINE };
    })
    .sort((a, b) => b.sessions - a.sessions || b.decisions - a.decisions || a.setId.localeCompare(b.setId))
    .slice(0, limit);
}

export interface MasterySplit {
  mastered: number;
  learning: number;
  notStarted: number;
  total: number;
  /** Whole-number percentages that always add to 100 (or all 0 when empty). */
  pct: { mastered: number; learning: number; notStarted: number };
}

/** Maps EdgeMastery.status counts onto three buckets. Unknown statuses count as not started. */
export function masterySplit(statusCounts: Readonly<Record<string, number>>): MasterySplit {
  let mastered = 0;
  let learning = 0;
  let notStarted = 0;
  for (const [status, n] of Object.entries(statusCounts)) {
    if (status === 'Fluent' || status === 'Mastered') mastered += n;
    else if (status === 'Exploring' || status === 'Distinguishing' || status === 'Reliable') learning += n;
    else notStarted += n;
  }
  const total = mastered + learning + notStarted;
  if (total === 0) return { mastered, learning, notStarted, total, pct: { mastered: 0, learning: 0, notStarted: 0 } };
  const m = Math.round((mastered / total) * 100);
  const l = Math.round((learning / total) * 100);
  return { mastered, learning, notStarted, total, pct: { mastered: m, learning: l, notStarted: Math.max(0, 100 - m - l) } };
}

export interface LastWordTotals {
  sessions: number;
  decisions: number;
  best: number;
  players: number;
}

export interface LastWordSummary {
  sessions: number;
  decisions: number;
  players: number;
  bestRate: number | null;
  decisionsPerSession: number | null;
}

export function summariseLastWord(t: LastWordTotals): LastWordSummary {
  return {
    sessions: t.sessions,
    decisions: t.decisions,
    players: t.players,
    bestRate: pct(t.best, t.decisions),
    decisionsPerSession: t.sessions > 0 ? Math.round((t.decisions / t.sessions) * 10) / 10 : null,
  };
}
