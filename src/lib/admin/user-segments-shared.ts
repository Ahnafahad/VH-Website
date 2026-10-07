/** Client-safe half of the Users segments (no DB import). See user-segments.ts for the SQL. */

export const SEGMENT_KEYS = [
  'enrolled', 'registered', 'logged_in', 'never_logged_in',
  'logged_in_once', 'logged_in_multiple', 'logged_in_not_registered',
  'batch_without_access', 'enrolled_never_logged_in',
] as const;
export type SegmentKey = typeof SEGMENT_KEYS[number];

export const SEGMENT_LABELS: Record<SegmentKey, { label: string; help: string }> = {
  enrolled:                 { label: 'Enrolled',               help: 'Active students whose batch is still current and who hold active access to it.' },
  registered:               { label: 'Registered',             help: 'We have their phone number, or they have used an app (LexiCore, Mental Math, FBS Accounting or a test).' },
  logged_in:                { label: 'Logged in',              help: 'Signed in to the website at least once.' },
  never_logged_in:          { label: 'Never logged in',        help: 'Has an account but has never signed in.' },
  logged_in_once:           { label: 'Logged in once',         help: 'Signed in on exactly one day.' },
  logged_in_multiple:       { label: 'Logged in 2+ days',      help: 'Signed in on two or more different days.' },
  logged_in_not_registered: { label: 'Logged in, not registered', help: 'Signed in but no phone number and no app use.' },
  batch_without_access:     { label: 'Batch, no access',       help: 'Students assigned to a batch who have no active product access, so they cannot see any content.' },
  enrolled_never_logged_in: { label: 'Enrolled, never logged in', help: 'Enrolled students who have never signed in.' },
};

export function isSegmentKey(value: string | null): value is SegmentKey {
  return !!value && (SEGMENT_KEYS as readonly string[]).includes(value);
}

export type SegmentCounts = Record<SegmentKey, number> & {
  total: number; student: number; instructor: number; admin: number; super_admin: number;
};

