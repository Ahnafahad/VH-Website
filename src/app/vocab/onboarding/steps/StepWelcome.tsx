'use client';

import { motion } from 'framer-motion';

interface Props {
  userName: string;
  onNext:   () => void;
}

export default function StepWelcome({ userName, onNext }: Props) {
  const firstName = userName.split(' ')[0];

  return (
    <div className="relative flex flex-col items-center gap-10 overflow-hidden py-4 text-center">

      {/* ── Ambient blobs ─────────────────────────────────────── */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(230,57,70,0.18) 0%, transparent 70%)' }}
        animate={{ x: [0, 14, -8, 0], y: [0, -12, 7, 0], scale: [1, 1.08, 0.95, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-20 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(230,57,70,0.12) 0%, transparent 70%)' }}
        animate={{ x: [0, -16, 10, 0], y: [0, 10, -14, 0], scale: [1, 0.91, 1.07, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(244,168,40,0.07) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />

      {/* ── Logo mark ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center gap-3"
      >
        {/* Glow halo */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: 'rgba(230,57,70,0.28)' }}
          animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Icon container */}
        <div
          className="relative flex h-24 w-24 items-center justify-center rounded-3xl"
          style={{
            background: 'linear-gradient(135deg, rgba(230,57,70,0.18) 0%, rgba(230,57,70,0.04) 100%)',
            border:     '1px solid rgba(230,57,70,0.35)',
          }}
        >
          <svg width="54" height="54" viewBox="0 0 54 54" fill="none" aria-label="LexiCore logo">
            {/* L stroke */}
            <motion.path
              d="M10 9 L10 45 L31 45"
              stroke="var(--color-lx-accent-red)"
              strokeWidth="3.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
            />
            {/* x stroke */}
            <motion.path
              d="M33 25 L47 45 M47 25 L33 45"
              stroke="var(--color-lx-accent-gold)"
              strokeWidth="3.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.85 }}
            />
          </svg>
        </div>

        {/* Brand wordmark */}
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-xs font-semibold tracking-[0.32em] uppercase"
          style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
        >
          LexiCore
        </motion.span>
      </motion.div>

      {/* ── Greeting ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-3"
      >
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   '2.6rem',
            fontWeight: 700,
            fontStyle:  'italic',
            lineHeight: 1.1,
            color:      'var(--color-lx-text-primary)',
          }}
        >
          Welcome,<br />
          <span style={{ color: 'var(--color-lx-accent-red)' }}>{firstName}.</span>
        </h1>
        <p
          className="text-sm leading-relaxed"
          style={{
            color:      'var(--color-lx-text-secondary)',
            fontFamily: "'Sora', sans-serif",
            maxWidth:   '22rem',
          }}
        >
          Master 800+ words through adaptive flashcards, AI-powered quizzes, and daily streaks — built for IBA, BUP&nbsp;&amp; DU admissions.
        </p>
      </motion.div>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.95, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full"
      >
        {/* Pulsing glow */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[10px] blur-xl"
          style={{ background: 'rgba(230,57,70,0.45)' }}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          className="relative w-full rounded-[10px] py-4 text-lg font-semibold text-white lx-glow-red"
          style={{
            background: 'linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)',
            fontFamily: "'Sora', sans-serif",
          }}
        >
          Let's Begin
        </motion.button>
      </motion.div>

      {/* ── Grain overlay ─────────────────────────────────────── */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ opacity: 0.015 }}
      >
        <filter id="grain-welcome">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-welcome)" />
      </svg>
    </div>
  );
}
