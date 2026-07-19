/**
 * Helpers for the FBS diagnostic "elective subject" mechanic.
 *
 * Each diagnostic has 5 sections: General English, Advanced English (compulsory),
 * plus Business Studies, Economics, Accounting (electives). The taker attempts
 * both English sections + exactly 2 of the 3 electives = 4 sections = 40 marks.
 *
 * Compulsory/elective is DERIVED from the section title (contains "English",
 * case-insensitive) — never hardcoded by id.
 */

/** True when a section title marks it as compulsory (contains "English"). */
export function isCompulsorySection(title: string): boolean {
  return /english/i.test(title);
}

/** Parse the chosenSections JSON string column to a number[] safely. */
export function parseChosenSections(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((n): n is number => typeof n === 'number');
    }
  } catch {
    /* ignore malformed JSON */
  }
  return [];
}
