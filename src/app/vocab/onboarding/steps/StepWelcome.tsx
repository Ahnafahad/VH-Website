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

        {/* Logo mark — transparent on dark with animated glow */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lexicore-logo.png"
            alt="LexiCore"
            style={{
              width: 80, height: 80,
              objectFit: 'contain',
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 2px 16px rgba(230,57,70,0.55)) drop-shadow(0 0 32px rgba(230,57,70,0.25))',
            }}
          />
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
          Master your first 100 words through adaptive flashcards, AI-powered quizzes, and daily streaks — built for IBA, BUP&nbsp;&amp; DU admissions.
        </p>
        <p
          className="text-xs"
          style={{
            color:      'var(--color-lx-text-muted)',
            fontFamily: "'Sora', sans-serif",
            maxWidth:   '22rem',
          }}
        >
          Start with 100 words, completely free — upgrade anytime for the full 800+ library.
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
          Let&apos;s show you around
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
