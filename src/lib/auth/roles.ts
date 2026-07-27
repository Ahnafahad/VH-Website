/**
 * roles.ts — the single definition of what each privilege tier means.
 *
 * "Is this caller staff?" was previously re-encoded in ~15 places across
 * `src/lib` and `src/app/api`, in four mutually inconsistent spellings
 * (`session.user.isAdmin`, `isAdminEmail()`, an inline `['admin','super_admin',
 * 'instructor'].includes(role)` array, and an inline `role !== 'admin' && role
 * !== 'super_admin'` pair). Those spellings disagreed about instructors, and the
 * name never told you which one you had got.
 *
 * These are pure predicates over a role string. They deliberately do NOT read
 * the session or throw — each call site keeps its own auth lookup, status code,
 * error message and return shape, so adopting them changes no behaviour. Only
 * the definition of each tier is shared.
 *
 * ── Tier meanings ──────────────────────────────────────────────────────────
 *   isStaffRole      admin | super_admin | instructor   — can see/run the LMS
 *   isAdminRole      admin | super_admin                — no instructors
 *   isSuperAdminRole super_admin                        — destructive/global ops
 *
 * NOTE: `isAdminEmail()` in db-access-control.ts is STAFF-level, not admin-level
 * — it returns true for instructors. Its name predates the instructor role. Any
 * gate built on it (and on `session.user.isAdmin`, which is derived from it)
 * therefore admits instructors; see isStaffRole, not isAdminRole.
 */

export type Role = 'student' | 'instructor' | 'admin' | 'super_admin';

/** Anyone who works here: admin, super_admin or instructor. */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'instructor';
}

/** Administrators only — instructors are NOT included. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

/** The top tier. */
export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'super_admin';
}
