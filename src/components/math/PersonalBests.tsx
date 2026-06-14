'use client';

import React from 'react';
import { motion } from 'motion/react';
import { NumberTicker } from '@/components/ui/number-ticker';
import { CornerBrackets } from './decoratives';
import type { DashboardBests } from './dashboard-types';

export interface PersonalBestsProps {
  bests: DashboardBests;
}

interface StatConfig {
  label:       string;
  value:       number;
  format?:     'int' | 'percent' | 'ms';
  suffix?:     string;
  marginalRoman: string;
  tone:        'gold' | 'violet';
}

export function PersonalBests({ bests }: PersonalBestsProps) {
  const stats: StatConfig[] = [
    { label: 'Best score',       value: bests.bestScore,              marginalRoman: 'I',   tone: 'gold'   },
    { label: 'Best accuracy',    value: bests.bestAccuracy, format: 'percent', marginalRoman: 'II',  tone: 'gold'   },
    { label: 'Fastest avg',      value: bests.fastestAvgMs ?? 0, format: 'ms', marginalRoman: 'III', tone: 'violet' },
    { label: 'Games completed',  value: bests.totalGames,             marginalRoman: 'IV',  tone: 'gold'   },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((s, i) => (
        <motion.article
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-5 sm:p-6 math-card-shadow"
        >
          <CornerBrackets accent={s.tone === 'violet' ? 'violet' : 'gold'} />

          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-3 font-heading text-[10px] tracking-[0.3em] text-[var(--color-math-ink-faint)]/60"
          >
            {s.marginalRoman}
          </span>

          <div className="font-sans text-[9px] sm:text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-ink-faint)] mb-2">
            {s.label}
          </div>

          {s.value > 0 ? (
            <div className="math-digit flex items-baseline gap-1 font-light leading-none">
              <NumberTicker
                value={s.value}
                className={`math-digit text-[clamp(1.75rem,4.5vw,2.5rem)] text-[var(--color-math-ink)] ${s.tone === 'violet' ? 'text-[var(--color-math-accent-violet)]' : ''}`}
              />
              {s.format === 'percent' && (
                <span className="text-lg text-[var(--color-math-ink-muted)]">%</span>
              )}
              {s.format === 'ms' && (
                <span className="text-sm text-[var(--color-math-ink-muted)]">ms</span>
              )}
            </div>
          ) : (
            <div className="math-digit text-[clamp(1.75rem,4.5vw,2.5rem)] font-light leading-none text-[var(--color-math-ink-faint)]">
              —
            </div>
          )}

          {s.value > 0 && (
            <div className="mt-3 font-sans text-[10px] text-[var(--color-math-ink-muted)]">
              {s.format === 'percent' ? 'single session' : s.format === 'ms' ? 'per answer' : ' '}
            </div>
          )}
        </motion.article>
      ))}
    </div>
  );
}
