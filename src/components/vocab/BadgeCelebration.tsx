'use client';

/**
 * BadgeCelebration — T28
 *
 * Full-screen portal overlay celebrating a newly earned badge.
 * Aesthetic: Ceremonial Revelation — an ancient seal breaking open.
 *
 * Props:
 *   badge      — the EarnedBadge to celebrate
 *   onDismiss  — called when the user collects or auto-dismiss fires
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, type Variants } from 'framer-motion';
import type { EarnedBadge } from '@/lib/vocab/badges/checker';
import {
  Star,
  Flame,
  Shield,
  Target,
  BookOpen,
  Crosshair,
  Zap,
  Layers,
  TrendingUp,
  Calendar,
  RefreshCw,
  Compass,
  Database,
  Brain,
  Trophy,
  Award,
  CheckCircle2,
  Crown,
  Cpu,
  Sparkles,
  Infinity as InfinityIcon,
  type LucideIcon,
} from 'lucide-react';

// ─── Badge → icon mapping ─────────────────────────────────────────────────────

const BADGE_ICONS: Record<string, LucideIcon> = {
  first_step:          Star,
  quiz_starter:        BookOpen,
  on_a_roll:           Flame,
  perfectionist:       Target,
  week_warrior:        Shield,
  sharp_shooter:       Crosshair,
  unit_slayer:         Zap,
  analogy_apprentice:  Layers,
  halfway_there:       TrendingUp,
  streak_keeper:       Calendar,
  review_regular:      RefreshCw,
  speed_demon:         Zap,
  leaderboard_climber: TrendingUp,
  vocab_explorer:      Compass,
  the_800_club:        Database,
  analogy_master:      Brain,
  unit_conqueror:      Trophy,
  review_legend:       Award,
  completionist:       CheckCircle2,
  leaderboard_legend:  Crown,
  question_machine:    Cpu,
  flawless_run:        Sparkles,
  word_sovereign:      Crown,
  immortal:            InfinityIcon,
};

// ─── Colour helpers ───────────────────────────────────────────────────────────

/** Gold for long-term / ultimate; crimson otherwise. */
function accentFor(category: EarnedBadge['category']): string {
  return category === 'long_term' || category === 'ultimate'
    ? '#F4A828'
    : '#E63946';
}

// ─── Animation variants ───────────────────────────────────────────────────────

const overlayV: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:   { opacity: 0, transition: { duration: 0.28, ease: 'easeIn' } },
};

const bloomV: Variants = {
  hidden: { scale: 0.3, opacity: 0 },
  show:   { scale: 1,   opacity: 1, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
  exit:   { scale: 1.3, opacity: 0, transition: { duration: 0.25 } },
};

const raysV: Variants = {
  hidden: { opacity: 0, scale: 0.5, rotate: -15 },
  show: {
    opacity: 1, scale: 1, rotate: 0,
    transition: { duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] },
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
};

const medallionV: Variants = {
  hidden: { scale: 0, rotate: -25, opacity: 0 },
  show: {
    scale: 1, rotate: 0, opacity: 1,
    transition: { type: 'spring' as const, stiffness: 280, damping: 20, delay: 0.18 },
  },
  exit: { scale: 0.6, opacity: 0, transition: { duration: 0.18 } },
};

const labelV: Variants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4,  delay: 0.42, ease: 'easeOut' } },
  exit:   { opacity: 0,        transition: { duration: 0.12 } },
};

const nameV: Variants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.48, delay: 0.54, ease: [0.16, 1, 0.3, 1] } },
  exit:   { opacity: 0,        transition: { duration: 0.12 } },
};

const descV: Variants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4,  delay: 0.65, ease: 'easeOut' } },
  exit:   { opacity: 0,        transition: { duration: 0.12 } },
};

const ctaV: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.80, ease: 'easeOut' } },
  exit:   { opacity: 0,        transition: { duration: 0.12 } },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  badge:     EarnedBadge;
  onDismiss: () => void;
}

export default function BadgeCelebration({ badge, onDismiss }: Props) {
  const [mounted, setMounted] = useState(false);
  const medallionRef          = useRef<HTMLDivElement>(null);

  const ultimate   = badge.category === 'ultimate';
  const accent     = accentFor(badge.category);
  const Icon       = BADGE_ICONS[badge.id] ?? Star;
  const dismissMs  = ultimate ? 6000 : 4000;

  // ── SSR guard ──────────────────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ── ESC key dismiss (accessibility) ──────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mounted, onDismiss]);

  // ── Confetti + auto-dismiss ────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    // Fire confetti after medallion pop (matches spring animation landing ~600ms)
    const confettiTimer = setTimeout(async () => {
      try {
        const el   = medallionRef.current;
        const rect = el?.getBoundingClientRect();
        const cx   = rect ? (rect.left + rect.width  / 2) / window.innerWidth  : 0.5;
        const cy   = rect ? (rect.top  + rect.height / 2) / window.innerHeight : 0.38;

        const { default: confetti } = await import('canvas-confetti');

        const colors = ultimate
          ? ['#F4A828', '#FFD700', '#FFF8DC', '#E63946', '#ffffff']
          : ['#E63946', '#FF6B6B', '#F4A828', '#ffffff', '#FFDDE1'];

        confetti({
          particleCount: ultimate ? 170 : 90,
          spread:        ultimate ? 85  : 65,
          origin:        { x: cx, y: cy },
          colors,
          gravity:       0.75,
          scalar:        ultimate ? 1.45 : 1.1,
          ticks:         230,
          startVelocity: ultimate ? 32  : 24,
        });

        // Second burst for ultimates
        if (ultimate) {
          setTimeout(() => {
            confetti({
              particleCount: 80,
              spread:        120,
              origin:        { x: cx, y: cy },
              colors,
              gravity:       0.6,
              scalar:        1.2,
              ticks:         200,
              startVelocity: 18,
            });
          }, 250);
        }
      } catch {
        // confetti failure is non-critical — silently ignore
      }
    }, 580);

    const dismissTimer = setTimeout(onDismiss, dismissMs);

    return () => {
      clearTimeout(confettiTimer);
      clearTimeout(dismissTimer);
    };
  }, [mounted, dismissMs, onDismiss, ultimate]);

  if (!mounted) return null;

  const content = (
    <motion.div
      key="badge-overlay"
      variants={overlayV}
      initial="hidden"
      animate="show"
      exit="exit"
      onClick={onDismiss}
      aria-modal="true"
      role="dialog"
      aria-label={`Achievement unlocked: ${badge.name}`}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          9999,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'rgba(7, 7, 9, 0.97)',
        backdropFilter:  'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding:         '24px',
        cursor:          'pointer',
      }}
    >
      {/* ── Radial glow bloom ───────────────────────────────────────── */}
      <motion.div
        variants={bloomV}
        initial="hidden"
        animate="show"
        exit="exit"
        aria-hidden
        style={{
          position:     'absolute',
          width:        '620px',
          height:       '620px',
          borderRadius: '50%',
          background:   `radial-gradient(circle at center,
            ${accent}1a 0%,
            ${accent}0d 38%,
            transparent 68%
          )`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Decorative seal rays ─────────────────────────────────────── */}
      <motion.div
        variants={raysV}
        initial="hidden"
        animate="show"
        exit="exit"
        aria-hidden
        style={{
          position:     'absolute',
          width:        '400px',
          height:       '400px',
          pointerEvents:'none',
        }}
      >
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            style={{
              position:        'absolute',
              top:             '50%',
              left:            '50%',
              width:           '1px',
              height:          '200px',
              background:      `linear-gradient(to top, transparent, ${accent}28)`,
              transformOrigin: 'top center',
              transform:       `rotate(${i * 22.5}deg) translateX(-50%)`,
            }}
          />
        ))}
      </motion.div>

      {/* ── Corner ornaments ──────────────────────────────────────────── */}
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(pos => (
        <motion.div
          key={pos}
          variants={raysV}
          initial="hidden"
          animate="show"
          exit="exit"
          aria-hidden
          style={{
            position:  'fixed',
            ...(pos.includes('top')    ? { top:    24 } : { bottom: 24 }),
            ...(pos.includes('left')   ? { left:   24 } : { right:  24 }),
            width:     28,
            height:    28,
            borderTop:    pos.includes('top')    ? `1px solid ${accent}30` : 'none',
            borderBottom: pos.includes('bottom') ? `1px solid ${accent}30` : 'none',
            borderLeft:   pos.includes('left')   ? `1px solid ${accent}30` : 'none',
            borderRight:  pos.includes('right')  ? `1px solid ${accent}30` : 'none',
            pointerEvents:'none',
          }}
        />
      ))}

      {/* ── Card (stops click-through) ──────────────────────────────── */}
      <motion.div
        onClick={e => e.stopPropagation()}
        style={{
          position:      'relative',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          maxWidth:      '340px',
          width:         '100%',
          textAlign:     'center',
        }}
      >
        {/* ── Medallion ──────────────────────────────────────────────── */}
        <motion.div
          ref={medallionRef}
          variants={medallionV}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{
            position:     'relative',
            width:        128,
            height:       128,
            marginBottom: 30,
          }}
        >
          {/* Rotating conic-gradient ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: ultimate ? 3.5 : 5.5,
              repeat:   Infinity,
              ease:     'linear',
            }}
            aria-hidden
            style={{
              position:     'absolute',
              inset:        0,
              borderRadius: '50%',
              background:   ultimate
                ? `conic-gradient(from 0deg, #F4A828, #FFD700, #E63946 40%, transparent 55%, transparent 65%, #F4A82880, #F4A828)`
                : `conic-gradient(from 0deg, ${accent}, #FF6B6B, transparent 42%, transparent 58%, ${accent}80, ${accent})`,
            }}
          />

          {/* Ambient glow ring */}
          <div
            aria-hidden
            style={{
              position:     'absolute',
              inset:        '3px',
              borderRadius: '50%',
              boxShadow:    `0 0 28px ${accent}55, 0 0 10px ${accent}35`,
              pointerEvents:'none',
            }}
          />

          {/* Inner dark circle */}
          <div
            style={{
              position:       'absolute',
              inset:          '5px',
              borderRadius:   '50%',
              background:     'radial-gradient(circle at 36% 34%, #1c1018, #08070b)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              border:         `1px solid ${accent}28`,
            }}
          >
            <Icon
              size={ultimate ? 44 : 38}
              color={accent}
              strokeWidth={1.4}
              style={{ filter: `drop-shadow(0 0 7px ${accent}88)` }}
            />
          </div>

          {/* Ultimate pulse ring */}
          {ultimate && (
            <motion.div
              animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
              style={{
                position:     'absolute',
                inset:        '-8px',
                borderRadius: '50%',
                border:       `1px solid ${accent}50`,
                pointerEvents:'none',
              }}
            />
          )}
        </motion.div>

        {/* ── "Achievement Unlocked" label ────────────────────────────── */}
        <motion.span
          variants={labelV}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '9px',
            fontWeight:    600,
            letterSpacing: '0.32em',
            color:         `${accent}bb`,
            textTransform: 'uppercase',
            marginBottom:  '10px',
            display:       'block',
          }}
        >
          {ultimate ? '✦  Ultimate Achievement  ✦' : 'Achievement Unlocked'}
        </motion.span>

        {/* ── Badge name ──────────────────────────────────────────────── */}
        <motion.h2
          variants={nameV}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   ultimate ? '38px' : '34px',
            fontWeight: 600,
            fontStyle:  'italic',
            color:      '#F8F4EE',
            lineHeight: 1.15,
            margin:     '0 0 14px',
            textShadow: `0 0 36px ${accent}38`,
          }}
        >
          {badge.name}
        </motion.h2>

        {/* Thin separator */}
        <motion.div
          variants={descV}
          initial="hidden"
          animate="show"
          exit="exit"
          aria-hidden
          style={{
            width:        '52px',
            height:       '1px',
            background:   `linear-gradient(to right, transparent, ${accent}55, transparent)`,
            marginBottom: '14px',
          }}
        />

        {/* ── Description ─────────────────────────────────────────────── */}
        <motion.p
          variants={descV}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '13px',
            fontWeight: 300,
            color:      'rgba(248, 244, 238, 0.50)',
            lineHeight: 1.65,
            margin:     '0 0 28px',
            padding:    '0 10px',
          }}
        >
          {badge.description}
        </motion.p>

        {/* ── Auto-dismiss progress bar ────────────────────────────────── */}
        <div
          aria-hidden
          style={{
            width:        '100%',
            height:       '2px',
            background:   'rgba(248, 244, 238, 0.07)',
            borderRadius: '1px',
            marginBottom: '22px',
            overflow:     'hidden',
          }}
        >
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: dismissMs / 1000, ease: 'linear' }}
            style={{
              height:          '100%',
              background:      `linear-gradient(to right, ${accent}, ${accent}70)`,
              transformOrigin: 'left center',
            }}
          />
        </div>

        {/* ── Collect button ───────────────────────────────────────────── */}
        <motion.button
          variants={ctaV}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={onDismiss}
          whileHover={{ scale: 1.04 }}
          whileTap={{  scale: 0.96 }}
          style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '11px',
            fontWeight:    600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color:         accent,
            background:    `${accent}12`,
            border:        `1px solid ${accent}38`,
            borderRadius:  '2px',
            padding:       '11px 36px',
            cursor:        'pointer',
            marginBottom:  '16px',
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget;
            btn.style.background   = `${accent}20`;
            btn.style.borderColor  = `${accent}70`;
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget;
            btn.style.background  = `${accent}12`;
            btn.style.borderColor = `${accent}38`;
          }}
        >
          Collect
        </motion.button>

        {/* ── Category label ───────────────────────────────────────────── */}
        <motion.span
          variants={ctaV}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '9px',
            fontWeight:    500,
            letterSpacing: '0.26em',
            color:         'rgba(248, 244, 238, 0.20)',
            textTransform: 'uppercase',
          }}
        >
          {badge.category.replace(/_/g, ' ')}
        </motion.span>
      </motion.div>
    </motion.div>
  );

  return createPortal(content, document.body);
}
