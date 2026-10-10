'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PresentationTier } from '../presentation/tokens';
import { emptyMastery, type MasterySnapshot } from '../core/types';

type Settings = {
  tier: PresentationTier | 'auto';
  reducedMotion: boolean;
  sound: boolean;
  haptics: boolean;
};

export const useLastWordSettings = create<Settings & { update: (patch: Partial<Settings>) => void }>()(
  persist((set) => ({
    tier: 'auto', reducedMotion: false, sound: false, haptics: false,
    update: (patch) => set(patch),
  }), { name: 'last-word-settings-v1' }),
);

export const useLastWordMastery = create<{ value: MasterySnapshot; replace: (value: MasterySnapshot) => void }>((set) => ({
  value: emptyMastery(), replace: (value) => set({ value }),
}));
