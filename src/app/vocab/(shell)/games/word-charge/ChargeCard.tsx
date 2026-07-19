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

  // Tint opacities driven by drag position (0 → 0.65 at threshold)
  const posOpacity = useTransform(dragX, [0, threshold],   [0, 0.65]);
  const negOpacity = useTransform(dragX, [-threshold, 0],  [0.65, 0]);

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

  const wordLen   = word.word.length;
  const wordSize  = wordLen > 14 ? 'clamp(1.4rem, 6vw, 2.2rem)' :
                    wordLen > 10 ? 'clamp(1.7rem, 7vw, 2.6rem)' :
                                   'clamp(2rem, 8.5vw, 3.2rem)';

  return (
    <motion.div
      drag={disabled ? false : 'x'}
      dragSnapToOrigin
      dragElastic={0.6}
      style={{
        x: dragX,
        rotate,
        position: 'relative',
        width: '100%',
        touchAction: 'none',
        cursor: disabled ? 'default' : 'grab',
        userSelect: 'none',
      }}
      onDragStart={() => { if (!disabled) setDragging(true); }}
      onDragEnd={disabled ? undefined : handleDragEnd}
      whileTap={disabled ? {} : { cursor: 'grabbing' }}
    >
      {/* Card body */}
      <div style={{
        background: 'var(--color-lx-surface)',
        border: '1px solid var(--color-lx-border)',
        borderRadius: 18,
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)',
            width: '80%', height: '80%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(244,168,40,0.06) 0%, transparent 70%)',
          }} />
        </div>

        {/* Decorative card sheen — pure CSS, frozen state = opacity:0 at end */}
        {!reduce && (
          <div
            aria-hidden
            key={word.id}
            className="lx-card-sheen"
            style={{
              position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none',
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.10) 47%, rgba(244,168,40,0.07) 50%, rgba(255,255,255,0.10) 53%, transparent 70%)',
              zIndex: 2,
            }}
          />
        )}

        {/* Word */}
        <p style={{
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: wordSize,
          lineHeight: 1.05,
          color: 'var(--color-lx-text-primary)',
          letterSpacing: '-0.02em',
          textAlign: 'center',
          position: 'relative',
          zIndex: 3,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          maxWidth: '100%',
        }}>
          {word.word}
        </p>

        {/* Part of speech */}
        {word.partOfSpeech && (
          <p style={{
            fontFamily: SANS,
            fontSize: '0.68rem',
            fontWeight: 500,
            color: 'var(--color-lx-text-muted)',
            letterSpacing: '0.06em',
            marginTop: '0.6rem',
            textTransform: 'uppercase',
            position: 'relative',
            zIndex: 3,
          }}>
            {word.partOfSpeech}
          </p>
        )}

        {/* Tint overlays — only mounted while dragging (stall-proof: avoids frozen opacity) */}
        {dragging && (
          <>
            {/* Positive (right) tint — gold */}
            <motion.div
              aria-hidden
              style={{
                opacity: posOpacity,
                position: 'absolute', inset: 0, zIndex: 10,
                borderRadius: 18, pointerEvents: 'none',
                background: 'rgba(244,168,40,0.18)',
                border: '2px solid rgba(244,168,40,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: '1.25rem',
              }}
            >
              <span style={{
                fontFamily: SANS, fontWeight: 700, fontSize: '1.1rem',
                color: 'var(--color-lx-accent-gold)', letterSpacing: '0.08em',
              }}>
                + POSITIVE
              </span>
            </motion.div>

            {/* Negative (left) tint — blue */}
            <motion.div
              aria-hidden
              style={{
                opacity: negOpacity,
                position: 'absolute', inset: 0, zIndex: 10,
                borderRadius: 18, pointerEvents: 'none',
                background: 'rgba(91,163,245,0.18)',
                border: '2px solid rgba(91,163,245,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                paddingLeft: '1.25rem',
              }}
            >
              <span style={{
                fontFamily: SANS, fontWeight: 700, fontSize: '1.1rem',
                color: 'var(--color-lx-mastery-familiar)', letterSpacing: '0.08em',
              }}>
                − NEGATIVE
              </span>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
