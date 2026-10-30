/**
 * Pure scheduling rules for 1-on-1 session requests. No DB, no I/O — the API
 * routes call these and translate a returned message into an ApiException.
 *
 * All times are epoch milliseconds.
 */

import type { SessionRequestStatus } from '@/lib/db/schema';

export const MIN_LEAD_MS = 60 * 60_000;            // times must be >= 1h away
export const MAX_AHEAD_MS = 90 * 24 * 3_600_000;   // ...and within 90 days
export const MAX_OPTIONS = 4;
export const CANCEL_CUTOFF_MS = 2 * 3_600_000;     // students can't cancel inside 2h

/** An instructor offer: a specific start (no endAt) or a range the student picks from. */
export interface Proposal {
  startAt: number;
  endAt?: number;
}

export function parsePreferredTimes(json: string): number[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : [];
  } catch {
    return [];
  }
}

export function parseProposals(json: string): Proposal[] {
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    const out: Proposal[] = [];
    for (const p of v) {
      if (!p || typeof p !== 'object') continue;
      const { startAt, endAt } = p as { startAt?: unknown; endAt?: unknown };
      if (typeof startAt !== 'number' || !Number.isFinite(startAt)) continue;
      if (typeof endAt === 'number' && Number.isFinite(endAt)) out.push({ startAt, endAt });
      else out.push({ startAt });
    }
    return out;
  } catch {
    return [];
  }
}

function checkStart(t: unknown, now: number): string | null {
  if (typeof t !== 'number' || !Number.isFinite(t)) return 'Each time must be a valid date and time.';
  if (t < now + MIN_LEAD_MS) return 'Times must be at least 1 hour from now.';
  if (t > now + MAX_AHEAD_MS) return 'Times must be within the next 90 days.';
  return null;
}

/** Student's offered start times. Returns an error message, or null when valid. */
export function validatePreferredTimes(times: unknown[], now: number): string | null {
  if (times.length === 0) return 'Give at least one preferred time.';
  if (times.length > MAX_OPTIONS) return `Give at most ${MAX_OPTIONS} preferred times.`;
  for (const t of times) {
    const err = checkStart(t, now);
    if (err) return err;
  }
  if (new Set(times).size !== times.length) return 'Remove the duplicate times.';
  return null;
}

/** Instructor's counter-offers. Returns an error message, or null when valid. */
export function validateProposals(proposals: Proposal[], durationMinutes: number, now: number): string | null {
  if (proposals.length === 0) return 'Propose at least one time or range.';
  if (proposals.length > MAX_OPTIONS) return `Propose at most ${MAX_OPTIONS} options.`;
  for (const p of proposals) {
    const err = checkStart(p.startAt, now);
    if (err) return err;
    if (p.endAt !== undefined) {
      if (!Number.isFinite(p.endAt) || p.endAt - p.startAt < durationMinutes * 60_000) {
        return 'A range is shorter than the session length.';
      }
    }
  }
  return null;
}

/** Is `startAt` one of the offered times, or inside an offered range with room for the whole session? */
export function isStartAllowed(startAt: number, options: Array<Proposal | number>, durationMs: number): boolean {
  return options.some((o) => {
    const p: Proposal = typeof o === 'number' ? { startAt: o } : o;
    if (p.endAt === undefined) return p.startAt === startAt;
    return startAt >= p.startAt && startAt + durationMs <= p.endAt;
  });
}

/** Half-open interval overlap: back-to-back sessions do not overlap. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Final mode of a session. The student's preference is binding unless it was
 * 'either', in which case the instructor must choose. Offline needs a location.
 */
export function resolveMode(
  preferred: string,
  chosen: unknown,
  location: unknown,
): { mode: 'online' | 'offline'; location: string | null } | { error: string } {
  let mode: 'online' | 'offline';
  if (preferred === 'online' || preferred === 'offline') mode = preferred;
  else if (chosen === 'online' || chosen === 'offline') mode = chosen;
  else return { error: 'Choose online or offline for this session.' };

  const loc = typeof location === 'string' ? location.trim() : '';
  if (mode === 'offline' && !loc) return { error: 'Give the location for an in-person session.' };
  return { mode, location: mode === 'offline' ? loc : null };
}

/** A student answering an instructor's counter with different times puts the request back to 'pending'. */
export function nextStatusAfterStudentCounter(current: SessionRequestStatus): SessionRequestStatus | null {
  return current === 'proposed' ? 'pending' : null;
}
