'use client';

import { Howl } from 'howler';

export type Cue = 'arrival' | 'selection' | 'switch' | 'lock' | 'best' | 'defensible' | 'incorrect' | 'mastery' | 'review';
const frequencies: Record<Cue, number> = {
  arrival: 320, selection: 180, switch: 240, lock: 120,
  best: 520, defensible: 390, incorrect: 150, mastery: 660, review: 440,
};

function synthesize(frequency: number) {
  const rate = 22050;
  const samples = Math.floor(rate * 0.16);
  const data = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(data);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const envelope = Math.min(t / 0.008, 1) * Math.exp(-t * 28);
    view.setInt16(44 + i * 2, (Math.sin(t * frequency * Math.PI * 2) + 0.22 * Math.sin(t * frequency * 3 * Math.PI)) * envelope * 6500, true);
  }
  let binary = '';
  for (const byte of new Uint8Array(data)) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function createFeedbackHooks() {
  const sounds = new Map<Cue, Howl>();
  return {
    play(cue: Cue, sound: boolean, haptics: boolean) {
      if (sound) {
        let howl = sounds.get(cue);
        if (!howl) {
          howl = new Howl({ src: [synthesize(frequencies[cue])], format: ['wav'], volume: 0.28 });
          sounds.set(cue, howl);
        }
        howl.play();
      }
      if (haptics && typeof navigator.vibrate === 'function') navigator.vibrate(cue === 'lock' ? 18 : cue === 'switch' ? [6, 12, 6] : 7);
    },
    dispose() { sounds.forEach((sound) => sound.unload()); sounds.clear(); },
  };
}
