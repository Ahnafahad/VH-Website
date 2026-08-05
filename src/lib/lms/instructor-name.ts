/**
 * Display-only instructor name formatting. Given the set of instructors
 * being shown together, returns first-name-only labels, disambiguating a
 * first-name collision as "First L." (first name + surname initial). Never
 * touches stored names — display only.
 */

export interface NamedUser {
  id: number;
  name: string;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function surnameInitial(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[1][0] : null;
}

/** Maps each user's id to its display label, disambiguated within this set. */
export function formatInstructorNames(users: NamedUser[]): Map<number, string> {
  const firstNameCounts = new Map<string, number>();
  for (const u of users) {
    const fn = firstName(u.name);
    firstNameCounts.set(fn, (firstNameCounts.get(fn) ?? 0) + 1);
  }

  const result = new Map<number, string>();
  for (const u of users) {
    const fn = firstName(u.name);
    const hasCollision = (firstNameCounts.get(fn) ?? 0) > 1;
    if (!hasCollision) {
      result.set(u.id, fn);
      continue;
    }
    const initial = surnameInitial(u.name);
    result.set(u.id, initial ? `${fn} ${initial}.` : fn);
  }

  return result;
}
