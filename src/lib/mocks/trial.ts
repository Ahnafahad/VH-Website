/**
 * Open trial of BTH Mock 4 (2026-11-12, Dhaka): any signed-in user can sit it on its real windows and essays and is
 * ranked with everyone else. Users without Mock Access see only this mock (canAccessTest). Pure — no DB.
 * Delete this file and its call sites once the trial is over.
 */

export const MOCK_TRIAL = {
  testId: 33,
  essaySeriesId: 9,
  startsAt: new Date('2026-11-12T05:30:00Z'),     // 11:30 Dhaka: essay prompts stay hidden from walk-ins until then
  from: new Date('2026-11-10T18:00:00Z'),         // 2026-11-11 Dhaka, so walk-ins can sign up early
  accessUntil: new Date('2026-12-31T18:00:00Z'),  // trial sitters can keep opening their Mock 4 results
};

/** Anyone signed in may open Mock 4 (and its essays). */
export function inMockTrialAccess(now: Date = new Date()): boolean {
  return now >= MOCK_TRIAL.from && now < MOCK_TRIAL.accessUntil;
}
