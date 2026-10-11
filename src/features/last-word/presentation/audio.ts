'use client';

import { Howl } from 'howler';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { assetUrl, type AssetUrls } from '../assets/runtime';

/** Presentation-only cues. Playback failures never affect game state (stack rule: Howler never drives flow). */
export type Cue = 'arrival' | 'select' | 'switch' | 'lock' | 'best' | 'defensible' | 'incorrect' | 'hold' | 'perfect-read' | 'mastery' | 'review-due' | 'hint' | 'ui-tap' | 'reveal';
type Haptic = { web: number | number[]; native: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' };

// Placeholder tones (Web Audio, so the CSP's media-src 'self' never blocks them). Pitches in D Dorian.
const TONES: Record<Cue, number[]> = {
  arrival: [587], select: [294], switch: [392, 440], lock: [147, 294], best: [440, 587], defensible: [440, 523],
  incorrect: [196, 175], hold: [220], 'perfect-read': [440, 494, 587], mastery: [294, 440, 587], 'review-due': [659],
  hint: [880], 'ui-tap': [330], reveal: [294, 587],
};
const DEFAULT_HAPTICS: Partial<Record<Cue, Haptic>> = {
  select: { web: 6, native: 'light' }, switch: { web: [6, 12, 6], native: 'light' }, lock: { web: 18, native: 'medium' },
  arrival: { web: 4, native: 'light' }, best: { web: [12, 40, 12], native: 'success' }, defensible: { web: [10, 50, 6], native: 'light' },
  incorrect: { web: [24, 60, 16], native: 'warning' }, hold: { web: [18, 30, 18], native: 'success' },
  mastery: { web: [20, 50, 20, 50, 60], native: 'success' }, hint: { web: 5, native: 'light' },
};

export function createFeedback(assets: AssetUrls) {
  const howls = new Map<Cue, Howl>();
  let context: AudioContext | null = null;
  let haptics = DEFAULT_HAPTICS;
  const patterns = assetUrl(assets, 'haptics.patterns');
  if (patterns) fetch(patterns).then(r => r.json()).then(json => { haptics = { ...DEFAULT_HAPTICS, ...json }; }).catch(() => {});

  function tone(cue: Cue) {
    context ??= new AudioContext();
    const start = context.currentTime;
    TONES[cue].forEach((frequency, i) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      const t = start + i * 0.07;
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain).connect(context!.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  return {
    play(cue: Cue, sound: boolean, haptic: boolean) {
      if (sound) {
        try {
          const url = assetUrl(assets, `sfx.${cue}`);
          if (url) {
            let howl = howls.get(cue);
            if (!howl) howls.set(cue, (howl = new Howl({ src: [url], volume: 0.7 })));
            howl.play();
          } else tone(cue);
        } catch { /* audio is optional */ }
      }
      const pattern = haptics[cue];
      if (!haptic || !pattern) return;
      if (Capacitor.isNativePlatform()) {
        const n = pattern.native;
        if (n === 'success' || n === 'warning' || n === 'error') void Haptics.notification({ type: { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error }[n] });
        else void Haptics.impact({ style: { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }[n] });
      } else if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern.web);
    },
    dispose() {
      howls.forEach(h => h.unload());
      howls.clear();
      void context?.close();
    },
  };
}
export type Feedback = ReturnType<typeof createFeedback>;
