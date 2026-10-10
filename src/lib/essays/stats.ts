/**
 * Pure scoring helpers for Essays — no DB, unit-tested.
 */

import type { EssayHistogramBin, EssaySection, EssayStats } from './types';

export const LOCK_MINUTES = 10;

/** Marks are entered in half-mark steps. */
export function isValidMark(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max && Math.round(v * 2) === v * 2;
}

export function parseSections(json: string): EssaySection[] {
  try {
    const raw = JSON.parse(json);
    return Array.isArray(raw) ? (raw as EssaySection[]) : [];
  } catch {
    return [];
  }
}

/**
 * Validates section definitions from the series editor. Keys are derived
 * server-side when missing so they stay stable across renames.
 */
export function normalizeSections(raw: unknown): EssaySection[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null;
  const seen = new Set<string>();
  const out: EssaySection[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] as Record<string, unknown>;
    const name = typeof s?.name === 'string' ? s.name.trim() : '';
    const max = s?.max;
    if (!name || name.length > 80) return null;
    if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0 || max > 1000 || Math.round(max * 2) !== max * 2) return null;
    let key = typeof s.key === 'string' && /^[a-z0-9_]{1,40}$/.test(s.key) ? s.key : `s${i + 1}`;
    while (seen.has(key)) key = `${key}_`;
    seen.add(key);
    out.push({ key, name, max });
  }
  return out;
}

export function sectionsTotal(sections: EssaySection[]): number {
  return sections.reduce((sum, s) => sum + s.max, 0);
}

export type MarksMap = Record<string, number | null>;

/** Keeps only known section keys; values must be valid marks or null. Returns null when any value is invalid. */
export function cleanMarks(raw: unknown, sections: EssaySection[]): MarksMap | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out: MarksMap = {};
  for (const s of sections) {
    const v = src[s.key];
    if (v === null || v === undefined || v === '') { out[s.key] = null; continue; }
    if (!isValidMark(v, s.max)) return null;
    out[s.key] = v;
  }
  return out;
}

/** Sum of marks when every section has a mark, else null. */
export function completeTotal(marks: MarksMap, sections: EssaySection[]): number | null {
  let total = 0;
  for (const s of sections) {
    const v = marks[s.key];
    if (typeof v !== 'number') return null;
    total += v;
  }
  return total;
}

export function binWidthFor(max: number): number {
  if (max <= 0) return 1;
  if (max <= 20) return 1;
  return Math.ceil(max / 20);
}

export function histogram(values: number[], max: number): EssayHistogramBin[] {
  const width = binWidthFor(max);
  const bins: EssayHistogramBin[] = [];
  for (let from = 0; from < max; from += width) {
    bins.push({ from, to: Math.min(max, from + width), count: 0 });
  }
  if (bins.length === 0) bins.push({ from: 0, to: max, count: 0 });
  for (const v of values) {
    const i = Math.min(bins.length - 1, Math.max(0, Math.floor(v / width)));
    bins[i].count += 1;
  }
  return bins;
}

export function computeStats(values: number[], max: number): EssayStats {
  if (values.length === 0) {
    return { count: 0, average: null, highest: null, lowest: null, histogram: histogram([], max) };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    average: Math.round((sum / values.length) * 100) / 100,
    highest: Math.max(...values),
    lowest: Math.min(...values),
    histogram: histogram(values, max),
  };
}

/**
 * Whether a series is ready to auto-publish: the deadline has passed, at least
 * one script came in, and none is still waiting to be marked.
 */
export function isReadyToPublish(args: {
  deadline: Date;
  now: Date;
  publishedAt: Date | null;
  statuses: string[];
}): boolean {
  if (args.publishedAt) return false;
  if (args.deadline.getTime() > args.now.getTime()) return false;
  if (args.statuses.length === 0) return false;
  return args.statuses.every(s => s === 'graded' || s === 'rejected');
}
