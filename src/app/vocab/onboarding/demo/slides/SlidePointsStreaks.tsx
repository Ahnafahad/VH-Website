'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import DemoSlideLayout from '../DemoSlideLayout';

const POINT_STEPS = [
  { label: 'Daily login',  delta: 5,  color: 'var(--color-lx-accent-gold)' },
  { label: 'Flashcard',    delta: 10, color: 'var(--color-lx-accent-red)' },
  { label: 'Quiz bonus',   delta: 15, color: 'var(--color-lx-success)' },
];

interface Props { onNext: () => void; stepLabel: string }

export default function SlidePointsStreaks({ onNext, stepLabel }: Props) {
  const [phase, setPhase] = useState(0);   // 0..3 for points, 4..10 for streak, 11 = done
  const [points, setPoints] = useState(0);
  const [streakDay, setStreakDay] = useState(0);
  const done = phase >= 11;

  // Auto-advance through animation phases
  useEffect(() => {
    if (phase >= 11) return;
    const delay = phase <= 3 ? 900 : 400;
    const timer = setTimeout(() => {
      if (phase < 3) {
        setPoints(p => p + POINT_STEPS[phase].delta);
      } else if (phase >= 4 && phase <= 10) {
        setStreakDay(phase - 3);
      }
      setPhase(p => p + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <DemoSlideLayout
      icon={<Sparkles size={22} />}
      label="Rewards"
      title="Points & Streaks"
      description="Every study action earns points — flashcards, quizzes, even just logging in. Your streak tracks consecutive days. Miss a day, it resets."
      subtext="7-day streaks correlate with 90%+ word retention on exam day. The streak is your most important number."
      ctaLabel="Next"
      ctaDisabled={!done}
      onCta={onNext}
      stepLabel={stepLabel}
    >
      <div className="flex w-full flex-col items-center gap-5">
        {/* Points counter */}
        <div className="flex flex-col items-center gap-2">
          <motion.span
            key={points}
            initial={{ scale: 1.3, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 22 }}
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '2.8rem',
              fontWeight: 700,
              color: 'var(--color-lx-accent-gold)',
              lineHeight: 1,
            }}
          >
            {points}
          </motion.span>
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: '0.65rem',
              color: 'var(--color-lx-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            points earned
          </span>

          {/* Source labels */}
          <div className="flex items-center gap-2">
            {POINT_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: phase > i ? 1 : 0.3,
                  scale: phase === i + 1 ? 1.1 : 1,
                }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{
                  background: phase > i ? `${step.color}15` : 'transparent',
                  border: `1px solid ${phase > i ? step.color + '40' : 'var(--color-lx-border)'}`,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: '0.55rem',
                    fontWeight: 500,
                    color: phase > i ? step.color : 'var(--color-lx-text-muted)',
                  }}
                >
                  +{step.delta} {step.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Streak flame */}
        <div className="flex flex-col items-center gap-1.5">
          <motion.div
            animate={{
              scale: streakDay >= 7 ? [1, 1.15, 1] : 1,
              filter: `drop-shadow(0 0 ${4 + streakDay * 2}px rgba(230,57,70,${0.2 + streakDay * 0.08}))`,
            }}
            transition={{
              scale: { duration: 0.8, repeat: streakDay >= 7 ? Infinity : 0, ease: 'easeInOut' },
              filter: { duration: 0.4 },
            }}
            style={{
              fontSize: '1.8rem',
              lineHeight: 1,
              color: 'var(--color-lx-accent-red)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
            </svg>
          </motion.div>
          <div className="flex items-baseline gap-1">
            <motion.span
              key={streakDay}
              initial={{ scale: 1.4, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 20 }}
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--color-lx-accent-red)',
                lineHeight: 1,
              }}
            >
              {streakDay}
            </motion.span>
            <span
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize: '0.7rem',
                color: 'var(--color-lx-text-secondary)',
              }}
            >
              day streak
            </span>
          </div>
        </div>
      </div>
    </DemoSlideLayout>
  );
}
