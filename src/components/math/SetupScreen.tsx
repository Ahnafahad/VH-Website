'use client';

import React from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { OP_LABELS, TIME_OPTIONS } from '@/lib/math/constants';
import type { MathOperation } from '@/lib/db/schema';
import type { GameMode } from './types';
import { CornerBrackets, MarginalNumeral, SectionMark } from './decoratives';

export interface SetupScreenProps {
  selectedOps:   MathOperation[];
  difficulty:    GameMode;
  timeLimit:     number;
  onToggleOp:    (op: MathOperation) => void;
  onDifficulty:  (d: GameMode) => void;
  onTimeLimit:   (n: number) => void;
  onStart:       () => void;
  onLeaderboard: () => void;
}

const OP_GLYPH: Record<MathOperation, string> = {
  addition:       '+',
  subtraction:    '−',
  multiplication: '×',
  division:       '÷',
};

const TIER_COPY: Record<GameMode, { label: string; hint: string }> = {
  easy:    { label: 'Easy',    hint: 'Single digits — warm-up drills.' },
  medium:  { label: 'Medium',  hint: 'Mixed ranges — the honest test.' },
  hard:    { label: 'Hard',    hint: 'Double digits — compose carries mentally.' },
  extreme: { label: 'Extreme', hint: 'Addition/subtraction to 200 · multiplication/division to 30×30.' },
  auto:    { label: 'Auto ✦',  hint: 'Adaptive. Difficulty tunes to you — target 75% accuracy.' },
};

const TIERS: GameMode[] = ['easy', 'medium', 'hard', 'extreme', 'auto'];

export function SetupScreen(props: SetupScreenProps) {
  const { selectedOps, difficulty, timeLimit, onToggleOp, onDifficulty, onTimeLimit, onStart, onLeaderboard } = props;

  return (
    <div className="relative mx-auto max-w-[960px] px-6 sm:px-10 lg:px-16 pt-20 sm:pt-28 pb-28">
      <SectionMark chapter="Chapter Zero" title="Mental Math" />

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10 font-heading text-[clamp(2.75rem,7.5vw,6rem)] leading-[0.92] tracking-[-0.02em] font-light text-[var(--color-math-ink)]"
      >
        Train your mind.
        <em className="block font-extralight italic text-[var(--color-math-accent-gold)]">beat the clock.</em>
      </motion.h1>

      <p className="mt-6 max-w-md font-sans text-base leading-relaxed text-[var(--color-math-ink-muted)]">
        Pick your operations, your difficulty, and your duration. The leaderboard tracks the sharpest minds.
      </p>

      {/* Configuration card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-12 relative rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-8 sm:p-12 overflow-hidden math-card-shadow"
      >
        <CornerBrackets />
        <MarginalNumeral>00</MarginalNumeral>

        <div className="relative space-y-12">
          {/* Operations */}
          <section>
            <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-4">
              Operations
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(Object.entries(OP_LABELS) as [MathOperation, string][]).map(([key, label]) => {
                const active = selectedOps.includes(key);
                return (
                  <motion.button
                    key={key}
                    type="button"
                    onClick={() => onToggleOp(key)}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    className={[
                      'relative overflow-hidden rounded-xl border px-4 py-5 text-left transition-colors duration-300',
                      active
                        ? 'bg-[var(--color-math-elevated)] border-[var(--color-math-accent-gold)]/70 text-[var(--color-math-ink)] math-glow-gold'
                        : 'border-[var(--color-math-border)] text-[var(--color-math-ink-muted)] hover:border-[var(--color-math-accent-gold)]/40 hover:text-[var(--color-math-ink)]',
                    ].join(' ')}
                    aria-pressed={active}
                    aria-label={`${label} — ${active ? 'selected' : 'not selected'}`}
                  >
                    {active && <CornerBrackets />}
                    <div className="flex items-baseline justify-between">
                      <span className="math-digit text-3xl leading-none text-[var(--color-math-accent-gold)]">
                        {OP_GLYPH[key]}
                      </span>
                      {active && (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-math-accent-gold)] text-[var(--color-math-base)]">
                          <Check size={9} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="mt-4 font-sans text-xs tracking-wide text-[var(--color-math-ink-muted)]">
                      {label.split(' ')[0]}
                    </div>
                  </motion.button>
                );
              })}
            </div>
            {selectedOps.length > 1 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 flex items-center gap-2 font-sans text-xs text-[var(--color-math-accent-gold)]"
              >
                <Sparkles size={12} />
                Multi-operation bonus active — +30% points
              </motion.p>
            )}
          </section>

          {/* Difficulty */}
          <section>
            <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-4">
              Difficulty
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {TIERS.map((t) => {
                const active = difficulty === t;
                const isAuto = t === 'auto';
                return (
                  <motion.button
                    key={t}
                    type="button"
                    onClick={() => onDifficulty(t)}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    className={[
                      'relative rounded-lg border px-4 py-3 text-left transition-colors duration-300',
                      active
                        ? isAuto
                          ? 'border-[var(--color-math-accent-violet)]/70 bg-[var(--color-math-elevated)] text-[var(--color-math-ink)]'
                          : 'border-[var(--color-math-accent-gold)]/70 bg-[var(--color-math-elevated)] text-[var(--color-math-ink)]'
                        : 'border-[var(--color-math-border)] text-[var(--color-math-ink-muted)] hover:border-[var(--color-math-accent-gold)]/40 hover:text-[var(--color-math-ink)]',
                    ].join(' ')}
                    aria-pressed={active}
                  >
                    <div
                      className={`font-heading text-lg font-light ${
                        active
                          ? isAuto
                            ? 'text-[var(--color-math-accent-violet)]'
                            : 'text-[var(--color-math-accent-gold)]'
                          : ''
                      }`}
                    >
                      {TIER_COPY[t].label}
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <p className="mt-3 font-sans text-xs text-[var(--color-math-ink-muted)] min-h-[1.5rem]">
              {TIER_COPY[difficulty].hint}
            </p>
          </section>

          {/* Time limit */}
          <section>
            <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-4">
              Duration
            </div>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((o) => {
                const active = timeLimit === o.value;
                return (
                  <motion.button
                    key={o.value}
                    type="button"
                    onClick={() => onTimeLimit(o.value)}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    className={[
                      'rounded-full border px-4 py-2 font-sans text-xs tracking-wide transition-colors duration-300',
                      active
                        ? 'border-[var(--color-math-accent-gold)]/70 bg-[var(--color-math-accent-gold)]/10 text-[var(--color-math-accent-gold)]'
                        : 'border-[var(--color-math-border)] text-[var(--color-math-ink-muted)] hover:border-[var(--color-math-accent-gold)]/40 hover:text-[var(--color-math-ink)]',
                    ].join(' ')}
                    aria-pressed={active}
                  >
                    {o.label}
                  </motion.button>
                );
              })}
            </div>
          </section>
        </div>
      </motion.div>

      {/* CTA row */}
      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <motion.button
          type="button"
          onClick={onStart}
          disabled={selectedOps.length === 0}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          className="group/cta relative inline-flex items-center gap-3 rounded-full bg-[var(--color-math-accent-gold)] text-[var(--color-math-base)] px-10 py-4 font-sans text-sm font-medium tracking-wide transition-all duration-500 disabled:opacity-30 hover:bg-[var(--color-math-accent-gold-bright)] hover:shadow-[0_18px_50px_-14px_var(--color-math-glow-gold)]"
        >
          <span className="relative overflow-hidden">
            <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:-translate-y-full">
              Start challenge
            </span>
            <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-y-0">
              Start challenge
            </span>
          </span>
          <ArrowRight size={16} className="transition-transform group-hover/cta:translate-x-0.5" />
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
