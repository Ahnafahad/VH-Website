/**
 * Helpers for the FBS diagnostic "elective subject" mechanic.
 *
 * Each diagnostic has General English + Advanced English (compulsory), plus a
 * pool of elective subjects (Business Studies, Economics, Accounting, and —
 * on some assessments — Mathematics) that varies by assessment. The taker
 * always attempts both English sections + exactly 2 chosen electives = 4
 * sections = 40 marks, regardless of how many electives are on offer.
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
