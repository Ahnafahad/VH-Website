'use client';

/**
 * AllWordsReviewedScreen — T35 Edge Case 2
 *
 * Fullscreen celebration state shown when every theme in the visible units
 * has status === 'complete' (all words reviewed).
 *
 * Design: ceremonial, editorial. Gold-dominant. canvas-confetti on mount.
 * CTAs: Practice Mode → /vocab/practice  |  View Profile → /vocab/profile
 * Framer Motion: staggered entrance, scale 0.9 → 1, spring.
 */

import { useEffect, useRef } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Zap, Star, ArrowRight } from 'lucide-react';

// ─── Variants ─────────────────────────────────────────────────────────────────

const containerV: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const itemV: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 14 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
};

const glowV: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 200, damping: 24, delay: 0.05 },
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  totalWords:     number;
  masteredWords:  number;
  totalPoints:    number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AllWordsReviewedScreen({ totalWords, masteredWords, totalPoints }: Props) {
  const router    = useRouter();
  const firedRef  = useRef(false);

  // ── Confetti burst on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const fire = async () => {
      try {
        const { default: confetti } = await import('canvas-confetti');

        const colors = ['#C9A84C', '#F4A828', '#FFD700', '#E63946', '#F5F5F5'];

        // Centre burst
        confetti({
          particleCount: 120,
          spread:        80,
          origin:        { x: 0.5, y: 0.42 },
          colors,
          gravity:       0.7,
          scalar:        1.25,
          ticks:         260,
          startVelocity: 28,
        });

        // Bilateral edge bursts
        setTimeout(() => {
          confetti({
            particleCount: 60,
            angle:         60,
            spread:        55,
            origin:        { x: 0, y: 0.55 },
            colors,
            gravity:       0.65,
            scalar:        1.1,
            ticks:         220,
          });
          confetti({
            particleCount: 60,
            angle:         120,
            spread:        55,
            origin:        { x: 1, y: 0.55 },
            colors,
            gravity:       0.65,
            scalar:        1.1,
            ticks:         220,
          });
        }, 260);
      } catch {
        // Non-critical — silently swallow confetti errors.
      }
    };

    const t = setTimeout(fire, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        minHeight:      '100%',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '48px 28px 32px',
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* ── Background ambient glow ─────────────────────────────────────────── */}
      <motion.div
        variants={glowV}
        initial="hidden"
        animate="show"
        aria-hidden
        style={{
          position:      'absolute',
          top:           '10%',
          left:          '50%',
          transform:     'translateX(-50%)',
          width:         '340px',
          height:        '340px',
          borderRadius:  '50%',
          background:    'radial-gradient(circle, rgba(201,168,76,0.13) 0%, rgba(201,168,76,0.06) 40%, transparent 70%)',
          filter:        'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Decorative radiating lines ──────────────────────────────────────── */}
      <motion.div
        variants={glowV}
        initial="hidden"
        animate="show"
        aria-hidden
        style={{
          position:     'absolute',
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%, -60%)',
          width:        '360px',
          height:       '360px',
          pointerEvents: 'none',
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            style={{
              position:        'absolute',
              top:             '50%',
              left:            '50%',
              width:           '1px',
              height:          '180px',
              background:      'linear-gradient(to top, transparent, rgba(201,168,76,0.18))',
              transformOrigin: 'top center',
              transform:       `rotate(${i * 30}deg) translateX(-50%)`,
            }}
          />
        ))}
      </motion.div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <motion.div
        variants={containerV}
        initial="hidden"
        animate="show"
        style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          position:      'relative',
          zIndex:        1,
          textAlign:     'center',
          width:         '100%',
          maxWidth:      '340px',
        }}
      >
        {/* ── Seal icon ─────────────────────────────────────────────────── */}
        <motion.div
          variants={itemV}
          style={{
            position:      'relative',
            marginBottom:  '28px',
          }}
        >
          {/* Rotating outer ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            aria-hidden
            style={{
              position:     'absolute',
              inset:        '-3px',
              borderRadius: '50%',
              background:   'conic-gradient(from 0deg, #C9A84C, #F4A828, rgba(201,168,76,0.15) 45%, transparent 55%, rgba(201,168,76,0.15) 65%, #C9A84C)',
            }}
          />

          {/* Pulse ring */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
            style={{
              position:     'absolute',
              inset:        '-6px',
              borderRadius: '50%',
              border:       '1px solid rgba(201,168,76,0.4)',
              pointerEvents: 'none',
            }}
          />

          {/* Inner circle */}
          <div
            style={{
              width:          80,
              height:         80,
              borderRadius:   '50%',
              background:     'radial-gradient(circle at 36% 34%, #1c1810, #0a0806)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              border:         '1px solid rgba(201,168,76,0.3)',
              boxShadow:      '0 0 24px rgba(201,168,76,0.25)',
              position:       'relative',
            }}
          >
            <CheckCircle2
              size={34}
              strokeWidth={1.4}
              style={{
                color:  '#C9A84C',
                filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.7))',
              }}
            />
          </div>
        </motion.div>

        {/* ── Eyebrow label ─────────────────────────────────────────────── */}
        <motion.span
          variants={itemV}
          style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '9px',
            fontWeight:    600,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color:         'rgba(201,168,76,0.7)',
            marginBottom:  '12px',
            display:       'block',
          }}
        >
          Lexicon Complete
        </motion.span>

        {/* ── Heading ──────────────────────────────────────────────────── */}
        <motion.h1
          variants={itemV}
          className="lx-word"
          style={{
            fontSize:    '2.6rem',
            fontWeight:  600,
            fontStyle:   'italic',
            color:       'var(--color-lx-text-primary)',
            lineHeight:  1.1,
            margin:      '0 0 12px',
            textShadow:  '0 0 40px rgba(201,168,76,0.25)',
          }}
        >
          All Words Reviewed
        </motion.h1>

        {/* ── Separator ─────────────────────────────────────────────── */}
        <motion.div
          variants={itemV}
          aria-hidden
          style={{
            width:        '48px',
            height:       '1px',
            background:   'linear-gradient(to right, transparent, rgba(201,168,76,0.5), transparent)',
            margin:       '4px 0 16px',
          }}
        />

        {/* ── Subtext ─────────────────────────────────────────────────── */}
        <motion.p
          variants={itemV}
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '13px',
            fontWeight: 300,
            color:      'var(--color-lx-text-secondary)',
            lineHeight: 1.6,
            margin:     '0 0 28px',
            padding:    '0 8px',
          }}
        >
          You&apos;ve completed the entire vocabulary bank.
        </motion.p>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        <motion.div
          variants={itemV}
          style={{
            display:      'flex',
            gap:          '16px',
            marginBottom: '32px',
            width:        '100%',
          }}
        >
          {/* Mastered words stat */}
          <div
            style={{
              flex:           1,
              borderRadius:   '12px',
              padding:        '14px 16px',
              background:     'rgba(201,168,76,0.07)',
              border:         '1px solid rgba(201,168,76,0.2)',
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            '4px',
            }}
          >
            <Star
              size={14}
              strokeWidth={1.8}
              style={{ color: '#C9A84C' }}
              fill="currentColor"
            />
            <span
              className="lx-word"
              style={{
                fontSize:   '2rem',
                fontWeight: 700,
                lineHeight: 1,
                color:      '#C9A84C',
              }}
            >
              {masteredWords}
            </span>
            <span
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '10px',
                fontWeight: 500,
                color:      'var(--color-lx-text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Words
            </span>
          </div>

          {/* Total points stat */}
          <div
            style={{
              flex:           1,
              borderRadius:   '12px',
              padding:        '14px 16px',
              background:     'rgba(214,43,56,0.07)',
              border:         '1px solid rgba(214,43,56,0.18)',
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            '4px',
            }}
          >
            <Zap
              size={14}
              strokeWidth={1.8}
              style={{ color: 'var(--color-lx-accent-red)' }}
            />
            <span
              className="lx-word"
              style={{
                fontSize:   '2rem',
                fontWeight: 700,
                lineHeight: 1,
                color:      'var(--color-lx-accent-red)',
              }}
            >
              {totalPoints.toLocaleString()}
            </span>
            <span
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '10px',
                fontWeight: 500,
                color:      'var(--color-lx-text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Points
            </span>
          </div>

          {/* Total words in bank */}
          <div
            style={{
              flex:           1,
              borderRadius:   '12px',
              padding:        '14px 16px',
              background:     'var(--color-lx-elevated)',
              border:         '1px solid var(--color-lx-border)',
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            '4px',
            }}
          >
            <CheckCircle2
              size={14}
              strokeWidth={1.8}
              style={{ color: 'var(--color-lx-success)' }}
            />
            <span
              className="lx-word"
              style={{
                fontSize:   '2rem',
                fontWeight: 700,
                lineHeight: 1,
                color:      'var(--color-lx-text-primary)',
              }}
            >
              {totalWords}
            </span>
            <span
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '10px',
                fontWeight: 500,
                color:      'var(--color-lx-text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Total
            </span>
          </div>
        </motion.div>

        {/* ── Primary CTA: Practice Mode ──────────────────────────────── */}
        <motion.button
          variants={itemV}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/vocab/practice')}
          style={{
            width:         '100%',
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'center',
            gap:           '8px',
            padding:       '15px 24px',
            borderRadius:  '14px',
            background:    'linear-gradient(135deg, rgba(201,168,76,0.2) 0%, rgba(201,168,76,0.08) 100%)',
            border:        '1px solid rgba(201,168,76,0.4)',
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '14px',
            fontWeight:    600,
            color:         '#C9A84C',
            cursor:        'pointer',
            marginBottom:  '12px',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(201,168,76,0.28) 0%, rgba(201,168,76,0.14) 100%)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(201,168,76,0.2) 0%, rgba(201,168,76,0.08) 100%)';
          }}
        >
          Practice Mode
          <ArrowRight size={15} strokeWidth={2} />
        </motion.button>

        {/* ── Secondary CTA: View Profile ─────────────────────────────── */}
        <motion.button
          variants={itemV}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push('/vocab/profile')}
          style={{
            width:         '100%',
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'center',
            gap:           '8px',
            padding:       '13px 24px',
            borderRadius:  '14px',
            background:    'transparent',
            border:        '1px solid var(--color-lx-border)',
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '13px',
            fontWeight:    500,
            color:         'var(--color-lx-text-secondary)',
            cursor:        'pointer',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-lx-text-primary)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-lx-border)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-lx-text-secondary)';
          }}
        >
          View Profile
        </motion.button>
      </motion.div>
    </div>
  );
}
