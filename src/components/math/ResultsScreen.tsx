'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { OP_LABELS, TIME_OPTIONS } from '@/lib/math/constants';
import type { MathOperation } from '@/lib/db/schema';
import type { GameMode } from './types';
import { CornerBrackets, GoldHalo, MarginalNumeral, SectionMark } from './decoratives';

export interface ResultsScreenProps {
  score:         number;
  correct:       number;
  answered:      number;
  skipped:       number;
  accuracy:      number;
  selectedOps:   MathOperation[];
  difficulty:    GameMode;
  timeLimit:     number;
  onReplay:      () => void;
  onLeaderboard: () => void;
}

export function ResultsScreen(props: ResultsScreenProps) {
  const { score, correct, answered, skipped, accuracy, selectedOps, difficulty, timeLimit, onReplay, onLeaderboard } = props;

  const rows = [
    { label: 'Correct',    value: String(correct) },
    { label: 'Incorrect',  value: String(Math.max(0, answered - correct - skipped)) },
    { label: 'Skipped',    value: String(skipped) },
    { label: 'Accuracy',   value: `${accuracy}%` },
    { label: 'Operations', value: selectedOps.map((o) => OP_LABELS[o]).join(' · ') },
    { label: 'Difficulty', value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1) },
    { label: 'Duration',   value: TIME_OPTIONS.find((t) => t.value === timeLimit)?.label ?? '' },
  ];

  return (
    <div className="relative mx-auto max-w-3xl px-6 sm:px-10 pt-20 pb-28">
      <SectionMark chapter="Chapter End" title="Results" />

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10 font-heading text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.92] tracking-[-0.02em] font-light text-[var(--color-math-ink)]"
      >
        Challenge <em className="font-extralight italic text-[var(--color-math-accent-gold)]">complete.</em>
      </motion.h1>

      {/* Score hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-12 relative overflow-hidden rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-10 sm:p-14 text-center math-card-shadow"
      >
        <GoldHalo intensity={0.14} />
        <CornerBrackets />
        <MarginalNumeral>∑</MarginalNumeral>

        <div className="relative">
          <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-4">
            Final score
          </div>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 240, damping: 22 }}
            className="math-digit font-light leading-none tracking-[-0.03em] text-[clamp(4rem,14vw,8rem)] text-[var(--color-math-ink)]"
          >
            {score}
          </motion.div>
          <p className="mt-4 font-heading italic font-extralight text-lg text-[var(--color-math-ink-muted)]">
            {score > 0 ? 'Exceptional performance.' : 'Keep practicing to sharpen your edge.'}
          </p>
        </div>
      </motion.div>

      {/* Stats ledger */}
      <div className="mt-8 border-t border-[var(--color-math-border)] pt-6 space-y-3">
        {rows.map(({ label, value }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.04, duration: 0.4 }}
            className="flex items-baseline gap-4"
          >
            <span className="w-28 shrink-0 font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)]/80">
              {label}
            </span>
            <span className="font-heading text-lg font-light text-[var(--color-math-ink)]">{value}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <motion.button
          type="button"
          onClick={onReplay}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="group/cta inline-flex items-center gap-3 rounded-full bg-[var(--color-math-accent-gold)] text-[var(--color-math-base)] px-9 py-4 font-sans text-sm font-medium tracking-wide transition-all duration-500 hover:bg-[var(--color-math-accent-gold-bright)] hover:shadow-[0_18px_50px_-14px_var(--color-math-glow-gold)]"
        >
          <RotateCcw size={15} />
          <span className="relative overflow-hidden">
            <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:-translate-y-full">
              Play again
            </span>
            <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-y-0">
              Play again
            </span>
          </span>
        </motion.button>
        <button
          type="button"
          onClick={onLeaderboard}
          className="group inline-flex items-center gap-3 font-sans text-sm text-[var(--color-math-ink-muted)] hover:text-[var(--color-math-ink)] transition-colors"
        >
          <span className="h-px w-6 bg-current transition-all duration-300 group-hover:w-10" />
          View leaderboard
        </button>
      </div>
    </div>
  );
}
