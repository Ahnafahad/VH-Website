'use client';

import { useCallback, useEffect, useState } from 'react';
import { readHapticsPref, vibrate, writeHapticsPref, type HapticEvent } from './haptics';
import { readSoundPref, sounds, unlockAudio, writeSoundPref } from './sound';

type SoundKey = keyof typeof sounds;

export interface MathFeedback {
  soundEnabled:      boolean;
  hapticsEnabled:    boolean;
  setSoundEnabled:   (v: boolean) => void;
  setHapticsEnabled: (v: boolean) => void;
  play:              (event: FeedbackEvent) => void;
  unlock:            () => void;
}

export type FeedbackEvent =
  | 'tap'        // key press
  | 'back'       // backspace
  | 'submit'     // submit button
  | 'correct'
  | 'incorrect'
  | 'timeout'
  | 'levelUp';

const SOUND_MAP: Record<FeedbackEvent, SoundKey | null> = {
  tap:       'tick',
  back:      'tick',
  submit:    'tick',
  correct:   'correct',
  incorrect: 'incorrect',
  timeout:   'timeout',
  levelUp:   'levelUp',
};

const HAPTIC_MAP: Record<FeedbackEvent, HapticEvent> = {
  tap:       'tap',
  back:      'back',
  submit:    'submit',
  correct:   'correct',
  incorrect: 'incorrect',
  timeout:   'timeout',
  levelUp:   'levelUp',
};

export function useMathFeedback(): MathFeedback {
  const [soundEnabled, setSoundState]     = useState(true);
  const [hapticsEnabled, setHapticsState] = useState(true);

  // hydrate from localStorage on mount (avoids SSR mismatch)
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
        vibrate(HAPTIC_MAP[event], true);
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
