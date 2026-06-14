'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Target } from 'lucide-react';
import { OP_LABELS, TIER_LABEL } from '@/lib/math/constants';
import { CornerBrackets, MarginalNumeral } from './decoratives';
import type { DashboardWeakSpot } from './dashboard-types';

export interface WeakSpotCardProps {
  weakSpot: DashboardWeakSpot | null;
  onStartDrill: (op: DashboardWeakSpot['operation'], tier: DashboardWeakSpot['tier']) => void;
}

export function WeakSpotCard({ weakSpot, onStartDrill }: WeakSpotCardProps) {
  if (!weakSpot) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-6 sm:p-8 math-card-shadow">
        <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-3">
          Focus
        </div>
        <h3 className="font-heading text-xl sm:text-2xl font-light text-[var(--color-math-ink)] mb-2">
          Not enough data yet.
        </h3>
        <p className="font-sans text-sm text-[var(--color-math-ink-muted)]">
          Play a few more sessions to reveal your weakest terrain.
        </p>
      </section>
    );
  }

  const accPct = Math.round(weakSpot.accuracy * 100);
  const opWord = OP_LABELS[weakSpot.operation].split(' ')[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-[var(--color-math-accent-violet)]/40 bg-[var(--color-math-surface)]/90 backdrop-blur-sm p-6 sm:p-8 math-card-shadow"
      aria-labelledby="weakspot-title"
    >
      <CornerBrackets accent="violet" />
      <MarginalNumeral>✕</MarginalNumeral>

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-violet)] mb-3">
            <Target size={11} /> Focus
          </div>

          <h3 id="weakspot-title" className="font-heading text-2xl sm:text-3xl font-light text-[var(--color-math-ink)] tracking-[-0.01em]">
            Drill <em className="font-extralight italic text-[var(--color-math-accent-violet)]">{opWord}</em> at{' '}
            <em className="font-extralight italic text-[var(--color-math-accent-gold)]">{TIER_LABEL[weakSpot.tier]}</em>
          </h3>

          <p className="mt-3 font-sans text-sm text-[var(--color-math-ink-muted)]">
            Holding at{' '}
            <span className="math-digit text-[var(--color-math-ink)]">{accPct}%</span> across{' '}
            <span className="math-digit text-[var(--color-math-ink)]">{weakSpot.attempts}</span> recent attempts. A targeted session will tune the engine.
          </p>
        </div>

        <motion.button
          type="button"
          onClick={() => onStartDrill(weakSpot.operation, weakSpot.tier)}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="group/drill inline-flex items-center gap-2 rounded-full bg-[var(--color-math-accent-violet)] text-[var(--color-math-ink)] px-6 py-3 font-sans text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:shadow-[0_10px_30px_-10px_var(--color-math-glow-violet)]"
        >
          Start drill
          <ArrowRight size={13} className="transition-transform group-hover/drill:translate-x-0.5" />
        </motion.button>
      </div>
    </motion.section>
  );
}
