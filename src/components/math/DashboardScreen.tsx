'use client';

import React from 'react';
import { motion } from 'motion/react';
import { SectionMark } from './decoratives';
import { PersonalBests } from './PersonalBests';
import { OperationHeatmap } from './OperationHeatmap';
import { ImprovementCurve } from './ImprovementCurve';
import { WeakSpotCard } from './WeakSpotCard';
import { RecentSessionsTable } from './RecentSessionsTable';
import type { DashboardPayload, DashboardWeakSpot } from './dashboard-types';

export interface DashboardScreenProps {
  data:         DashboardPayload | null;
  isLoading:    boolean;
  onStartDrill: (op: DashboardWeakSpot['operation'], tier: DashboardWeakSpot['tier']) => void;
  onPlay:       () => void;
}

export function DashboardScreen({ data, isLoading, onStartDrill, onPlay }: DashboardScreenProps) {
  const totalGames = data?.progress?.totalGames ?? 0;
  const emptyState = !isLoading && totalGames === 0;

  return (
    <div className="relative mx-auto max-w-6xl px-6 sm:px-10 lg:px-16 pt-16 sm:pt-20 pb-28">
      <SectionMark chapter="Chapter Four" title="Reckoning" />

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 font-heading text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.94] tracking-[-0.02em] font-light text-[var(--color-math-ink)]"
      >
        Your ledger.
        <em className="block font-extralight italic text-[var(--color-math-accent-gold)]">by the figures.</em>
      </motion.h1>

      <p className="mt-5 max-w-md font-sans text-sm leading-relaxed text-[var(--color-math-ink-muted)]">
        Every attempt narrows the gap between instinct and certainty. Here is where the gap narrows.
      </p>

      {isLoading && (
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="relative h-32 rounded-xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/60 animate-pulse"
            />
          ))}
        </div>
      )}

      {emptyState && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 relative rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-10 sm:p-14 text-center math-card-shadow"
        >
          <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-4">
            First entry
          </div>
          <h2 className="font-heading text-3xl font-light text-[var(--color-math-ink)] mb-3">
            An empty ledger is a <em className="font-extralight italic text-[var(--color-math-accent-gold)]">promising</em> ledger.
          </h2>
          <p className="max-w-md mx-auto font-sans text-sm text-[var(--color-math-ink-muted)] mb-8">
            Play one session. The baseline becomes the measure.
          </p>
          <motion.button
            type="button"
            onClick={onPlay}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="inline-flex items-center gap-3 rounded-full bg-[var(--color-math-accent-gold)] text-[var(--color-math-base)] px-8 py-3 font-sans text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:bg-[var(--color-math-accent-gold-bright)] hover:shadow-[0_18px_50px_-14px_var(--color-math-glow-gold)]"
          >
            Begin
          </motion.button>
        </motion.div>
      )}

      {!isLoading && !emptyState && data && (
        <div className="mt-12 space-y-6 sm:space-y-8">
          <PersonalBests bests={data.bests} />

          {data.weakSpot && (
            <WeakSpotCard weakSpot={data.weakSpot} onStartDrill={onStartDrill} />
          )}

          <ImprovementCurve curve={data.curve} />

          <OperationHeatmap heatmap={data.heatmap} />

          <RecentSessionsTable sessions={data.recentSessions} />
        </div>
      )}
    </div>
  );
}
