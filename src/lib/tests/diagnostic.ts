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

/** True when the taker picks electives: FBS diagnostics and elective-subject mocks (tests.electiveCount). */
export function usesElectives(test: { isDiagnostic: boolean; electiveCount: number | null }): boolean {
  return test.isDiagnostic || test.electiveCount != null;
}

/**
 * Validates a student's pick of `count` distinct electives and returns the section ids they will attempt
 * (every compulsory section + the picks), or null when the pick is invalid.
 */
export function pickAttemptedSections(
  sections: { id: number; title: string }[],
  chosen: number[],
  count: number,
): number[] | null {
  const electiveIds = new Set(sections.filter(s => !isCompulsorySection(s.title)).map(s => s.id));
  const distinct = new Set(chosen);
  if (chosen.length !== count || distinct.size !== count || ![...distinct].every(id => electiveIds.has(id))) return null;
  return [...sections.filter(s => isCompulsorySection(s.title)).map(s => s.id), ...chosen];
}

/** Mock written parts follow the paper: essay k of the linked series belongs to the test's k-th section. */
export function essayIndexesForSections(orderedSectionIds: number[], attempted: number[]): number[] {
  return orderedSectionIds.flatMap((id, i) => (attempted.includes(id) ? [i + 1] : []));
}
