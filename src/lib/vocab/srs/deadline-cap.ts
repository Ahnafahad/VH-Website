/**
 * Compute the maximum SRS interval (in days) for a user based on their deadline.
 *
 * Rules:
 *   - Deadline in the future → cap = days until deadline
 *   - Deadline passed       → cap = 180 days (6 months grace)
 *   - No deadline set       → cap = 365 days (1 year default)
 */

const PASSED_DEADLINE_CAP = 180;
const NO_DEADLINE_CAP     = 365;

export function maxIntervalForDeadline(
  deadline: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!deadline) return NO_DEADLINE_CAP;

  const msLeft   = deadline.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / 86_400_000);

  if (daysLeft <= 0) return PASSED_DEADLINE_CAP;

  // At least 1 day so we never cap to 0 (would force same-day review forever).
  return Math.max(1, daysLeft);
}
