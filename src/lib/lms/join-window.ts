// ─── Join-Window — Algorithm C ────────────────────────────────────────────────
// Open from 15 min before scheduledAt until scheduledAt + durationMinutes + 30 min.
// Used both on the dashboard (display) and in the join API (server-side re-check).

import { JOIN_WINDOW_EARLY_MINUTES, JOIN_WINDOW_LATE_MINUTES } from './constants';

export interface SessionWindow {
  scheduledAt: Date;
  durationMinutes: number;
}

/**
 * Returns true when `now` is within the join window for `session`.
 *
 * Window: [scheduledAt − 15 min, scheduledAt + durationMinutes + 30 min]
 * Both boundaries are inclusive.
 */
export function isJoinOpen(session: SessionWindow, now: Date): boolean {
  const windowStart = new Date(
    session.scheduledAt.getTime() - JOIN_WINDOW_EARLY_MINUTES * 60_000,
  );
  const windowEnd = new Date(
    session.scheduledAt.getTime() +
      (session.durationMinutes + JOIN_WINDOW_LATE_MINUTES) * 60_000,
  );

  return now >= windowStart && now <= windowEnd;
}
