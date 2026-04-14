'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';
import DemoSlideLayout from '../DemoSlideLayout';

const DUE_WORDS = [
  { word: 'pragmatic',   tag: '2d overdue' },
  { word: 'ephemeral',   tag: '5d overdue' },
];

const STRUGGLING_WORDS = [
  { word: 'sycophant',   tag: '40% accuracy' },
  { word: 'obsequious',  tag: '35% accuracy' },
];

const spring = { type: 'spring' as const, stiffness: 360, damping: 28 };

interface Props { onNext: () => void; stepLabel: string }

export default function SlideReview({ onNext, stepLabel }: Props) {
  const [tappedSections, setTappedSections] = useState<Set<string>>(new Set());
  const unlocked = tappedSections.size >= 2;

  const tapSection = (id: string) => {
    setTappedSections(prev => new Set(prev).add(id));
  };

  return (
    <DemoSlideLayout
      icon={<BrainCircuit size={22} />}
      label="Memory"
      title="Your Review Guardian"
      description="Spaced repetition ensures you never forget. Words due for review and words you struggle with appear here automatically."
      subtext="Two sections — overdue words from your spaced repetition schedule, and words where your accuracy is low."
      ctaLabel="Next"
      ctaDisabled={!unlocked}
      onCta={onNext}
      stepLabel={stepLabel}
    >
      <div className="flex w-full gap-3">
        {/* Due for Review */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => tapSection('due')}
          className="flex flex-1 flex-col gap-2 rounded-xl p-3 text-left"
          style={{
            background: tappedSections.has('due')
              ? 'rgba(244,168,40,0.06)'
              : 'var(--color-lx-elevated)',
            border: `1px solid ${
              tappedSections.has('due')
                ? 'rgba(244,168,40,0.3)'
                : 'var(--color-lx-border)'
            }`,
            cursor: 'pointer',
            transition: 'background 0.2s, border-color 0.2s',
          }}
        >
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: '0.55rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-lx-accent-gold)',
            }}
          >
            Due for Review
          </span>
          {DUE_WORDS.map((w, i) => (
            <motion.div
              key={w.word}
              initial={{ opacity: 0.5 }}
              animate={{
                opacity: tappedSections.has('due') ? 1 : 0.5,
              }}
              transition={{ delay: tappedSections.has('due') ? i * 0.1 : 0, ...spring }}
              className="flex flex-col gap-0.5"
            >
              <span
                className="lx-word"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: '0.82rem',
                  fontStyle: 'italic',
                  color: 'var(--color-lx-text-primary)',
                }}
              >
                {w.word}
              </span>
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.5rem',
                  color: 'var(--color-lx-accent-gold)',
                }}
              >
                {w.tag}
              </span>
            </motion.div>
          ))}
        </motion.button>

        {/* Struggling */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => tapSection('struggling')}
          className="flex flex-1 flex-col gap-2 rounded-xl p-3 text-left"
          style={{
            background: tappedSections.has('struggling')
              ? 'rgba(230,57,70,0.06)'
              : 'var(--color-lx-elevated)',
            border: `1px solid ${
              tappedSections.has('struggling')
                ? 'rgba(230,57,70,0.3)'
                : 'var(--color-lx-border)'
            }`,
            cursor: 'pointer',
            transition: 'background 0.2s, border-color 0.2s',
          }}
        >
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: '0.55rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-lx-accent-red)',
            }}
          >
            Struggling
          </span>
          {STRUGGLING_WORDS.map((w, i) => (
            <motion.div
              key={w.word}
              initial={{ opacity: 0.5 }}
              animate={{
                opacity: tappedSections.has('struggling') ? 1 : 0.5,
              }}
              transition={{ delay: tappedSections.has('struggling') ? i * 0.1 : 0, ...spring }}
              className="flex flex-col gap-0.5"
            >
              <span
                className="lx-word"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: '0.82rem',
                  fontStyle: 'italic',
                  color: 'var(--color-lx-text-primary)',
                }}
              >
                {w.word}
              </span>
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.5rem',
                  color: 'var(--color-lx-accent-red)',
                }}
              >
                {w.tag}
              </span>
            </motion.div>
          ))}
        </motion.button>
      </div>

      {/* Timeline hint */}
      <div className="mt-2 flex w-full items-center gap-1.5">
        {['word', 'interval grows', 'review due', 'cycle'].map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.15 }}
              className="rounded-full px-1.5 py-0.5"
              style={{
                background: 'var(--color-lx-elevated)',
                border: '1px solid var(--color-lx-border)',
                fontFamily: "'Sora', sans-serif",
                fontSize: '0.45rem',
                color: 'var(--color-lx-text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {s}
            </motion.div>
            {i < 3 && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5 + i * 0.15, duration: 0.3 }}
                className="h-px w-3"
                style={{ background: 'var(--color-lx-border)', transformOrigin: 'left' }}
              />
            )}
          </div>
        ))}
      </div>

      <p
        style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: '0.65rem',
          color: 'var(--color-lx-text-muted)',
          textAlign: 'center',
          marginTop: 4,
        }}
      >
        {unlocked ? 'Both sections explored!' : `Tap both sections to continue (${tappedSections.size}/2)`}
      </p>
    </DemoSlideLayout>
  );
}
