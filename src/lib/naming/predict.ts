/**
 * Layer 2 (sticky last-used) and Layer 3 (sequence prediction) of the
 * autofill engine.
 */

import { CourseKey, SubjectKey, DocTypeKey } from './taxonomy';

// ─── Layer 2 — sticky last-used ────────────────────────────────────────────
// Mirrors the getLastUsedBatch/setLastUsedBatch pattern in
// src/components/admin/lms/lms-shared.tsx (same SSR guards, same key style).

export type StickyField = 'course' | 'subject' | 'docType';

const LAST_USED_PREFIX = 'vh-lms-last-used-';

/** Read the value the current admin last used for this field, if any. */
export function getLastUsed(field: StickyField): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_USED_PREFIX + field);
}

/** Persist the value the current admin just used, for getLastUsed() to pick up next time. */
export function setLastUsed(field: StickyField, value: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_USED_PREFIX + field, value);
}

// ─── Layer 3 — sequence prediction ─────────────────────────────────────────

export interface ExistingMaterial {
  course:  CourseKey  | null;
  subject: SubjectKey | null;
  docType: DocTypeKey | null;
  number:  string      | null;
}

/**
 * Given existing materials, find the highest `number` among those matching
 * (course, subject, docType) and propose the next one.
 * `1.3` -> `1.4` (increment minor), `4` -> `5` (increment integer).
 * No match, or no recognizable number format -> null.
 */
export function predictNextNumber(
  existing: ExistingMaterial[],
  ctx: { course: CourseKey | null; subject: SubjectKey | null; docType: DocTypeKey | null },
): string | null {
  let best: { major: number; minor: number | null } | null = null;

  for (const m of existing) {
    if (m.course !== ctx.course || m.subject !== ctx.subject || m.docType !== ctx.docType) continue;
    if (!m.number) continue;

    const decimal = /^(\d+)\.(\d+)$/.exec(m.number);
    const plain = /^(\d+)$/.exec(m.number);
    let major: number;
    let minor: number | null;
    if (decimal) {
      major = parseInt(decimal[1], 10);
      minor = parseInt(decimal[2], 10);
    } else if (plain) {
      major = parseInt(plain[1], 10);
      minor = null;
    } else {
      continue; // unrecognized number format
    }

    if (!best || major > best.major || (major === best.major && (minor ?? -1) > (best.minor ?? -1))) {
      best = { major, minor };
    }
  }

  if (!best) return null;
  return best.minor !== null ? `${best.major}.${best.minor + 1}` : `${best.major + 1}`;
}
