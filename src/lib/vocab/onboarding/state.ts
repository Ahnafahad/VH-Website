import type { CardPrefs } from '../card-prefs';
import { DEFAULT_CARD_PREFS } from '../card-prefs';

/**
 * Onboarding runs before sign-in, so its result lives in localStorage until
 * there is an account to write it to. It survives the Google redirect and a
 * new tab, and is cleared once persisted. To cross into another browser (out
 * of the Facebook app) it rides along in the link: see draftToParam.
 */
export const ONBOARDING_KEY = 'lexicore.onboarding.v1';

export interface DiagnosticAnswer {
  wordId:  number;
  correct: boolean;
  tier:    number;
}

export interface OnboardingDraft {
  prefs:       CardPrefs;
  answers:     DiagnosticAnswer[];
  /** Words the user actually got wrong — never manufactured. */
  weakWordIds: number[];
}

export function readDraft(): OnboardingDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY) ?? sessionStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingDraft;
    if (!Array.isArray(parsed.answers) || !Array.isArray(parsed.weakWordIds)) return null;
    return { ...parsed, prefs: { ...DEFAULT_CARD_PREFS, ...parsed.prefs } };
  } catch { return null; }
}

export function writeDraft(draft: OnboardingDraft): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(draft)); } catch { /* private mode */ }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(ONBOARDING_KEY); sessionStorage.removeItem(ONBOARDING_KEY); } catch { /* private mode */ }
}

/** Draft → short URL-safe string: answers as [wordId, correct, tier] tuples. */
export function draftToParam(d: OnboardingDraft): string {
  const json = JSON.stringify({ p: d.prefs, a: d.answers.map(x => [x.wordId, x.correct ? 1 : 0, x.tier]) });
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Inverse of draftToParam. Anything malformed → null. */
export function draftFromParam(s: string | undefined): OnboardingDraft | null {
  if (!s || s.length > 4000) return null;
  try {
    const o = JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/'))) as { p?: Partial<CardPrefs>; a?: unknown };
    if (!Array.isArray(o.a) || o.a.length > 100) return null;
    const answers: DiagnosticAnswer[] = [];
    for (const t of o.a) {
      if (!Array.isArray(t) || !t.every(n => Number.isInteger(n))) return null;
      answers.push({ wordId: t[0], correct: t[1] === 1, tier: t[2] });
    }
    return {
      prefs: { ...DEFAULT_CARD_PREFS, ...(o.p && typeof o.p === 'object' ? o.p : {}) },
      answers,
      weakWordIds: answers.filter(a => !a.correct).map(a => a.wordId),
    };
  } catch { return null; }
}
