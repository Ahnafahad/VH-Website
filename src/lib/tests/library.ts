/**
 * Pure helpers for the admin Tests library and the per-test page: category
 * grouping, score stats, histogram binning, marking-rule label. No DB, no React.
 */

import { average, median } from './analytics';

/** Label for tests whose `category` is null. Reserved: it can't be used as a real category name. */
export const UNSORTED = 'Unsorted';

/** Pass line, as a percentage of total marks (tests carry no pass mark of their own). */
export const PASS_PERCENT = 40;

export const CATEGORY_MAX_LENGTH = 60;

/**
 * Normalise a user-typed category: trim, collapse inner whitespace. Empty
 * string and the reserved "Unsorted" mean "no category" (null).
 */
export function normalizeCategory(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const c = raw.trim().replace(/\s+/g, ' ');
  if (c === '' || c.toLowerCase() === UNSORTED.toLowerCase()) return null;
  return c;
}

/**
 * Suggested category from a test's title, used by the "Sort unsorted" button.
 * "Week N ..." tests are the vocabulary quizzes; everything else is named after its
 * subject. Returns null when nothing matches, so the test stays Unsorted.
 */
const CATEGORY_RULES: [RegExp, string][] = [
  [/^\s*week\s*\d+/i, 'Vocabulary Quizzes'],
  [/vocab/i, 'Vocabulary Quizzes'],
  [/english|reading|comprehension|grammar/i, 'English Tests'],
  [/analytical|logic|puzzle/i, 'Analytical Tests'],
  [/math|algebra|geometry/i, 'Maths Tests'],
  [/accounting/i, 'Accounting Tests'],
  [/business/i, 'Business Studies Tests'],
  [/economics/i, 'Economics Tests'],
  [/finance/i, 'Finance Tests'],
  [/diagnostic/i, 'Diagnostics'],
  [/mock/i, 'Mock Tests'],
];

export function inferCategory(title: string): string | null {
  for (const [re, category] of CATEGORY_RULES) if (re.test(title)) return category;
  return null;
}

export interface CategoryGroup<T> {
  /** Category name, or null for Unsorted. */
  category: string | null;
  label: string;
  tests: T[];
}

/**
 * Group tests by category. Named categories sort alphabetically (case-insensitive),
 * Unsorted goes last. `extraCategories` adds empty groups (a category just created
 * in the UI that has no tests yet). Within a group the incoming order is kept.
 */
export function groupByCategory<T extends { category: string | null }>(
  tests: T[],
  extraCategories: string[] = [],
): CategoryGroup<T>[] {
  const map = new Map<string, T[]>();
  const keyOf = (c: string | null) => normalizeCategory(c);
  for (const extra of extraCategories) {
    const k = keyOf(extra);
    if (k && !map.has(k)) map.set(k, []);
  }
  const unsorted: T[] = [];
  for (const t of tests) {
    const k = keyOf(t.category);
    if (k === null) { unsorted.push(t); continue; }
    const list = map.get(k);
    if (list) list.push(t); else map.set(k, [t]);
  }
  const named = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
    .map(([category, list]) => ({ category, label: category, tests: list }));
  return [...named, { category: null, label: UNSORTED, tests: unsorted }];
}

// ─── Score stats ─────────────────────────────────────────────────────────────

export interface TestScoreStats {
  count: number;
  /** Mean score as % of total marks. */
  averagePct: number;
  /** Median raw score (marks). */
  medianScore: number;
  /** Highest raw score (marks). */
  topScore: number;
  /** % of submitted attempts at or above the pass line. */
  passRate: number;
}

function pct(score: number, totalMarks: number): number {
  return totalMarks > 0 ? (score / totalMarks) * 100 : 0;
}

/** Stats over submitted-attempt scores. Null when there are none. */
export function computeScoreStats(
  scores: number[],
  totalMarks: number,
  passPercent: number = PASS_PERCENT,
): TestScoreStats | null {
  if (scores.length === 0) return null;
  const passed = scores.filter(s => pct(s, totalMarks) >= passPercent).length;
  return {
    count: scores.length,
    averagePct: Math.round(pct(average(scores), totalMarks) * 10) / 10,
    medianScore: median(scores),
    topScore: Math.max(...scores),
    passRate: Math.round((passed / scores.length) * 1000) / 10,
  };
}

export interface Histogram {
  /** Count per bin, bin 0 = lowest scores (negative scores are clamped into it). */
  bins: number[];
  /** Width of each bin as % of total marks (100 / bins.length). */
  binWidthPct: number;
  /** Index of the bin containing the pass line. */
  passBin: number;
  max: number;
}

/** Bin scores (as % of total marks) into `binCount` equal buckets; 100% lands in the last bin. */
export function buildHistogram(
  scores: number[],
  totalMarks: number,
  binCount = 20,
  passPercent: number = PASS_PERCENT,
): Histogram {
  const bins = new Array<number>(binCount).fill(0);
  const width = 100 / binCount;
  const binOf = (p: number) => Math.min(binCount - 1, Math.max(0, Math.floor(p / width)));
  for (const s of scores) bins[binOf(pct(s, totalMarks))] += 1;
  return {
    bins,
    binWidthPct: width,
    passBin: binOf(passPercent),
    max: Math.max(0, ...bins),
  };
}

// ─── Marking rule ────────────────────────────────────────────────────────────

const fmtNum = (n: number) => String(Math.round(n * 100) / 100);

/**
 * One-line marking rule from a test's sections, e.g. "+1 / −0.25 per question".
 * Null when there are no sections; "Mixed (per section)" when sections differ.
 */
export function markingRuleLabel(
  sections: Array<{ marksPerCorrect: number; penaltyPerWrong: number }>,
): string | null {
  if (sections.length === 0) return null;
  const first = sections[0];
  const same = sections.every(
    s => s.marksPerCorrect === first.marksPerCorrect && s.penaltyPerWrong === first.penaltyPerWrong,
  );
  if (!same) return 'Mixed (per section)';
  const plus = `+${fmtNum(first.marksPerCorrect)}`;
  return first.penaltyPerWrong > 0
    ? `${plus} / −${fmtNum(first.penaltyPerWrong)} per question`
    : `${plus}, no penalty`;
}

// ─── Window summary ──────────────────────────────────────────────────────────

export interface WindowLike {
  mode: string;
  opensAt: number;
  closesAt: number;
  state: 'upcoming' | 'open' | 'closed';
}

/**
 * The window of `mode` worth showing in a one-line row: the open one, else the
 * soonest upcoming, else the most recent closed. Null when the test has none.
 */
export function pickWindow<W extends WindowLike>(windows: W[], mode: 'online' | 'offline'): W | null {
  const mine = windows.filter(w => w.mode === mode);
  const open = mine.find(w => w.state === 'open');
  if (open) return open;
  const upcoming = mine.filter(w => w.state === 'upcoming').sort((a, b) => a.opensAt - b.opensAt)[0];
  if (upcoming) return upcoming;
  return mine.filter(w => w.state === 'closed').sort((a, b) => b.closesAt - a.closesAt)[0] ?? null;
}
