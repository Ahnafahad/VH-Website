import type { CardPrefs } from '../card-prefs';
import { DEFAULT_CARD_PREFS } from '../card-prefs';

/**
 * Onboarding runs before sign-in, so its result lives in sessionStorage until
 * there is an account to write it to. It survives the Google redirect (same
 * tab, same origin) and is cleared once persisted.
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
    const raw = sessionStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingDraft;
    if (!Array.isArray(parsed.answers) || !Array.isArray(parsed.weakWordIds)) return null;
    return { ...parsed, prefs: { ...DEFAULT_CARD_PREFS, ...parsed.prefs } };
  } catch { return null; }
}

export function writeDraft(draft: OnboardingDraft): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(ONBOARDING_KEY, JSON.stringify(draft)); } catch { /* private mode */ }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(ONBOARDING_KEY); } catch { /* private mode */ }
}
