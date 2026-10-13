/**
 * Pure helpers shared by Classes / Materials / Homework: month grouping (Dhaka
 * calendar), material sort + group, homework status, and per-user preference
 * persistence. No React, no DOM: unit-tested in group-sort.test.ts.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM' of an instant on the Dhaka calendar. */
export function monthKey(epochMs: number): string {
  const d = new Date(epochMs + DHAKA_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const name = MONTH_NAMES[Number(m) - 1];
  return name ? `${name} ${y}` : key;
}

export function currentMonthKey(now: number = Date.now()): string {
  return monthKey(now);
}

export interface MonthBucket<T> {
  key: string;
  label: string;
  items: T[];
}

/** Group by Dhaka month. Buckets and the items in them share one direction. */
export function groupByMonth<T>(
  items: readonly T[],
  getMs: (t: T) => number,
  newestFirst = true,
): MonthBucket<T>[] {
  const dir = newestFirst ? -1 : 1;
  const sorted = [...items].sort((a, b) => dir * (getMs(a) - getMs(b)));
  const buckets = new Map<string, MonthBucket<T>>();
  for (const it of sorted) {
    const key = monthKey(getMs(it));
    let b = buckets.get(key);
    if (!b) { b = { key, label: monthLabel(key), items: [] }; buckets.set(key, b); }
    b.items.push(it);
  }
  return [...buckets.values()];
}

/** Which month keys start open: the current month, or the newest if the current has no items. */
export function initialOpenMonths(keys: readonly string[], now: number = Date.now()): Set<string> {
  const cur = currentMonthKey(now);
  if (keys.includes(cur)) return new Set([cur]);
  const newest = [...keys].sort().pop();
  return new Set(newest ? [newest] : []);
}

// ─── Class status marks ───────────────────────────────────────────────────────

export interface ClassMarkSource {
  recallBotId?: string | null;
  recordingStatus?: string | null;
  materialCount?: number;
  homeworkCount?: number;
}

export interface ClassMarks {
  bot: boolean;
  rec: boolean;
  materials: number;
  homework: number;
  complete: boolean;
}

export function classMarks(c: ClassMarkSource): ClassMarks {
  const bot = Boolean(c.recallBotId);
  const rec = c.recordingStatus === 'available';
  const materials = c.materialCount ?? 0;
  const homework = c.homeworkCount ?? 0;
  return { bot, rec, materials, homework, complete: bot && rec && materials > 0 && homework > 0 };
}

// ─── Materials ────────────────────────────────────────────────────────────────

export const MATERIAL_SORTS = ['newest', 'oldest', 'name', 'size', 'type'] as const;
export type MaterialSort = (typeof MATERIAL_SORTS)[number];
export const MATERIAL_GROUPS = ['month', 'class', 'subject', 'none'] as const;
export type MaterialGroup = (typeof MATERIAL_GROUPS)[number];

export const MATERIAL_SORT_LABELS: Record<MaterialSort, string> = {
  newest: 'Newest', oldest: 'Oldest', name: 'Name A to Z', size: 'Size', type: 'Type',
};
export const MATERIAL_GROUP_LABELS: Record<MaterialGroup, string> = {
  month: 'Month', class: 'Class', subject: 'Subject', none: 'None',
};

export interface SortableMaterial {
  id: number;
  title: string;
  type: string;
  fileSize: number | null;
  createdAt: number;
}

export function sortMaterials<T extends SortableMaterial>(items: readonly T[], sort: MaterialSort): T[] {
  const byNewest = (a: T, b: T) => b.createdAt - a.createdAt || b.id - a.id;
  const cmp: Record<MaterialSort, (a: T, b: T) => number> = {
    newest: byNewest,
    oldest: (a, b) => a.createdAt - b.createdAt || a.id - b.id,
    name: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }) || byNewest(a, b),
    size: (a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0) || byNewest(a, b),
    type: (a, b) => a.type.localeCompare(b.type) || byNewest(a, b),
  };
  return [...items].sort(cmp[sort]);
}

export interface Group<T> {
  key: string;
  label: string;
  items: T[];
}

/** Group already-sorted items by an arbitrary key, keeping first-seen order. */
export function groupInOrder<T>(
  items: readonly T[],
  keyOf: (t: T) => { key: string; label: string },
): Group<T>[] {
  const out = new Map<string, Group<T>>();
  for (const it of items) {
    const { key, label } = keyOf(it);
    let g = out.get(key);
    if (!g) { g = { key, label, items: [] }; out.set(key, g); }
    g.items.push(it);
  }
  return [...out.values()];
}

// ─── Homework ─────────────────────────────────────────────────────────────────

export type HomeworkStatus = 'review' | 'open' | 'closed';

export interface HomeworkCounts {
  dueAt: number;
  submittedCount?: number;
  reviewedCount?: number;
  scopeCount?: number;
}

export interface SubmissionShape {
  reviewed: number;
  waiting: number;
  missing: number;
  total: number;
}

export function submissionShape(a: HomeworkCounts): SubmissionShape {
  const submitted = a.submittedCount ?? 0;
  const reviewed = Math.min(a.reviewedCount ?? 0, submitted);
  const total = Math.max(a.scopeCount ?? 0, submitted);
  return { reviewed, waiting: submitted - reviewed, missing: total - submitted, total };
}

/** To review = anything waiting; else Open until due; else Closed. */
export function homeworkStatus(a: HomeworkCounts, now: number = Date.now()): HomeworkStatus {
  if (submissionShape(a).waiting > 0) return 'review';
  return a.dueAt > now ? 'open' : 'closed';
}

// ─── Per-user preferences (localStorage, always guarded) ──────────────────────

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readPref<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
  storage: StorageLike | null = browserStorage(),
): T {
  try {
    const v = storage?.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: string, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* blocked or full: the preference simply does not persist */
  }
}
