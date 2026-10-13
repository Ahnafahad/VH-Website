/**
 * Instructor page-visibility matrix. Stored in lms_settings:
 *   super:perm:instructor-hidden            JSON string[] of hidden nav hrefs (default for all instructors)
 *   super:perm:instructor-hidden:<userId>   JSON string[] override for one instructor (replaces the default)
 * This hides PAGES only (enforced in the admin layout); it is not API-level authorization.
 */
import { inArray } from 'drizzle-orm';
import { db, lmsSettings } from '@/lib/db';
import { INSTRUCTOR_NAV_SECTIONS } from '@/components/admin/admin-nav';

export const PERM_KEY = 'super:perm:instructor-hidden';
export const permKeyFor = (userId: number) => `${PERM_KEY}:${userId}`;
/** Where hidden-page redirects land; can never itself be hidden. */
export const INSTRUCTOR_HOME = '/admin/today';

export interface PermSection { href: string; label: string; group: string | null; also: string[] }

export function instructorSections(): PermSection[] {
  return INSTRUCTOR_NAV_SECTIONS.flatMap(sec => sec.items.map(i => ({ href: i.href, label: i.label, group: sec.label, also: i.also ?? [] })))
    .filter(s => s.href !== INSTRUCTOR_HOME);
}

export function parseHidden(raw: string | null | undefined): string[] | null {
  if (raw == null) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  } catch { return null; }
}

/** Every path prefix (hrefs + their `also` aliases) covered by the hidden sections. */
export function hiddenPrefixes(hidden: string[], sections: PermSection[] = instructorSections()): string[] {
  return sections.filter(s => hidden.includes(s.href)).flatMap(s => [s.href, ...s.also]);
}

/** True if `pathname` is, or is under, a hidden section (including its `also` prefixes). */
export function isPathHidden(pathname: string, hidden: string[], sections: PermSection[] = instructorSections()): boolean {
  const under = (p: string, prefix: string) => p === prefix || p.startsWith(prefix + '/');
  return sections.some(s => hidden.includes(s.href) && [s.href, ...s.also].some(prefix => under(pathname, prefix)));
}

/** Effective hidden list for one instructor: per-user override if present, else the global default. One query. */
export async function getInstructorHidden(userId: number): Promise<string[]> {
  const rows = await db.select().from(lmsSettings).where(inArray(lmsSettings.key, [PERM_KEY, permKeyFor(userId)]));
  const byKey = new Map(rows.map(r => [r.key, r.value]));
  return parseHidden(byKey.get(permKeyFor(userId))) ?? parseHidden(byKey.get(PERM_KEY)) ?? [];
}
