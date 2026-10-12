/**
 * Pure scoring helpers for Essays — no DB, unit-tested.
 */

import type { EssayPrompt } from './prompts';
import type { EssayHistogramBin, EssaySection, EssayStats } from './types';

export const LOCK_MINUTES = 10;

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

/** LEGACY per-section marks (pre-2026-10-12) — only read, never written. */
export type MarksMap = Record<string, number | null>;

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

export type EssayIndexStats = EssayStats & { essayIndex: number; max: number };

/** Stats per essay number, each on that essay's own scale (essays can have different maxima). */
export function statsByEssay(graded: { essayIndex: number; total: number | null }[], essays: EssayPrompt[]): EssayIndexStats[] {
  return essays.map((e, i) => ({
    essayIndex: i + 1,
    max: e.max,
    ...computeStats(graded.filter(g => g.essayIndex === i + 1).map(g => g.total ?? 0), e.max),
  }));
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
