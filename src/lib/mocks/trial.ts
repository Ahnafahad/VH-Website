/**
 * Open trial of BTH Mock 1 on 2026-11-04 (Dhaka): any signed-in user can sit it (online or offline entry) and is
 * ranked with the cohort. Everyone who had not started Mock 1 before the trial gets these windows instead of the
 * real 2026-11-02 ones (lib/tests/window-overrides.ts); the cohort keeps theirs, so their results stay visible.
 * Pure — no DB. Delete this file and its call sites once the trial is over.
 */

export const MOCK_TRIAL = {
  testId: 29,
  essaySeriesId: 5,
  // Window id → trial times (Dhaka = UTC+6): 12:00 → online 15:00 (2 h each), offline entry 14:30.
  windows: {
    60: { opensAt: new Date('2026-11-04T06:00:00Z'), closesAt: new Date('2026-11-04T09:00:00Z'), durationMinutes: 120 },
    61: { opensAt: new Date('2026-11-04T06:00:00Z'), closesAt: new Date('2026-11-04T08:30:00Z'), durationMinutes: 120 },
  } as Record<number, { opensAt: Date; closesAt: Date; durationMinutes: number }>,
  essayDeadline: new Date('2026-11-04T09:10:00Z'), // 10 min after the online close, for essay photos
  startsAt: new Date('2026-11-04T06:00:00Z'),
  tileFrom: new Date('2026-11-03T18:00:00Z'),      // Mocks dashboard tile for everyone: 2026-11-04 Dhaka only
  tileUntil: new Date('2026-11-04T18:00:00Z'),
  accessUntil: new Date('2026-12-31T18:00:00Z'),   // trial sitters can keep opening their Mock 1 results
};

/** Anyone signed in may open Mock 1 (and its essays) — from the day before, so walk-ins can sign up early. */
export function inMockTrialAccess(now: Date = new Date()): boolean {
  return now >= MOCK_TRIAL.tileFrom && now < MOCK_TRIAL.accessUntil;
}

export function inMockTrialDay(now: Date = new Date()): boolean {
  return now >= MOCK_TRIAL.tileFrom && now < MOCK_TRIAL.tileUntil;
}
