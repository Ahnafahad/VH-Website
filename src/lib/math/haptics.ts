'use client';

export const HAPTIC_PATTERNS = {
  tap:       10 as number | number[],
  back:      20 as number | number[],
  submit:    40 as number | number[],
  correct:   [25, 40, 25] as number | number[],
  incorrect: [80, 50, 80] as number | number[],
  timeout:   [120, 80, 120, 80, 120] as number | number[],
  levelUp:   [40, 60, 40, 60, 80] as number | number[],
};

export type HapticEvent = keyof typeof HAPTIC_PATTERNS;

const LS_KEY = 'vh-math-haptics-enabled';

export function readHapticsPref(): boolean {
  if (typeof window === 'undefined') return true;
  const v = window.localStorage.getItem(LS_KEY);
  return v === null ? true : v === '1';
}

export function writeHapticsPref(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_KEY, enabled ? '1' : '0');
}

/** Fire a haptic pattern. No-op on desktop / unsupported browsers / when disabled. */
export function vibrate(event: HapticEvent, enabled: boolean): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  navigator.vibrate(HAPTIC_PATTERNS[event]);
}
