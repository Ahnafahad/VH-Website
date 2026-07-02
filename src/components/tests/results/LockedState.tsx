'use client';

import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1, scale: 1,
    transition: { type: 'spring' as const, stiffness: 70, damping: 16 },
  },
};

// Decorative gold seal SVG
function GoldSeal() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
    >
      {/* outer ring */}
      <circle cx="48" cy="48" r="44" stroke="var(--color-exam-gold)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
      {/* inner ring */}
      <circle cx="48" cy="48" r="34" stroke="var(--color-exam-gold)" strokeWidth="1" opacity="0.4" />
      {/* solid centre */}
      <circle cx="48" cy="48" r="24" fill="var(--color-exam-gold)" opacity="0.12" />
      {/* lock body */}
      <rect x="37" y="46" width="22" height="16" rx="3" fill="var(--color-exam-gold)" opacity="0.9" />
      {/* lock shackle */}
      <path d="M41 46v-5a7 7 0 0114 0v5" stroke="var(--color-exam-gold)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9" />
      {/* keyhole */}
      <circle cx="48" cy="53" r="2.5" fill="var(--color-exam-base)" />
      <rect x="47" y="55" width="2" height="4" rx="1" fill="var(--color-exam-base)" />
    </svg>
  );
}

export default function LockedState() {
  return (
    <div className="min-h-screen bg-[var(--color-exam-base)] flex items-center justify-center px-6">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="text-center max-w-sm"
      >
        {/* Glow halo */}
        <div className="relative mx-auto w-24 h-24 mb-8">
          <div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: 'var(--color-exam-glow-gold)', transform: 'scale(1.4)' }}
          />
          <div className="relative z-10">
            <GoldSeal />
          </div>
        </div>

        <p className="text-[var(--color-exam-gold)] text-xs tracking-[0.2em] uppercase mb-3 font-medium">
          Results Sealed
        </p>
        <h1 className="text-[var(--color-exam-ink)] text-2xl font-bold mb-3">
          The test window is still open
        </h1>
        <p className="text-[var(--color-exam-ink-muted)] text-sm leading-relaxed">
          Results are sealed until the test window closes. They&apos;ll
          be published once every student&apos;s time is up.
        </p>

        {/* Decorative rule */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--color-exam-border)]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-exam-gold)] opacity-60" />
          <div className="flex-1 h-px bg-[var(--color-exam-border)]" />
        </div>
      </motion.div>
    </div>
  );
}
