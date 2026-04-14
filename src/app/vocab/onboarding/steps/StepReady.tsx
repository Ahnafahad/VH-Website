'use client';

import { motion } from 'framer-motion';

interface Props {
  saving: boolean;
  onFinish: () => void;
}

export default function StepReady({ saving, onFinish }: Props) {
  return (
    <div className="relative flex flex-col items-center gap-8 overflow-hidden py-8 text-center">
      {/* Sparkle ring effect */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-12 h-32 w-32 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(230,57,70,0.2) 0%, transparent 60%)',
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Animated check circle */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring' as const, stiffness: 300, damping: 20, delay: 0.2 }}
        className="relative flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(135deg, rgba(46,204,113,0.15) 0%, rgba(46,204,113,0.05) 100%)',
          border: '2px solid var(--color-lx-success)',
        }}
      >
        <motion.svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-lx-success)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.polyline
            points="20 6 9 17 4 12"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </motion.svg>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-3"
      >
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: '2.4rem',
            fontWeight: 700,
            fontStyle: 'italic',
            lineHeight: 1.1,
            color: 'var(--color-lx-text-primary)',
            margin: 0,
          }}
        >
          You&apos;re ready.
        </h1>
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.9rem',
            color: 'var(--color-lx-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          Your vocabulary journey starts now.
        </p>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full"
      >
        {/* Pulsing glow */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl blur-xl"
          style={{ background: 'rgba(230,57,70,0.4)' }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onFinish}
          disabled={saving}
          className="relative w-full rounded-xl py-4 text-lg font-semibold text-white disabled:opacity-60 lx-glow-red"
          style={{
            background: 'linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)',
            fontFamily: "'Sora', sans-serif",
          }}
        >
          {saving ? 'Setting up...' : 'Start Learning'}
        </motion.button>
      </motion.div>

      {/* Help hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: '0.68rem',
          color: 'var(--color-lx-text-muted)',
          fontStyle: 'italic',
        }}
      >
        You can revisit this tour anytime from the Help screen.
      </motion.p>

      {/* Grain overlay */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ opacity: 0.015 }}
      >
        <filter id="grain-ready">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-ready)" />
      </svg>
    </div>
  );
}
