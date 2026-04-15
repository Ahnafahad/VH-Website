'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network } from 'lucide-react';
import DemoSlideLayout from '../DemoSlideLayout';
import PulseRing from '../PulseRing';

const WORDS = ['hegemony', 'belligerent', 'antagonist'];

const spring = { type: 'spring' as const, stiffness: 360, damping: 28 };

interface Props { onNext: () => void; stepLabel: string }

export default function SlideThemes({ onNext, stepLabel }: Props) {
  const [expanded, setExpanded] = useState(false);
  const unlocked = expanded;

  return (
    <DemoSlideLayout
      icon={<Network size={22} />}
      label="Study Structure"
      title="Study by Theme"
      description="Words grouped by meaning — Anger, Power, Deception — stick 3x better than random lists. Each theme is a focused unit of 10-15 exam-relevant words."
      subtext="Thematic grouping creates stronger neural pathways. When you see 'magnanimous' on the exam, your brain recalls the full Power cluster."
      ctaLabel="Next"
      ctaDisabled={!unlocked}
      onCta={onNext}
      stepLabel={stepLabel}
    >
      <div className="flex w-full flex-col items-center gap-3">
        {/* Unit card */}
        <div className="relative w-full">
          <PulseRing active={!expanded} shape="0.75rem" />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setExpanded(e => !e)}
            className="w-full rounded-xl px-4 py-3 text-left"
            style={{
              background: expanded ? 'rgba(230,57,70,0.06)' : 'var(--color-lx-elevated)',
              border: `1px solid ${expanded ? 'rgba(230,57,70,0.3)' : 'var(--color-lx-border)'}`,
              cursor: 'pointer',
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: '0.6rem',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-lx-text-muted)',
                  }}
                >
                  Unit 3
                </span>
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    fontStyle: 'italic',
                    color: 'var(--color-lx-text-primary)',
                  }}
                >
                  Anger &amp; Conflict
                </span>
              </div>
              <motion.div
                animate={{ rotate: expanded ? 90 : 0 }}
                transition={spring}
                style={{ color: 'var(--color-lx-text-muted)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </motion.div>
            </div>
          </motion.button>
        </div>

        {/* Expanded content: theme → words */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full flex-col gap-2 overflow-hidden"
            >
              {/* Connecting line */}
              <div className="ml-5 flex items-stretch gap-3">
                <div
                  className="w-px"
                  style={{ background: 'var(--color-lx-border)' }}
                />
                <div className="flex flex-col gap-1.5 py-1">
                  {WORDS.map((word, i) => (
                    <motion.div
                      key={word}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08, ...spring }}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: 'var(--color-lx-accent-red)' }}
                      />
                      <span
                        className="lx-word"
                        style={{
                          fontFamily: "'Cormorant Garamond', Georgia, serif",
                          fontSize: '0.95rem',
                          fontStyle: 'italic',
                          color: 'var(--color-lx-text-primary)',
                        }}
                      >
                        {word}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.72rem',
            fontWeight: 500,
            color: 'var(--color-lx-text-secondary)',
            textAlign: 'center',
          }}
        >
          {expanded ? 'Themed learning — the fastest path to exam vocabulary' : 'Tap the unit card to reveal its words'}
        </p>
      </div>
    </DemoSlideLayout>
  );
}
