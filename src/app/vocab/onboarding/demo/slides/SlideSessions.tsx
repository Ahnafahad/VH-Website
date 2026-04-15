'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Signpost } from 'lucide-react';
import DemoSlideLayout from '../DemoSlideLayout';
import PulseRing from '../PulseRing';

const SESSIONS = [
  {
    id: 'learn',
    title: 'Learn · Unit 3',
    sub: 'Start a new flashcard session',
    barColor: '#3B82F6',
  },
  {
    id: 'review',
    title: 'Review · 5 due',
    sub: 'Words scheduled for spaced review',
    barColor: 'var(--color-lx-accent-gold)',
    pulse: true,
  },
  {
    id: 'quiz',
    title: 'Quiz · Theme 2',
    sub: 'Test your knowledge to complete the theme',
    barColor: 'var(--color-lx-accent-red)',
  },
];

interface Props { onNext: () => void; stepLabel: string }

export default function SlideSessions({ onNext, stepLabel }: Props) {
  const [tapped, setTapped] = useState<string | null>(null);
  const unlocked = tapped !== null;

  return (
    <DemoSlideLayout
      icon={<Signpost size={22} />}
      label="Daily Path"
      title="Your Sessions"
      description="The app builds your daily study plan automatically. Learn new words, review old ones, or take a quiz — each session fits a 15-minute window."
      subtext="IBA vocab sections test ~300 words. Completing 2-3 sessions daily covers the full word bank in 6 weeks."
      ctaLabel="Next"
      ctaDisabled={!unlocked}
      onCta={onNext}
      stepLabel={stepLabel}
    >
      <div className="flex w-full flex-col gap-2">
        {SESSIONS.map((s) => (
          <div key={s.id} className="relative">
            <PulseRing active={tapped === null} shape="0.75rem" />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setTapped(s.id)}
              className="relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
              style={{
                background: tapped === s.id
                  ? 'rgba(230,57,70,0.06)'
                  : 'var(--color-lx-elevated)',
                border: `1px solid ${
                  tapped === s.id ? 'rgba(230,57,70,0.3)' : 'var(--color-lx-border)'
                }`,
                cursor: 'pointer',
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              {/* Color bar */}
              <motion.div
                className="h-9 w-1 rounded-full"
                style={{ background: s.barColor }}
                animate={s.pulse ? { opacity: [1, 0.5, 1] } : {}}
                transition={s.pulse ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : {}}
              />

              <div className="flex flex-1 flex-col">
                <span
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--color-lx-text-primary)',
                  }}
                >
                  {s.title}
                </span>
              </div>

              {/* Arrow */}
              <motion.div
                animate={{ x: tapped === s.id ? 4 : 0 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
                style={{ color: 'var(--color-lx-text-muted)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </motion.div>

              {/* Description that appears on tap */}
              <AnimatePresence>
                {tapped === s.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute -bottom-7 left-4 right-4"
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.6rem',
                      color: 'var(--color-lx-text-muted)',
                      zIndex: 5,
                    }}
                  >
                    {s.sub}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        ))}

        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.72rem',
            fontWeight: 500,
            color: 'var(--color-lx-text-secondary)',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          {unlocked ? 'Your study path is always ready' : 'Tap any session card to see what it does'}
        </p>
      </div>
    </DemoSlideLayout>
  );
}
