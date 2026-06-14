'use client';

import { useCallback, useEffect, useState } from 'react';
import { readHapticsPref, vibrate, writeHapticsPref } from './haptics';
import { readSoundPref, sounds, unlockAudio, writeSoundPref } from './sound';

type SoundKey = keyof typeof sounds;

// ─── Public types ─────────────────────────────────────────────────────────────

export type FeedbackEvent =
  | 'tap'
  | 'select'
  | 'flip'
  | 'back'
  | 'gotIt'
  | 'unsure'
  | 'missed'
  | 'correct'
  | 'incorrect'
  | 'complete'
  | 'levelUp'
  | 'badge';

export interface VocabFeedback {
  soundEnabled:      boolean;
  hapticsEnabled:    boolean;
  setSoundEnabled:   (v: boolean) => void;
  setHapticsEnabled: (v: boolean) => void;
  play:              (event: FeedbackEvent) => void;
  unlock:            () => void;
}

// ─── Event → sound mapping ────────────────────────────────────────────────────
// 'back' has no dedicated vocab sound — falls back to 'tick' (same as tap).

const SOUND_MAP: Record<FeedbackEvent, SoundKey | null> = {
  tap:       'tick',
  select:    'select',
  flip:      'flip',
  back:      'tick',      // no back-specific sound; tick is the lightest cue
  gotIt:     'gotIt',
  unsure:    'unsure',
  missed:    'missed',
  correct:   'correct',
  incorrect: 'incorrect',
  complete:  'complete',
  levelUp:   'levelUp',
  badge:     'badge',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVocabFeedback(): VocabFeedback {
  // Sound defaults OFF, haptics default ON — match the pref file defaults.
  // We start with the SSR-safe defaults and hydrate from localStorage on mount.
  const [soundEnabled, setSoundState]     = useState(false);
  const [hapticsEnabled, setHapticsState] = useState(true);

  useEffect(() => {
    setSoundState(readSoundPref());
    setHapticsState(readHapticsPref());
  }, []);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundState(v);
    writeSoundPref(v);
    if (v) unlockAudio();
  }, []);

  const setHapticsEnabled = useCallback((v: boolean) => {
    setHapticsState(v);
    writeHapticsPref(v);
  }, []);

  const play = useCallback(
    (event: FeedbackEvent) => {
      if (soundEnabled) {
        const key = SOUND_MAP[event];
        if (key) sounds[key]();
      }
      if (hapticsEnabled) {
        vibrate(event, true);
      }
    },
    [soundEnabled, hapticsEnabled],
  );

  return {
    soundEnabled,
    hapticsEnabled,
    setSoundEnabled,
    setHapticsEnabled,
    play,
    unlock: unlockAudio,
  };
}
