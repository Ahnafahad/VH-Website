'use client';

import { useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import type { ChargeWord } from '@/lib/vocab/word-charge/types';

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";

// Commit thresholds — spec: ≥38% of container width OR velocity >600 with |offset|≥60px
const VELOCITY_THRESHOLD = 600;
const VELOCITY_MIN_OFFSET = 60;
const COMMIT_RATIO = 0.38;

interface Props {
  word:         ChargeWord;
  containerWidth: number;
  onCommit:     (choice: 'positive' | 'negative') => void;
  disabled:     boolean;
  reduce:       boolean;
}

export default function ChargeCard({ word, containerWidth, onCommit, disabled, reduce }: Props) {
  const dragX  = useMotionValue(0);
  const threshold = Math.max(containerWidth * COMMIT_RATIO, 80);

  // Rotation: max ±8° proportional to drag
  const rotate = useTransform(dragX, [-threshold, 0, threshold], [-8, 0, 8]);

  // Side-tint overlays — only mounted while dragging (stall-proof doctrine)
  const [dragging, setDragging] = useState(false);
  const locked = useRef(false);

  // Pole glows driven by drag position (0 → 0.85 at threshold)
  const posOpacity = useTransform(dragX, [0, threshold],   [0, 0.85]);
  const negOpacity = useTransform(dragX, [-threshold, 0],  [0.85, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    setDragging(false);
    if (locked.current || disabled) return;

    const ox = info.offset.x;
    const vx = info.velocity.x;

    const flingCommit = Math.abs(vx) > VELOCITY_THRESHOLD && Math.abs(ox) >= VELOCITY_MIN_OFFSET;
    const distCommit  = Math.abs(ox) >= threshold;

    if (distCommit || flingCommit) {
      locked.current = true;
      onCommit(ox > 0 ? 'positive' : 'negative');
    }
    // else spring back (dragSnapToOrigin handles it)
  }

  const wordLen  = word.word.length;
  const wordSize = wordLen > 13 ? 'clamp(1.05rem, 4.6vw, 1.45rem)' :
                   wordLen > 9  ? 'clamp(1.25rem, 5.6vw, 1.75rem)' :
                                  'clamp(1.5rem, 7vw, 2.15rem)';

  return (
    <motion.div
      drag={disabled ? false : 'x'}
      dragSnapToOrigin
      dragElastic={0.6}
      style={{
        x: dragX,
        rotate,
        position: 'relative',
        // The artifact is square; cap by both width and viewport height so it
        // always fits between the header and the controls on small phones.
        width: 'min(100%, 76vw, 42dvh)',
        aspectRatio: '1',
        margin: '0 auto',
        touchAction: 'none',
        cursor: disabled ? 'default' : 'grab',
        userSelect: 'none',
      }}
      onDragStart={() => { if (!disabled) setDragging(true); }}
      onDragEnd={disabled ? undefined : handleDragEnd}
      whileTap={disabled ? {} : { cursor: 'grabbing' }}
    >
      {/* The ring-mounted plaque artifact (LexiCore Word Charge hero art).
          Same asset as the Games-hub card, so it's already in cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lexicore-assets/games/word-charge.webp"
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'contain',
          userSelect: 'none', pointerEvents: 'none',
        }}
      />

      {/* One-shot sheen across the plaque per new word — pure CSS, frozen state = invisible */}
      {!reduce && (
        <div
          aria-hidden
          key={word.id}
          className="lx-card-sheen"
          style={{
            position: 'absolute', inset: '28% 27%', borderRadius: 12, pointerEvents: 'none',
            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.10) 47%, rgba(244,168,40,0.07) 50%, rgba(255,255,255,0.10) 53%, transparent 70%)',
            zIndex: 3,
          }}
        />
      )}

      {/* Word set into the central plaque */}
      <div style={{
        position: 'absolute', inset: '27% 26% 27%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', zIndex: 2, pointerEvents: 'none',
        padding: '0 2%',
      }}>
        <p style={{
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: wordSize,
          lineHeight: 1.08,
          color: 'var(--color-lx-text-primary)',
          letterSpacing: '-0.02em',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          maxWidth: '100%',
          textShadow: '0 1px 8px rgba(0,0,0,0.7)',
        }}>
          {word.word}
        </p>
        {word.partOfSpeech && (
          <p style={{
            fontFamily: SANS,
            fontSize: '0.58rem',
            fontWeight: 600,
            color: 'var(--color-lx-text-muted)',
            letterSpacing: '0.1em',
            marginTop: '0.45rem',
            textTransform: 'uppercase',
          }}>
            {word.partOfSpeech}
          </p>
        )}
      </div>

      {/* Pole glows — only mounted while dragging (stall-proof: avoids frozen opacity) */}
      {dragging && (
        <>
          {/* Positive (right) — gold aura + label */}
          <motion.div
            aria-hidden
            style={{
              opacity: posOpacity,
              position: 'absolute', inset: '-4%', zIndex: 4,
              borderRadius: '50%', pointerEvents: 'none',
              background: 'radial-gradient(circle at 78% 50%, rgba(244,168,40,0.38) 0%, rgba(244,168,40,0.10) 40%, transparent 68%)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: '2%',
            }}
          >
            <span style={{
              fontFamily: SANS, fontWeight: 700, fontSize: '0.95rem',
              color: 'var(--color-lx-accent-gold)', letterSpacing: '0.08em',
              textShadow: '0 1px 6px rgba(0,0,0,0.8)',
            }}>
              + POSITIVE
            </span>
          </motion.div>

          {/* Negative (left) — cold blue aura + label */}
          <motion.div
            aria-hidden
            style={{
              opacity: negOpacity,
              position: 'absolute', inset: '-4%', zIndex: 4,
              borderRadius: '50%', pointerEvents: 'none',
              background: 'radial-gradient(circle at 22% 50%, rgba(91,163,245,0.38) 0%, rgba(91,163,245,0.10) 40%, transparent 68%)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
              paddingLeft: '2%',
            }}
          >
            <span style={{
              fontFamily: SANS, fontWeight: 700, fontSize: '0.95rem',
              color: 'var(--color-lx-mastery-familiar)', letterSpacing: '0.08em',
              textShadow: '0 1px 6px rgba(0,0,0,0.8)',
            }}>
              − NEGATIVE
            </span>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
