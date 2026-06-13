'use client';

// Zero-asset WebAudio sound pack for LexiCore (vocab).
// Ported from the math sound pack. Gated by a per-user preference mirrored in
// localStorage. NOTE: sound is OFF by default for vocab (see readSoundPref).

let ctx: AudioContext | null = null;

type WebKitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as WebKitWindow).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** Unlocks the audio context — must be called inside a user gesture handler. */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

function beep(
  freq: number,
  ms: number,
  type: OscillatorType = 'sine',
  gain = 0.07,
  delay = 0,
): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g).connect(c.destination);
  const start = c.currentTime + delay;
  const stop = start + ms / 1000;
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, stop);
  osc.start(start);
  osc.stop(stop);
}

export const sounds = {
  // Light, high-frequency interaction cues
  tick:      () => beep(1200, 30, 'square', 0.035),
  select:    () => beep(1000, 28, 'square', 0.035),
  flip:      () => beep(680, 55, 'sine', 0.05),
  // SRS rating cues — pitched by sentiment
  gotIt:     () => { beep(740, 70); beep(1108, 110, 'sine', 0.07, 0.07); },     // F#5 → C#6
  unsure:    () => beep(560, 90, 'triangle', 0.05),
  missed:    () => beep(220, 180, 'sawtooth', 0.05),
  // Quiz answer cues (mirror math)
  correct:   () => { beep(880, 90); beep(1318, 140, 'sine', 0.07, 0.085); },    // A5 → E6
  incorrect: () => beep(180, 220, 'sawtooth', 0.055),
  // Celebration / milestone fanfares
  complete:  () => { beep(660, 90); beep(880, 100, 'sine', 0.07, 0.09); beep(1320, 200, 'sine', 0.07, 0.19); },
  levelUp:   () => { beep(660, 100); beep(880, 100, 'sine', 0.07, 0.1); beep(1320, 180, 'sine', 0.07, 0.2); },
  badge:     () => { beep(587, 90); beep(880, 90, 'sine', 0.07, 0.09); beep(1175, 120, 'sine', 0.07, 0.18); beep(1568, 220, 'sine', 0.07, 0.3); },
};

const LS_KEY = 'vh-vocab-sound-enabled';

/** Sound defaults to OFF for vocab (respectful default; opt-in via settings). */
export function readSoundPref(): boolean {
  if (typeof window === 'undefined') return false;
  const v = window.localStorage.getItem(LS_KEY);
  return v === null ? false : v === '1';
}

export function writeSoundPref(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_KEY, enabled ? '1' : '0');
}
