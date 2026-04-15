'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import DemoSlideLayout from '../DemoSlideLayout';
import PulseRing from '../PulseRing';
import DemoInstruction from '../DemoInstruction';

const POINT_ROWS = [
  { label: 'Daily Login', pts: '+5' },
  { label: 'Flashcard',   pts: '+10' },
  { label: 'Quiz Bonus',  pts: '+15' },
  { label: 'Session',     pts: '+10' },
];

const BADGES = [
  { name: 'First Step', icon: '🏅', unlocked: true },
  { name: 'Week Warrior', icon: '🔥', unlocked: true },
  { name: '???', icon: '🔒', unlocked: false },
];

const LEADERBOARD = [
  { rank: 1, name: 'Ahnaf', score: '1,240', color: 'var(--color-lx-accent-gold)' },
  { rank: 2, name: 'Nabil', score: '980', color: 'var(--color-lx-text-secondary)' },
  { rank: 3, name: 'You', score: '245', color: 'var(--color-lx-accent-red)', isYou: true },
];

const spring = { type: 'spring' as const, stiffness: 360, damping: 28 };

interface Props { onNext: () => void; stepLabel: string }

export default function SlideScoring({ onNext, stepLabel }: Props) {
  const [tapped, setTapped] = useState<Set<string>>(new Set());
  const allTapped = tapped.size >= 3;

  const tap = useCallback((id: string) => {
    setTapped(prev => new Set(prev).add(id));
  }, []);

  return (
    <DemoSlideLayout
      icon={<Trophy size={22} />}
      label="Motivation"
      title="Scoring & Rewards"
      description="Every action earns points that feed the leaderboard. Unlock badges for milestones — streaks, perfect quizzes, unit completions. Compete with classmates preparing for the same exam."
      subtext="Students on the leaderboard study 2x more consistently than those who study alone. Your ranking resets weekly — everyone gets a fresh start."
      ctaLabel="Next"
      ctaDisabled={!allTapped}
      onCta={onNext}
      stepLabel={stepLabel}
    >
      <div className="flex w-full flex-col gap-3">
        {/* Top instruction bar */}
        <DemoInstruction
          activeText="Tap each highlighted section"
          doneText="Your progress is tracked, rewarded, and visible"
          done={allTapped}
          progress={`${tapped.size} of 3 explored`}
        />

        {/* Points breakdown */}
        <div className="relative">
          <PulseRing active={!tapped.has('points')} shape="0.75rem" />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => tap('points')}
            className="w-full rounded-xl px-3 py-2.5 text-left"
            style={{
              background: tapped.has('points') ? 'rgba(244,168,40,0.06)' : 'var(--color-lx-elevated)',
              border: `1px solid ${tapped.has('points') ? 'rgba(244,168,40,0.3)' : 'var(--color-lx-border)'}`,
              cursor: 'pointer',
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                {POINT_ROWS.map((row, i) => (
                  <motion.div
                    key={row.label}
                    initial={{ opacity: 0.6 }}
                    animate={{ opacity: tapped.has('points') ? 1 : 0.6 }}
                    transition={{ delay: tapped.has('points') ? i * 0.06 : 0 }}
                    className="flex items-center justify-between gap-4"
                  >
                    <span style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.6rem',
                      color: 'var(--color-lx-text-secondary)',
                    }}>
                      {row.label}
                    </span>
                    <span style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      color: 'var(--color-lx-accent-gold)',
                    }}>
                      {row.pts}
                    </span>
                  </motion.div>
                ))}
              </div>
              <AnimatePresence>
                {tapped.has('points') && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={spring}
                    className="flex flex-col items-center"
                  >
                    <span style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: '1.6rem',
                      fontWeight: 700,
                      color: 'var(--color-lx-accent-gold)',
                      lineHeight: 1,
                    }}>
                      40
                    </span>
                    <span style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.5rem',
                      color: 'var(--color-lx-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      pts/session
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.button>
        </div>

        {/* Badges preview */}
        <div className="relative">
          <PulseRing active={!tapped.has('badges')} shape="0.75rem" />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => tap('badges')}
            className="w-full rounded-xl px-3 py-2.5"
            style={{
              background: tapped.has('badges') ? 'rgba(230,57,70,0.06)' : 'var(--color-lx-elevated)',
              border: `1px solid ${tapped.has('badges') ? 'rgba(230,57,70,0.3)' : 'var(--color-lx-border)'}`,
              cursor: 'pointer',
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            <div className="flex items-center justify-center gap-4">
              {BADGES.map((badge, i) => (
                <motion.div
                  key={badge.name}
                  initial={{ opacity: 0.6, scale: 0.9 }}
                  animate={{
                    opacity: tapped.has('badges') ? 1 : 0.6,
                    scale: tapped.has('badges') ? 1 : 0.9,
                  }}
                  transition={{
                    delay: tapped.has('badges') ? i * 0.12 : 0,
                    ...spring,
                  }}
                  className="flex flex-col items-center gap-1"
                >
                  <span style={{ fontSize: '1.4rem', lineHeight: 1, filter: badge.unlocked ? 'none' : 'grayscale(1) opacity(0.5)' }}>
                    {badge.icon}
                  </span>
                  <span style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: '0.48rem',
                    fontWeight: 500,
                    color: badge.unlocked ? 'var(--color-lx-text-secondary)' : 'var(--color-lx-text-muted)',
                  }}>
                    {badge.name}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.button>
        </div>

        {/* Leaderboard preview */}
        <div className="relative">
          <PulseRing active={!tapped.has('leaderboard')} shape="0.75rem" />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => tap('leaderboard')}
            className="w-full rounded-xl px-3 py-2 text-left"
            style={{
              background: tapped.has('leaderboard') ? 'rgba(230,57,70,0.06)' : 'var(--color-lx-elevated)',
              border: `1px solid ${tapped.has('leaderboard') ? 'rgba(230,57,70,0.3)' : 'var(--color-lx-border)'}`,
              cursor: 'pointer',
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            <div className="flex flex-col gap-1">
              {LEADERBOARD.map((row, i) => (
                <motion.div
                  key={row.name}
                  initial={{ opacity: 0.6 }}
                  animate={{
                    opacity: tapped.has('leaderboard') ? 1 : 0.6,
                    y: tapped.has('leaderboard') && row.isYou ? -2 : 0,
                  }}
                  transition={{
                    delay: tapped.has('leaderboard') ? i * 0.08 : 0,
                    ...spring,
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: row.color,
                      width: 16,
                    }}>
                      #{row.rank}
                    </span>
                    <span style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.65rem',
                      fontWeight: row.isYou ? 700 : 500,
                      color: row.isYou ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-primary)',
                    }}>
                      {row.name}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    color: 'var(--color-lx-text-muted)',
                  }}>
                    {row.score}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.button>
        </div>
      </div>
    </DemoSlideLayout>
  );
}
