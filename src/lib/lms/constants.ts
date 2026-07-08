// ─── LMS Constants ────────────────────────────────────────────────────────────

export const LMS_SUBJECTS = ['english', 'math', 'analytical', 'tbd'] as const;

/** Minutes before scheduledAt when the Join button becomes active */
export const JOIN_WINDOW_EARLY_MINUTES = 15;

/** Minutes after (scheduledAt + durationMinutes) when the Join button closes */
export const JOIN_WINDOW_LATE_MINUTES = 30;

/**
 * Number of subsequent completed classes of the same subject+batch that must
 * pass before a recording's watch window expires.
 */
export const RECORDING_EXPIRY_CLASS_COUNT = 2;

/** How many days ahead the session generator materialises sessions */
export const SCHEDULE_GENERATOR_DAYS_AHEAD = 14;

/** ±window (hours) used by the generator's idempotency check */
export const SCHEDULE_GENERATOR_DEDUP_HOURS = 12;

/** Dhaka is UTC+6 with no DST */
export const DHAKA_OFFSET_HOURS = 6;
