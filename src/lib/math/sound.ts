'use client';

// Zero-asset WebAudio sound pack for the math game.
// Gated by `mathUserProgress.soundEnabled` (mirrored in localStorage for pre-login).

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
  gain = 0.08,
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
  tick:      () => beep(1200, 35, 'square',   0.04),
  correct:   () => { beep(880, 90); beep(1318, 140, 'sine', 0.08, 0.085); },      // A5 → E6
  incorrect: () => beep(180, 220, 'sawtooth', 0.06),
  timeout:   () => { beep(520, 120); beep(360, 180, 'sine', 0.08, 0.11); },
  levelUp:   () => { beep(660, 100); beep(880, 100, 'sine', 0.08, 0.1); beep(1320, 180, 'sine', 0.08, 0.2); },
};

const LS_KEY = 'vh-math-sound-enabled';

export function readSoundPref(): boolean {
  if (typeof window === 'undefined') return true;
  const v = window.localStorage.getItem(LS_KEY);
  return v === null ? true : v === '1';
}

export function writeSoundPref(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_KEY, enabled ? '1' : '0');
}
