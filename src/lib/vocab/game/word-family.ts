/**
 * Word Hunt — deterministic word-family normalizer.
 *
 * Used to reject duplicate guesses across a round, including same-family
 * forms (persist / persistent / persistence). Intentionally simple: no
 * dictionary, no NLP — a suffix-stripping stem comparison.
 */

// Longest-first so "ation" strips before "tion" strips before "s", etc.
const SUFFIXES = [
  'ation', 'ence', 'ance', 'ment', 'ness', 'tion',
  'ing', 'ent', 'ant', 'ive', 'ity', 'ed', 'ly', 'es', 's',
].sort((a, b) => b.length - a.length);

const MIN_STEM_LEN = 3;

/** lowercase + trim only — used for exact-match duplicate checks. */
export function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

/** normalizeWord() plus a single stripped suffix, for family comparison. */
export function stemWord(word: string): string {
  const normalized = normalizeWord(word);
  for (const suffix of SUFFIXES) {
    if (normalized.length - suffix.length >= MIN_STEM_LEN && normalized.endsWith(suffix)) {
      return normalized.slice(0, normalized.length - suffix.length);
    }
  }
  return normalized;
}

/**
 * True when two words are judged to be the same word family: identical
 * stems, or one stem is a prefix of the other with at least 4 shared
 * characters (catches e.g. "act" / "activate" style near-misses).
 */
export function sameFamily(a: string, b: string): boolean {
  const stemA = stemWord(a);
  const stemB = stemWord(b);
  if (stemA === stemB) return true;

  const [shorter, longer] = stemA.length <= stemB.length ? [stemA, stemB] : [stemB, stemA];
  if (shorter.length >= 4 && longer.startsWith(shorter)) return true;

  return false;
}
