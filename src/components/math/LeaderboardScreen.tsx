'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { CornerBrackets, RANK_LABEL, SectionMark } from './decoratives';
import type { LeaderboardData } from './types';

export interface LeaderboardScreenProps {
  data:      LeaderboardData;
  isLoading: boolean;
  onBack:    () => void;
}

export function LeaderboardScreen({ data, isLoading, onBack }: LeaderboardScreenProps) {
  return (
    <div className="relative mx-auto max-w-[1400px] px-6 sm:px-10 lg:px-16 pt-20 pb-28">
      <SectionMark chapter="Chapter Two" title="Champions" />

      <div className="mt-10 mb-16 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-8 font-heading text-[clamp(2.5rem,7vw,6rem)] leading-[0.92] tracking-[-0.02em] font-light text-[var(--color-math-ink)]"
        >
          The leaderboard.
          <em className="block font-extralight italic text-[var(--color-math-accent-gold)]">who&apos;s fastest?</em>
        </motion.h1>
        <motion.button
          type="button"
          onClick={onBack}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="group lg:col-span-4 lg:justify-self-end inline-flex items-center gap-3 rounded-full border border-[var(--color-math-accent-gold)]/40 bg-transparent text-[var(--color-math-accent-gold)] px-7 py-3.5 font-sans text-sm font-medium tracking-wide transition-colors duration-500 hover:bg-[var(--color-math-accent-gold)] hover:text-[var(--color-math-base)]"
        >
          <span>Back to game</span>
          <ArrowRight size={16} />
        </motion.button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Individual */}
        <LeaderboardPanel label="Top individual scores" empty="No scores yet. Be the first to play." isLoading={isLoading} count={data.individual.length}>
          <div className="space-y-1">
            {data.individual.slice(0, 10).map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                className="flex items-center justify-between py-3 border-b border-[var(--color-math-border)]/50 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className={`math-digit text-sm italic ${i < 3 ? 'text-[var(--color-math-accent-gold)]' : 'text-[var(--color-math-ink-faint)]'}`}>
                    {RANK_LABEL(i)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-sm text-[var(--color-math-ink)]">{e.playerName || 'Anonymous'}</span>
                      {e.isSuspicious && (
                        <span className="font-sans text-[9px] tracking-widest uppercase text-[var(--color-math-danger)] border border-[var(--color-math-danger)]/40 px-1.5 py-0.5 rounded">
                          calc
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-sans text-[11px] text-[var(--color-math-ink-faint)]">
                      {e.difficulty} · {e.accuracy}% acc · {e.timeLimit}min
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="math-digit text-xl font-light text-[var(--color-math-accent-gold)]">{e.score}</div>
                  <div className="font-sans text-[10px] text-[var(--color-math-ink-faint)]">
                    {e.questionsCorrect}/{e.questionsAnswered}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </LeaderboardPanel>

        {/* Accumulated */}
        <LeaderboardPanel label="Accumulated champions" empty="No accumulated scores yet." isLoading={isLoading} count={data.accumulated.length}>
          <div className="space-y-1">
            {data.accumulated.slice(0, 10).map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                className="flex items-center justify-between py-3 border-b border-[var(--color-math-border)]/50 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className={`math-digit text-sm italic ${i < 3 ? 'text-[var(--color-math-accent-gold)]' : 'text-[var(--color-math-ink-faint)]'}`}>
                    {RANK_LABEL(i)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-sm text-[var(--color-math-ink)]">{e.playerName || 'Anonymous'}</span>
                      {e.hasSuspiciousGames && (
                        <span className="font-sans text-[9px] tracking-widest uppercase text-[var(--color-math-danger)] border border-[var(--color-math-danger)]/40 px-1.5 py-0.5 rounded">
                          calc
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-sans text-[11px] text-[var(--color-math-ink-faint)]">
                      {e.gamesPlayed} games · avg {Math.round(e.averageScore)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="math-digit text-xl font-light text-[var(--color-math-accent-gold)]">{e.totalScore}</div>
                  <div className="font-sans text-[10px] text-[var(--color-math-ink-faint)]">total pts</div>
                </div>
              </motion.div>
            ))}
          </div>
        </LeaderboardPanel>
      </div>
    </div>
  );
}

function LeaderboardPanel({
  label, empty, isLoading, count, children,
}: {
  label:      string;
  empty:      string;
  isLoading:  boolean;
  count:      number;
  children:   React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-8 sm:p-10 math-card-shadow"
    >
      <CornerBrackets />
      <div className="mb-6 font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)]">
        {label}
      </div>
      {isLoading ? (
        <p className="font-sans text-sm text-[var(--color-math-ink-faint)]">Loading…</p>
      ) : count === 0 ? (
        <p className="font-sans text-sm text-[var(--color-math-ink-faint)]">{empty}</p>
      ) : (
        children
      )}
    </motion.div>
  );
}
