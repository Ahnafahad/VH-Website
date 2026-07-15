'use client';

import { useEffect } from 'react';

const TICK_MS = 400;

/**
 * Self-heal for frozen entrance animations.
 *
 * Framer Motion entrance animations start content at opacity 0 and rely on
 * the animation clock advancing to fade it in. When rendering is throttled
 * or frozen (backgrounded PWA/WebView, tab hidden mid-navigation, low-power
 * throttling), that clock can stall — leaving whole screens permanently
 * invisible even though the DOM is fully rendered (blank Study/Practice
 * pages after tapping a nav item).
 *
 * This hook polls document.getAnimations() and force-finishes any finite
 * animation whose currentTime hasn't advanced between two ticks. finish()
 * jumps straight to the final keyframe (the same code path as natural
 * completion, so Framer Motion commits styles normally). Healthy animations
 * complete in well under one tick and are never touched, so entrance
 * animations stay intact for everyone else.
 */
export function useAnimationStallGuard() {
  useEffect(() => {
    const lastSeen = new WeakMap<Animation, number>();

    const id = setInterval(() => {
      for (const anim of document.getAnimations()) {
        if (anim.playState !== 'running') continue;

        // Skip infinite loops (pulses, spinners) — finish() would throw,
        // and a frozen infinite animation can't hide content forever anyway.
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
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);
}
