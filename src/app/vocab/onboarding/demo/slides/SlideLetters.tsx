'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CaseSensitive } from 'lucide-react';
import DemoSlideLayout from '../DemoSlideLayout';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'];
const SAMPLE_WORDS = [
  { word: 'magnate',    mastery: 'strong',   color: '#3B82F6' },
  { word: 'mercenary',  mastery: 'learning', color: 'var(--color-lx-accent-gold)' },
  { word: 'munificent', mastery: 'new',      color: 'var(--color-lx-text-muted)' },
];

const spring = { type: 'spring' as const, stiffness: 360, damping: 28 };

interface Props { onNext: () => void; stepLabel: string }

export default function SlideLetters({ onNext, stepLabel }: Props) {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const unlocked = selectedLetter !== null;

  return (
    <DemoSlideLayout
      icon={<CaseSensitive size={22} />}
      label="Alphabetical"
      title="Study by Letter"
      description="Browse and study words by their starting letter. The letter view is perfect for targeted review before exams."
      ctaLabel="Next"
      ctaDisabled={!unlocked}
      onCta={onNext}
      stepLabel={stepLabel}
    >
      <div className="flex w-full flex-col items-center gap-3">
        <AnimatePresence mode="wait">
          {!selectedLetter ? (
            <motion.div
              key="grid"
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-3 gap-2"
            >
              {LETTERS.map((letter, i) => (
                <motion.button
                  key={letter}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03, ...spring }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setSelectedLetter(letter)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg"
                  style={{
                    background: letter === 'M'
                      ? 'rgba(230,57,70,0.1)'
                      : 'var(--color-lx-elevated)',
                    border: `1px solid ${letter === 'M' ? 'rgba(230,57,70,0.3)' : 'var(--color-lx-border)'}`,
                    cursor: 'pointer',
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: letter === 'M'
                      ? 'var(--color-lx-accent-red)'
                      : 'var(--color-lx-text-secondary)',
                  }}
                >
                  {letter}
                </motion.button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="words"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full flex-col gap-2"
            >
              {/* Letter header */}
              <div className="flex items-center gap-2 mb-1">
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setSelectedLetter(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: 'var(--color-lx-elevated)',
                    border: '1px solid var(--color-lx-border)',
                    cursor: 'pointer',
                    color: 'var(--color-lx-text-muted)',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </motion.button>
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: '1.3rem',
                    fontWeight: 700,
                    fontStyle: 'italic',
                    color: 'var(--color-lx-accent-red)',
                  }}
                >
                  {selectedLetter}
                </span>
              </div>

              {/* Word list */}
              {SAMPLE_WORDS.map((w, i) => (
                <motion.div
                  key={w.word}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, ...spring }}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{
                    background: 'var(--color-lx-elevated)',
                    border: '1px solid var(--color-lx-border)',
                  }}
                >
                  <span
                    className="lx-word"
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: '0.95rem',
                      fontStyle: 'italic',
                      color: 'var(--color-lx-text-primary)',
                    }}
                  >
                    {w.word}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.5rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: w.color,
                      background: `${w.color}15`,
                      border: `1px solid ${w.color}30`,
                    }}
                  >
                    {w.mastery}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.65rem',
            color: 'var(--color-lx-text-muted)',
            textAlign: 'center',
          }}
        >
          {unlocked ? 'Letter selected!' : 'Tap a letter to explore'}
        </p>
      </div>
    </DemoSlideLayout>
  );
}
