/**
 * Suggest which class an unattached material most likely belongs to, using the
 * existing filename parser. Pure and conservative: returns null rather than
 * guessing when the filename carries no matching signal.
 */

import { parseFilename } from '@/lib/naming/parse-filename';

export interface SuggestableClass {
  id: number;
  title: string;
  subject: string;
  product: string;
  topic: string | null;
  classNumber: number | null;
  displayClassNumber: number | null;
  scheduledAt: number;
}

function lastInt(n: string | null): number | null {
  if (!n) return null;
  const m = n.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function suggestClassForFile(
  fileName: string,
  product: string,
  classes: readonly SuggestableClass[],
): SuggestableClass | null {
  const parsed = parseFilename(fileName);
  const pool = classes.filter((c) => c.product === (parsed.course ?? product));
  if (pool.length === 0) return null;

  const inSubject = parsed.subject ? pool.filter((c) => c.subject === parsed.subject) : pool;
  const num = lastInt(parsed.number);

  // 1. Subject + class number is the strongest signal.
  if (parsed.subject && num != null) {
    const hits = inSubject.filter((c) => (c.displayClassNumber ?? c.classNumber) === num);
    if (hits.length) return [...hits].sort((a, b) => b.scheduledAt - a.scheduledAt)[0];
  }

  // 2. Topic text appears in exactly one class title or topic.
  if (parsed.topic) {
    const t = normalise(parsed.topic);
    if (t.length >= 4) {
      const hits = inSubject.filter((c) => normalise(`${c.title} ${c.topic ?? ''}`).includes(t));
      if (hits.length === 1) return hits[0];
    }
  }
  return null;
}
