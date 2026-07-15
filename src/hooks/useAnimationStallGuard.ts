'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const TICK_MS            = 400;    // guard poll interval
const STUCK_AFTER_MS     = 1400;   // longest legit entrance stagger is ~1.3s
const BLANK_CHECK_MS     = 3000;   // last-resort blank check after navigation
const RELOAD_COOLDOWN_MS = 30_000; // never reload-loop

/**
 * Three independent self-heal layers for the "blank page" failure where
 * Framer Motion entrance animations start content at opacity 0 and the
 * animation never completes (frozen rendering clock, dead rAF loop,
 * backgrounded PWA/WebView, low-power throttling). Each layer catches what
 * the previous one can't see. Healthy animations finish well before any
 * layer's threshold, so entrance animations stay fully intact.
 *
 * Layer 1 — WAAPI finisher: force-finishes finite Web Animations whose
 *   currentTime hasn't advanced between ticks (tween/ease animations).
 *
 * Layer 2 — DOM sweeper: WAAPI can't see Framer's JS-driven springs. Any
 *   element under <main> left at inline opacity < 0.1 for STUCK_AFTER_MS
 *   is forced visible directly (opacity 1, transform/filter cleared).
 *
 * Layer 3 — blank-screen watchdog: BLANK_CHECK_MS after each navigation
 *   (and on app resume), if half the animated elements are still invisible,
 *   force-sweep everything; if the page is STILL blank shortly after, do a
 *   single rate-limited hard reload.
 */

function forceVisible(el: HTMLElement) {
  el.style.opacity = '1';
  if (el.style.transform) el.style.transform = 'none';
  if (el.style.filter) el.style.filter = 'none';
}

function invisibleUnderMain(): HTMLElement[] {
  const main = document.querySelector('main');
  if (!main) return [];
  const out: HTMLElement[] = [];
  for (const el of main.querySelectorAll<HTMLElement>('[style*="opacity"]')) {
    if (parseFloat(getComputedStyle(el).opacity) < 0.1) out.push(el);
  }
  return out;
}

export function useAnimationStallGuard() {
  const pathname = usePathname();

  // Layers 1 + 2 — continuous polling guard.
  useEffect(() => {
    const lastSeen  = new WeakMap<Animation, number>();
    const firstSeen = new WeakMap<HTMLElement, number>();

    const sweep = () => {
      const now = Date.now();

      // Layer 1: frozen WAAPI animations.
      for (const anim of document.getAnimations()) {
        if (anim.playState !== 'running') continue;
        // Skip infinite loops (pulses, spinners) — finish() would throw.
        const timing = anim.effect?.getTiming();
        if (!timing || timing.iterations === Infinity) continue;
        // Scroll-driven timelines report percentages — not our concern.
        const ct = anim.currentTime;
        if (typeof ct !== 'number') continue;
        const prev = lastSeen.get(anim);
        if (prev !== undefined && ct === prev) {
          try { anim.finish(); } catch { /* already done or cancelled */ }
        } else {
          lastSeen.set(anim, ct);
        }
      }

      // Layer 2: JS-driven (spring) animations frozen at opacity ~0.
      // Threshold 0.1 so intentionally dimmed UI (locked cards at 0.3+)
      // is never touched.
      const main = document.querySelector('main');
      if (main) {
        for (const el of main.querySelectorAll<HTMLElement>('[style*="opacity"]')) {
          const o = parseFloat(el.style.opacity);
          if (!Number.isFinite(o) || o >= 0.1) continue;
          const seen = firstSeen.get(el);
          if (seen === undefined) {
            firstSeen.set(el, now);
          } else if (now - seen > STUCK_AFTER_MS) {
            forceVisible(el);
          }
        }
      }
    };

    const id = setInterval(sweep, TICK_MS);

    // App resume (PWA/Capacitor foreground) — sweep immediately, don't wait
    // for the next tick.
    const onResume = () => sweep();
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('pageshow', onResume);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('pageshow', onResume);
    };
  }, []);

  // Layer 3 — per-navigation blank-screen watchdog.
  useEffect(() => {
    let cancelled = false;

    const t = setTimeout(() => {
      if (cancelled) return;
      const main = document.querySelector('main');
      if (!main) return;

      const styled = main.querySelectorAll<HTMLElement>('[style*="opacity"]');
      const invisible = invisibleUnderMain();
      const blank = styled.length > 0 && invisible.length >= Math.max(1, styled.length * 0.5);
      if (!blank) return;

      // Emergency sweep: force everything invisible to visible.
      invisible.forEach(forceVisible);

      // Re-check shortly after; if the page is still blank something deeper
      // is broken — hard reload once (rate-limited so it can never loop).
      setTimeout(() => {
        if (cancelled) return;
        if (invisibleUnderMain().length === 0) return;
        try {
          const last = Number(sessionStorage.getItem('lx-blank-reload') ?? 0);
          if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
          sessionStorage.setItem('lx-blank-reload', String(Date.now()));
        } catch { /* sessionStorage unavailable — still reload */ }
        window.location.reload();
      }, 600);
    }, BLANK_CHECK_MS);

    return () => { cancelled = true; clearTimeout(t); };
  }, [pathname]);
}
