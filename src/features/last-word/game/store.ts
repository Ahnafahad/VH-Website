'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PresentationTier } from '../presentation/tokens';

type Settings = {
  tier: PresentationTier | 'auto';
  reducedMotion: boolean;
  sound: boolean;
  haptics: boolean;
  music: boolean;
  tutorialDone: boolean;
};

export const useLastWordSettings = create<Settings & { update: (patch: Partial<Settings>) => void }>()(
  persist((set) => ({
    tier: 'auto', reducedMotion: false, sound: false, haptics: false, music: false, tutorialDone: false,
    update: (patch) => set(patch),
  }), { name: 'last-word-settings-v2' }),
);
