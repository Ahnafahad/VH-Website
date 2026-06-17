/**
 * Server-side checking for typed (production-recall) quiz answers.
 *
 * Matching is deliberately forgiving on mechanics (case, surrounding
 * whitespace) and on a single typo for longer words, but never on meaning —
 * the typed string must be the target word itself.
 */

export function normalizeTypedAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Levenshtein distance capped at 2 (we only care whether it is 0 or 1). */
function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  // Walk both strings allowing exactly one divergence.
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la === lb)      { i++; j++; }       // substitution
    else if (la > lb)   { i++; }            // deletion in b
    else                { j++; }            // insertion in b
  }
  return edits + (la - i) + (lb - j) <= 1;
}

/**
 * Is the typed answer correct for the target word?
 * Exact match after normalization; words of 6+ letters tolerate one typo.
 */
export function isTypedAnswerCorrect(typed: string, correctWord: string): boolean {
  const a = normalizeTypedAnswer(typed);
  const b = normalizeTypedAnswer(correctWord);
  if (a.length === 0) return false;
  if (a === b) return true;
  return b.length >= 6 && editDistanceAtMost1(a, b);
}
