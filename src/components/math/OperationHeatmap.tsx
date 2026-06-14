'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { OPERATIONS, TIER_LIST, TIER_LABEL } from '@/lib/math/constants';
import type { MathOperation } from '@/lib/db/schema';
import type { Tier } from '@/lib/math/constants';
import type { DashboardHeatCell } from './dashboard-types';

export interface OperationHeatmapProps {
  heatmap: DashboardHeatCell[];
}

const OP_GLYPH: Record<MathOperation, string> = {
  addition:       '+',
  subtraction:    '−',
  multiplication: '×',
  division:       '÷',
};

const OP_SHORT: Record<MathOperation, string> = {
  addition:       'Add',
  subtraction:    'Sub',
  multiplication: 'Mult',
  division:       'Div',
};

function cellColor(cell: DashboardHeatCell): { bg: string; ring: string; glyph: string } {
  if (cell.attempts === 0) {
    return {
      bg:    'transparent',
      ring:  'var(--color-math-border)',
      glyph: 'var(--color-math-ink-faint)',
    };
  }
  // Lerp accuracy (0..1) to gold intensity.
  const alpha = Math.max(0.08, Math.min(0.72, cell.accuracy));
  return {
    bg:    `color-mix(in oklab, var(--color-math-accent-gold) ${Math.round(alpha * 100)}%, transparent)`,
    ring:  'color-mix(in oklab, var(--color-math-accent-gold) 40%, transparent)',
    glyph: 'var(--color-math-ink)',
  };
}

export function OperationHeatmap({ heatmap }: OperationHeatmapProps) {
  const [hover, setHover] = useState<DashboardHeatCell | null>(null);

  const cellByKey = new Map(heatmap.map((c) => [`${c.operation}|${c.tier}`, c]));

  const sampled = heatmap.reduce((n, c) => n + c.attempts, 0);

  return (
    <section
      className="relative rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-6 sm:p-8 math-card-shadow overflow-hidden"
      aria-labelledby="heatmap-title"
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-2">
            Figure I
          </div>
          <h3 id="heatmap-title" className="font-heading text-2xl sm:text-3xl font-light text-[var(--color-math-ink)] tracking-[-0.01em]">
            Accuracy by terrain
          </h3>
        </div>
        <p className="max-w-xs font-sans text-xs text-[var(--color-math-ink-muted)]">
          Gold intensity = accuracy. Dashed cells — yet untested. Based on last {sampled || 0} answers.
        </p>
      </header>

      <div className="relative">
        {/* Column labels (tiers) */}
        <div className="grid grid-cols-[80px_repeat(4,1fr)] gap-2 mb-2">
          <div />
          {TIER_LIST.map((t) => (
            <div
              key={t}
              className="font-sans text-[10px] tracking-[0.2em] uppercase text-[var(--color-math-ink-faint)] text-center"
            >
              {TIER_LABEL[t]}
            </div>
          ))}
        </div>

        {/* Rows: operations */}
        <div className="space-y-2">
          {OPERATIONS.map((op, rowIdx) => (
            <motion.div
              key={op}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * rowIdx, duration: 0.4 }}
              className="grid grid-cols-[80px_repeat(4,1fr)] gap-2 items-center"
            >
              <div className="flex items-center gap-2">
                <span className="math-digit text-xl font-light text-[var(--color-math-accent-gold)] w-5 text-center">
                  {OP_GLYPH[op]}
                </span>
                <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[var(--color-math-ink-muted)]">
                  {OP_SHORT[op]}
                </span>
              </div>

              {TIER_LIST.map((tier) => {
                const cell = cellByKey.get(`${op}|${tier}`)!;
                const c = cellColor(cell);
                const isEmpty = cell.attempts === 0;
                return (
                  <motion.button
                    key={tier}
                    type="button"
                    onPointerEnter={() => setHover(cell)}
                    onPointerLeave={() => setHover((h) => (h === cell ? null : h))}
                    onFocus={() => setHover(cell)}
                    onBlur={() => setHover((h) => (h === cell ? null : h))}
                    aria-label={
                      isEmpty
                        ? `${OP_SHORT[op]} at ${TIER_LABEL[tier]} — no attempts yet`
                        : `${OP_SHORT[op]} at ${TIER_LABEL[tier]} — ${Math.round(cell.accuracy * 100)}% over ${cell.attempts} attempts`
                    }
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    className="relative aspect-[5/3] rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-math-accent-gold)]/60"
                    style={{
                      background:   c.bg,
                      borderWidth:  1,
                      borderStyle:  isEmpty ? 'dashed' : 'solid',
                      borderColor:  c.ring,
                    }}
                  >
                    <span
                      className="math-digit absolute inset-0 flex items-center justify-center font-light text-xs sm:text-sm"
                      style={{ color: c.glyph }}
                    >
                      {isEmpty ? '—' : `${Math.round(cell.accuracy * 100)}`}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          ))}
        </div>

        {/* Hover/focus detail */}
        <div
          role="status"
          aria-live="polite"
          className="mt-6 min-h-[2.5rem] flex items-baseline gap-4 border-t border-[var(--color-math-border)] pt-4"
        >
          <AnimatePresence mode="wait">
            {hover ? (
              <motion.div
                key={`${hover.operation}-${hover.tier}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
                className="flex flex-wrap items-baseline gap-4 font-sans text-xs text-[var(--color-math-ink-muted)]"
              >
                <span className="font-heading text-sm text-[var(--color-math-ink)]">
                  {OP_SHORT[hover.operation]} · {TIER_LABEL[hover.tier]}
                </span>
                {hover.attempts > 0 ? (
                  <>
                    <span>
                      <span className="math-digit text-[var(--color-math-accent-gold)]">
                        {Math.round(hover.accuracy * 100)}%
                      </span>{' '}
                      accuracy
                    </span>
                    <span>
                      <span className="math-digit text-[var(--color-math-ink)]">
                        {hover.correct}
                      </span>
                      {' / '}
                      <span className="math-digit text-[var(--color-math-ink)]">
                        {hover.attempts}
                      </span>{' '}
                      correct
                    </span>
                  </>
                ) : (
                  <span className="italic text-[var(--color-math-ink-faint)]">
                    No attempts yet — start a game at this tier.
                  </span>
                )}
              </motion.div>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-sans text-xs text-[var(--color-math-ink-faint)]"
              >
                Hover a cell for the breakdown.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
