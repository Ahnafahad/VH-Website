/**
 * Window state + attempt deadline helpers for the online tests module.
 */

import type { TestWindow, TestAttempt, Test } from '@/lib/db/schema';

export type EffectiveWindowState = 'upcoming' | 'open' | 'closed';

/**
 * 'closed' status always wins; 'open' forces open until closesAt;
 * 'scheduled' follows opensAt/closesAt automatically.
 */
export function effectiveWindowState(w: TestWindow, now: Date = new Date()): EffectiveWindowState {
  if (w.status === 'closed') return 'closed';
  if (now > w.closesAt) return 'closed';
  if (w.status === 'open') return 'open';
  return now >= w.opensAt ? 'open' : 'upcoming';
}

/**
 * Hard deadline for an in-progress attempt.
 * Online: startedAt + durationMinutes, capped at the window close.
 * Offline: the window close itself (the window IS the entry slot).
 */
export function attemptDeadline(attempt: TestAttempt, window: TestWindow): Date {
  if (attempt.mode === 'online' && window.durationMinutes != null) {
    const byDuration = new Date(attempt.startedAt.getTime() + window.durationMinutes * 60_000);
    return byDuration < window.closesAt ? byDuration : window.closesAt;
  }
  return window.closesAt;
}

/** Results are visible once force-published, or once every window has closed. */
export function resultsVisible(test: Test, windows: TestWindow[], now: Date = new Date()): boolean {
  if (test.resultsPublishedAt != null) return true;
  if (windows.length === 0) return false;
  return windows.every(w => effectiveWindowState(w, now) === 'closed');
}
