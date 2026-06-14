'use client';

import React from 'react';
import { motion } from 'motion/react';
import { OP_LABELS, TIER_LABEL, bucketDifficulty } from '@/lib/math/constants';
import type { MathOperation } from '@/lib/db/schema';
import type { DashboardRecentSession } from './dashboard-types';

export interface RecentSessionsTableProps {
  sessions: DashboardRecentSession[];
}

const OP_GLYPH: Record<MathOperation, string> = {
  addition: '+', subtraction: '−', multiplication: '×', division: '÷',
};

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

function shortTime(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

export function RecentSessionsTable({ sessions }: RecentSessionsTableProps) {
  if (sessions.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-6 sm:p-8 math-card-shadow">
        <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-3">
          Ledger
        </div>
        <h3 className="font-heading text-2xl font-light text-[var(--color-math-ink)] mb-3">
          No sessions logged.
        </h3>
        <p className="font-sans text-sm text-[var(--color-math-ink-muted)]">
          Finished games appear here with their figures.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-6 sm:p-8 math-card-shadow"
      aria-labelledby="ledger-title"
    >
      <header className="mb-5 flex items-end justify-between">
        <div>
          <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-2">
            Ledger
          </div>
          <h3 id="ledger-title" className="font-heading text-2xl sm:text-3xl font-light text-[var(--color-math-ink)] tracking-[-0.01em]">
            Recent sessions
          </h3>
        </div>
      </header>

      <ol className="divide-y divide-[var(--color-math-border)]">
        {sessions.map((s, i) => {
          const tier = s.adaptive ? 'Auto' : TIER_LABEL[bucketDifficulty(s.startDifficulty)];
          return (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i, duration: 0.35 }}
              className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[80px_1fr_auto_auto_auto] items-center gap-3 sm:gap-6 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-col">
                <span className="math-digit text-sm text-[var(--color-math-ink)]">
                  {shortDate(s.finishedAt)}
                </span>
                <span className="hidden sm:inline font-sans text-[10px] tracking-wide text-[var(--color-math-ink-faint)]">
                  {shortTime(s.finishedAt)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {s.operations.map((op) => (
                  <span
                    key={op}
                    className="math-digit inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-math-accent-gold)]/30 text-xs text-[var(--color-math-accent-gold)]"
                    title={OP_LABELS[op]}
                  >
                    {OP_GLYPH[op]}
                  </span>
                ))}
                <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[var(--color-math-ink-faint)] ml-1">
                  {tier}
                </span>
              </div>

              <div className="hidden sm:block text-right">
                <span className="math-digit text-xs text-[var(--color-math-ink-muted)]">
                  {s.questionsCorrect}/{s.questionsAnswered}
                </span>
              </div>

              <div className="hidden sm:block text-right">
                <span className="math-digit text-sm text-[var(--color-math-accent-gold)]">
                  {s.accuracy}%
                </span>
              </div>

              <div className="text-right">
                <span className="math-digit text-lg font-light text-[var(--color-math-ink)]">
                  {s.totalScore}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
