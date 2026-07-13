'use client';

import { useCallback, useEffect, useState } from 'react';

const MOTION_KEY = 'lx-reduce-motion';
const TEXT_KEY = 'lx-large-text';

function applyPreferences(reduceMotion: boolean, largeText: boolean) {
  document.documentElement.dataset.lxMotion = reduceMotion ? 'reduced' : 'full';
  document.documentElement.dataset.lxText = largeText ? 'large' : 'default';
}

export function useLexiAccessibility() {
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [largeText, setLargeTextState] = useState(false);

  useEffect(() => {
    const savedMotion = localStorage.getItem(MOTION_KEY);
    const nextMotion = savedMotion === null
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : savedMotion === '1';
    const nextText = localStorage.getItem(TEXT_KEY) === '1';
    setReduceMotionState(nextMotion);
    setLargeTextState(nextText);
    applyPreferences(nextMotion, nextText);
  }, []);

  const setReduceMotion = useCallback((next: boolean) => {
    setReduceMotionState(next);
    localStorage.setItem(MOTION_KEY, next ? '1' : '0');
    applyPreferences(next, largeText);
  }, [largeText]);

  const setLargeText = useCallback((next: boolean) => {
    setLargeTextState(next);
    localStorage.setItem(TEXT_KEY, next ? '1' : '0');
    applyPreferences(reduceMotion, next);
  }, [reduceMotion]);

  return { reduceMotion, largeText, setReduceMotion, setLargeText };
}
