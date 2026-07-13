'use client';

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Haptic feedback for LexiCore (vocab). Ported from the math haptics pack.
// Patterns are tuned to event significance: light for frequent taps, distinct
// multi-buzz patterns for sentiment-laden moments (missed, celebration).

export const HAPTIC_PATTERNS = {
  tap:       8 as number | number[],
  select:    6 as number | number[],
  flip:      12 as number | number[],
  back:      20 as number | number[],
  gotIt:     [15] as number | number[],
  unsure:    20 as number | number[],
  missed:    [40, 30, 40] as number | number[],
  correct:   [25, 40, 25] as number | number[],
  incorrect: [80, 50, 80] as number | number[],
  complete:  [20, 50, 20, 50, 80] as number | number[],
  levelUp:   [40, 60, 40, 60, 80] as number | number[],
  badge:     [40, 60, 40, 60, 80] as number | number[],
};

export type HapticEvent = keyof typeof HAPTIC_PATTERNS;

const LS_KEY = 'vh-vocab-haptics-enabled';

/** Haptics default to ON (unobtrusive on mobile, no-op on desktop). */
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
  if (Capacitor.isNativePlatform()) {
    if (event === 'correct' || event === 'complete' || event === 'levelUp' || event === 'badge') {
      void Haptics.notification({ type: NotificationType.Success });
    } else if (event === 'incorrect' || event === 'missed') {
      void Haptics.notification({ type: NotificationType.Error });
    } else {
      void Haptics.impact({ style: event === 'back' || event === 'unsure' ? ImpactStyle.Medium : ImpactStyle.Light });
    }
    return;
  }
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  navigator.vibrate(HAPTIC_PATTERNS[event]);
}
