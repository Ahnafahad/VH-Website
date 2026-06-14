'use client';

/**
 * Celebration — premium, restrained in-session celebration effect.
 *
 * Three layered sub-effects: radial glow bloom, diagonal light sweep, and
 * gold-foil flecks drifting from the anchor point. Respects
 * prefers-reduced-motion (skips flecks + sweep; shows only a brief glow).
 *
 * This component does NOT play sound or haptics — callers should fire
 * `play('complete' | 'badge' | 'levelUp')` alongside activating this component.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CelebrationProps {
  active:      boolean;
  intensity?:  'subtle' | 'full';
  /** Normalized 0..1 viewport coords. Default: { x: 0.5, y: 0.42 } */
  anchor?:     { x: number; y: number };
  onDone?:     () => void;
}

interface Fleck {
  id:       number;
  size:     number;
  color:    string;
  dx:       number;   // translateX destination (px)
  dy:       number;   // translateY destination (px)
  rot:      number;   // final rotation (deg)
  delay:    number;   // s
  duration: number;   // s
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD   = '#F4A828';
const RED    = '#E63946';
const CREAM  = '#F5E9C8';
const ANTIQUE = '#C9A84C';

const FLECK_COLORS = [GOLD, RED, CREAM, ANTIQUE, GOLD, GOLD];

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Longest animation: flecks up to 2.0s + max delay 0.5s → 2.5s; add buffer.
const DONE_DELAY_SUBTLE = 2200;
const DONE_DELAY_FULL   = 2800;

// ─── Particle seed (memoized to avoid regeneration on re-render) ──────────────

function seedFlecks(count: number, anchorPx: { x: number; y: number }): Fleck[] {
  return Array.from({ length: count }, (_, i) => {
    const angle    = (Math.random() * 2 * Math.PI);
    const spread   = 80 + Math.random() * 160;   // px radius
    return {
      id:       i,
      size:     4 + Math.random() * 5,            // 4–9 px
      color:    FLECK_COLORS[Math.floor(Math.random() * FLECK_COLORS.length)],
      dx:       Math.cos(angle) * spread,
      dy:       Math.sin(angle) * spread + 40,    // bias downward
      rot:      -30 + Math.random() * 60,
      delay:    Math.random() * 0.5,
      duration: 1.4 + Math.random() * 0.6,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Celebration({
  active,
  intensity = 'subtle',
  anchor    = { x: 0.5, y: 0.42 },
  onDone,
}: CelebrationProps) {
  const [mounted, setMounted] = useState(false);
  const reduceMotion          = useReducedMotion();
  const doneTimer             = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SSR guard — match the portal pattern from BadgeCelebration
  useEffect(() => { setMounted(true); }, []);

  const fleckCount = intensity === 'full' ? 28 : 14;

  // Stable anchor in pixels — recomputed only when anchor coords or window size
  // changes. We derive it lazily: compute once on first render in browser.
  // useMemo is the right tool to avoid recreating the array every render.
  const flecks = useMemo<Fleck[]>(() => {
    if (typeof window === 'undefined') return [];
    const px = {
      x: anchor.x * window.innerWidth,
      y: anchor.y * window.innerHeight,
    };
    return seedFlecks(fleckCount, px);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor.x, anchor.y, fleckCount]);

  // Fire onDone after the longest animation completes
  const fireDone = useCallback(() => {
    if (onDone) onDone();
  }, [onDone]);

  useEffect(() => {
    if (!active) return;
    const delay = intensity === 'full' ? DONE_DELAY_FULL : DONE_DELAY_SUBTLE;
    doneTimer.current = setTimeout(fireDone, delay);
    return () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, [active, intensity, fireDone]);

  if (!mounted) return null;

  // Anchor position as CSS (fixed, from viewport top-left)
  const anchorStyle: React.CSSProperties = {
    position: 'fixed',
    left:     `${anchor.x * 100}%`,
    top:      `${anchor.y * 100}%`,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 8888,
  };

  const content = (
    <AnimatePresence>
      {active && (
        <>
          {/* ── 1. Radial glow bloom ─────────────────────────────────── */}
          <motion.div
            key="glow-bloom"
            aria-hidden
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1,   opacity: intensity === 'full' ? 0.82 : 0.55 }}
            exit={{    scale: 1.2, opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } }}
            transition={{
              duration: 0.6,
              ease: EASE_OUT_EXPO,
            }}
            style={{
              ...anchorStyle,
              width:        intensity === 'full' ? '560px' : '360px',
              height:       intensity === 'full' ? '560px' : '360px',
              borderRadius: '50%',
              background:   `radial-gradient(circle at center,
                ${GOLD}22 0%,
                ${GOLD}12 35%,
                ${RED}08 60%,
                transparent 72%
              )`,
            }}
          />

          {/* ── 2. Light sweep (skip when reduced-motion) ─────────────── */}
          {!reduceMotion && (
            <motion.div
              key="light-sweep"
              aria-hidden
              initial={{ opacity: 0, x: '-120%' }}
              animate={{ opacity: [0, 0.18, 0], x: '120%' }}
              exit={{    opacity: 0 }}
              transition={{ duration: 0.7, ease: 'easeInOut', delay: 0.1 }}
              style={{
                position: 'fixed',
                top:      0,
                left:     0,
                width:    '100vw',
                height:   '100vh',
                pointerEvents: 'none',
                zIndex: 8888,
                background: `linear-gradient(
                  105deg,
                  transparent 30%,
                  rgba(244, 168, 40, 0.14) 48%,
                  rgba(255, 255, 255, 0.10) 50%,
                  rgba(244, 168, 40, 0.14) 52%,
                  transparent 70%
                )`,
              }}
            />
          )}

          {/* ── 3. Gold-foil flecks (skip when reduced-motion) ─────────── */}
          {!reduceMotion && flecks.map(f => (
            <motion.div
              key={`fleck-${f.id}`}
              aria-hidden
              initial={{
                opacity:  0,
                x:        0,
                y:        0,
                rotate:   0,
                scale:    1,
              }}
              animate={{
                opacity:  [0, 0.9, 0],
                x:        f.dx,
                y:        f.dy,
                rotate:   f.rot,
                scale:    [1, 1, 0.4],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: f.duration,
                delay:    f.delay,
                ease:     'easeOut',
              }}
              style={{
                ...anchorStyle,
                width:        f.size,
                height:       f.size,
                background:   f.color,
                borderRadius: '1px',
              }}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
