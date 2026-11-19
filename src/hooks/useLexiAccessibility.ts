'use client';

import { useSyncExternalStore } from 'react';

const MOTION_KEY = 'lx-reduce-motion';
const TEXT_KEY = 'lx-large-text';

type Prefs = { reduceMotion: boolean; largeText: boolean };

// One store for every caller, so a toggle in Profile reaches the shell (and MotionConfig) at once.
const SERVER: Prefs = { reduceMotion: false, largeText: false };
let prefs: Prefs | null = null;
const listeners = new Set<() => void>();

function apply(next: Prefs) {
  prefs = next;
  document.documentElement.dataset.lxMotion = next.reduceMotion ? 'reduced' : 'full';
  document.documentElement.dataset.lxText = next.largeText ? 'large' : 'default';
  listeners.forEach(l => l());
}

function load(): Prefs {
  const savedMotion = localStorage.getItem(MOTION_KEY);
  return {
    reduceMotion: savedMotion === null
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : savedMotion === '1',
    largeText: localStorage.getItem(TEXT_KEY) === '1',
  };
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (!prefs) apply(load());
  return () => { listeners.delete(l); };
}

const getSnapshot = () => prefs ?? SERVER;
const getServerSnapshot = () => SERVER;

function setReduceMotion(next: boolean) {
  localStorage.setItem(MOTION_KEY, next ? '1' : '0');
  apply({ ...getSnapshot(), reduceMotion: next });
}

function setLargeText(next: boolean) {
  localStorage.setItem(TEXT_KEY, next ? '1' : '0');
  apply({ ...getSnapshot(), largeText: next });
}

export function useLexiAccessibility() {
  const { reduceMotion, largeText } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { reduceMotion, largeText, setReduceMotion, setLargeText };
}
