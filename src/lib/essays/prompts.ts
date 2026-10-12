/**
 * Per-essay prompts and maxima — the shared contract for essay series (2026-10-12).
 *
 * A series holds N essays; each has its own prompt and its own maximum mark
 * (e.g. 2 × 10, or 10 + 15). Each submission gets ONE mark (`total`), no sections.
 * Safe to import from client and server code.
 */

export interface EssayPrompt {
  /** Shown to students for this essay. May be empty when the series prompt covers everything. */
  prompt: string;
  /** Maximum mark for this essay, > 0. */
  max: number;
}

export const MAX_ESSAYS = 10;
export const MAX_MARK = 1000;

/**
 * Reads `essay_series.essays`. Legacy rows ('[]') are derived from the old columns:
 * essayCount essays, each with the series prompt and max = totalMarks (the old per-essay total).
 */
export function parseEssays(row: { essays?: string | null; essayCount: number; prompt: string; totalMarks: number }): EssayPrompt[] {
  try {
    const parsed: unknown = JSON.parse(row.essays || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((e: { prompt?: unknown; max?: unknown }) => ({ prompt: String(e.prompt ?? ''), max: Number(e.max) }));
    }
  } catch { /* fall through to legacy */ }
  return Array.from({ length: Math.max(1, row.essayCount) }, () => ({ prompt: '', max: row.totalMarks }));
}

/** Validates editor input. Returns the clean list or an error message. */
export function validateEssays(raw: unknown): { essays: EssayPrompt[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length < 1) return { error: 'Add at least one essay.' };
  if (raw.length > MAX_ESSAYS) return { error: `At most ${MAX_ESSAYS} essays per series.` };
  const essays: EssayPrompt[] = [];
  for (const [i, item] of raw.entries()) {
    const max = Number((item as { max?: unknown })?.max);
    const prompt = String((item as { prompt?: unknown })?.prompt ?? '').trim();
    if (!Number.isFinite(max) || max <= 0 || max > MAX_MARK) return { error: `Essay ${i + 1}: the maximum mark must be between 1 and ${MAX_MARK}.` };
    if (prompt.length > 4000) return { error: `Essay ${i + 1}: the prompt is too long.` };
    essays.push({ prompt, max });
  }
  return { essays };
}

/** Whole-series maximum. */
export const seriesMax = (essays: EssayPrompt[]) => essays.reduce((sum, e) => sum + e.max, 0);

/** Maximum for a 1-based essay index (falls back to the last essay for safety). */
export const essayMax = (essays: EssayPrompt[], essayIndex: number) => (essays[essayIndex - 1] ?? essays[essays.length - 1]).max;

/** A single mark is valid when it is a finite number in 0..max with at most 2 decimals' precision. */
export function validateMark(raw: unknown, max: number): { mark: number } | { error: string } {
  const mark = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof mark !== 'number' || !Number.isFinite(mark)) return { error: 'Enter a mark.' };
  if (mark < 0 || mark > max) return { error: `The mark must be between 0 and ${max}.` };
  return { mark: Math.round(mark * 100) / 100 };
}
