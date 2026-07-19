'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Trophy, BookOpen } from 'lucide-react';
import AnimatedNumber from '@/components/vocab/AnimatedNumber';
import type { PublicReveal } from '@/lib/vocab/game/types';

const SANS  = "'Sora', sans-serif";
const SERIF = "'Cormorant Garamond', Georgia, serif";

export default function RevealCard({
  reveal,
  won,
  wordPoints,
  sentencePoints,
  isCatchUp,
  totalPoints,
}: {
  reveal:         PublicReveal;
  won:            boolean;
  wordPoints:     number;
  sentencePoints: number;
  isCatchUp:      boolean;
  totalPoints:    number;
}) {
  const reduceMotion = useReducedMotion();
  const total = wordPoints + sentencePoints;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring' as const, stiffness: 240, damping: 24 }}
      style={{
        background: won
          ? 'linear-gradient(160deg, rgba(46,204,113,0.08) 0%, var(--color-lx-surface) 55%)'
          : 'var(--color-lx-surface)',
        border: `1px solid ${won ? 'rgba(46,204,113,0.3)' : 'var(--color-lx-border)'}`,
        borderRadius: 18,
        padding: '1.5rem 1.375rem',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {won && !reduceMotion && (
        <motion.div
          aria-hidden
          initial={{ x: '-110%', skewX: -12 }}
          animate={{ x: '210%' }}
          transition={{ duration: 1.1, delay: 0.2, ease: [0.25, 0, 0.15, 1] }}
          style={{
            position: 'absolute', top: 0, left: 0, width: '45%', height: '100%',
            background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.08) 45%, rgba(46,204,113,0.06) 55%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.875rem' }}>
        {won
          ? <Trophy size={16} color="var(--color-lx-success)" />
          : <BookOpen size={16} color="var(--color-lx-text-muted)" />
        }
        <span style={{
          fontFamily: SANS, fontSize: '0.6rem', fontWeight: 700,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: won ? 'var(--color-lx-success)' : 'var(--color-lx-text-muted)',
        }}>
          {won ? 'Solved' : 'Round complete'}
        </span>
      </div>

      <p className="lx-word" style={{
        fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
        fontSize: 'clamp(2rem, 8vw, 2.6rem)', lineHeight: 1.05,
        color: 'var(--color-lx-text-primary)', textTransform: 'capitalize',
        marginBottom: '0.625rem',
      }}>
        {reveal.word}
      </p>

      <p style={{ fontFamily: SANS, fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--color-lx-text-secondary)', marginBottom: '0.875rem' }}>
        {reveal.definition}
      </p>

      {!won && reveal.failExplanation && (
        <div style={{
          padding: '0.75rem 0.875rem', borderRadius: 10, marginBottom: '0.875rem',
          background: 'rgba(133,133,133,0.08)', border: '1px solid var(--color-lx-border)',
        }}>
          <p style={{ fontFamily: SANS, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-lx-text-muted)', marginBottom: 4 }}>
            What happened
          </p>
          <p style={{ fontFamily: SANS, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--color-lx-text-secondary)', margin: 0 }}>
            {reveal.failExplanation}
          </p>
        </div>
      )}

      {!won && reveal.closestGuess && (
        <div style={{
          padding: '0.75rem 0.875rem', borderRadius: 10, marginBottom: '0.875rem',
          background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.2)',
        }}>
          <p style={{ fontFamily: SANS, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-lx-success)', marginBottom: 4 }}>
            Closest guess · &ldquo;{reveal.closestGuess.word}&rdquo;
          </p>
          <p style={{ fontFamily: SANS, fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--color-lx-text-secondary)', margin: 0 }}>
            {reveal.closestGuess.distinction}
          </p>
        </div>
      )}

      <blockquote style={{
        margin: '0 0 1.125rem', padding: '0.75rem 0.875rem',
        borderLeft: '2px solid var(--color-lx-accent-gold)',
        fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.95rem',
        lineHeight: 1.55, color: 'var(--color-lx-text-primary)',
      }}>
        &ldquo;{reveal.modelSentence}&rdquo;
      </blockquote>

      {/* Points breakdown */}
      <div style={{
        borderTop: '1px solid var(--color-lx-border)', paddingTop: '0.875rem',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: SANS, fontSize: '0.78rem', color: 'var(--color-lx-text-secondary)' }}>Word points</span>
          <span style={{ fontFamily: SANS, fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-lx-text-primary)' }}>{wordPoints}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: SANS, fontSize: '0.78rem', color: 'var(--color-lx-text-secondary)' }}>Sentence points</span>
          <span style={{ fontFamily: SANS, fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-lx-text-primary)' }}>{sentencePoints}</span>
        </div>
        {isCatchUp && (
          <p style={{ fontFamily: SANS, fontSize: '0.7rem', color: 'var(--color-lx-accent-gold)', margin: 0 }}>
            Catch-up round — points shown already at ¼ rate
          </p>
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--color-lx-border)',
        }}>
          <span style={{ fontFamily: SANS, fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-lx-text-primary)' }}>Round total</span>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '1.4rem', color: 'var(--color-lx-accent-gold)' }}>
            +<AnimatedNumber value={total} />
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: SANS, fontSize: '0.7rem', color: 'var(--color-lx-text-muted)' }}>Your balance</span>
          <span style={{ fontFamily: SANS, fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-lx-text-secondary)' }}>
            <AnimatedNumber value={totalPoints} /> pts
          </span>
        </div>
      </div>
    </motion.div>
  );
}
