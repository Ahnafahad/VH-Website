'use client';

/**
 * StepFirstWord — the aha-moment step.
 * Presents a real flashcard flip before the feature tour begins.
 * Uses the same flip mechanic as SlideFlashcards so the gesture is learned early.
 *
 * TODO: wire a real Unit-1 word when an endpoint is available that returns
 * starter words without requiring a themeId known at onboarding time.
 * Currently uses a representative hardcoded word from the free word bank.
 */

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import PulseRing from '../demo/PulseRing';

// Hardcoded representative first word — same word shown in SlideFlashcards so it feels deliberate.
const FIRST_WORD = {
  word:       'MAGNANIMOUS',
  pos:        'adjective',
  definition: 'Generous in forgiving; showing noble and courageous spirit.',
  example:    '"A magnanimous gesture of goodwill toward rivals."',
};

interface Props {
  onNext: () => void;
}

const spring = { type: 'spring' as const, stiffness: 340, damping: 28 };

export default function StepFirstWord({ onNext }: Props) {
  const [flipped,   setFlipped]   = useState(false);
  const [rated,     setRated]     = useState<'gotIt' | 'unsure' | 'missed' | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const shouldReduceMotion        = useReducedMotion();
  const fb                        = useVocabFeedback();

  const handleFlip = () => {
    if (flipped) return;
    setFlipped(true);
    fb.play('flip');
  };

  const handleRate = (r: 'gotIt' | 'unsure' | 'missed') => {
    if (rated !== null) return;
    setRated(r);
    fb.play(r);
    setTimeout(() => setDismissed(true), 600);
  };

  const RATINGS: Array<{ key: 'gotIt' | 'unsure' | 'missed'; label: string; color: string }> = [
    { key: 'gotIt',  label: 'Got It',    color: 'var(--color-lx-success)'      },
    { key: 'unsure', label: 'Unsure',    color: 'var(--color-lx-accent-gold)'  },
    { key: 'missed', label: 'Missed It', color: 'var(--color-lx-accent-red)'   },
  ];

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <p
          style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '0.65rem',
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color:         'var(--color-lx-text-muted)',
          }}
        >
          Your First Word
        </p>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   '1.95rem',
            fontWeight: 700,
            fontStyle:  'italic',
            lineHeight: 1.1,
            color:      'var(--color-lx-text-primary)',
            margin:     0,
          }}
        >
          Flip the card.<br />
          <span style={{ color: 'var(--color-lx-accent-red)' }}>Rate yourself.</span>
        </h2>
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '0.82rem',
            color:      'var(--color-lx-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          This is exactly how every LexiCore session works. Try it now.
        </p>
      </div>

      {/* Card + rating zone */}
      <div className="flex flex-col items-center gap-4">
        {/* Instruction chip */}
        <AnimatePresence mode="wait">
          <motion.div
            key={dismissed ? 'done' : flipped ? 'rate' : 'flip'}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1,  y: 0 }}
            exit={{   opacity: 0,  y: 4 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
            style={{
              background: dismissed
                ? 'rgba(34,197,94,0.08)'
                : 'rgba(230,57,70,0.08)',
              border: `1px solid ${dismissed ? 'rgba(34,197,94,0.25)' : 'rgba(230,57,70,0.2)'}`,
            }}
          >
            <span
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '0.68rem',
                fontWeight: 600,
                color:      dismissed ? 'var(--color-lx-success)' : 'var(--color-lx-text-secondary)',
              }}
            >
              {dismissed
                ? '✓ Honest self-rating is the key to long-term retention'
                : flipped
                ? 'Rate how well you knew this word'
                : 'Tap the card to reveal the meaning'}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Flashcard */}
        <AnimatePresence mode="wait">
          {!dismissed ? (
            <motion.div
              key="card"
              exit={shouldReduceMotion
                ? { opacity: 0 }
                : { x: -200, opacity: 0, rotate: -8 }
              }
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <PulseRing active={!flipped} shape="1rem" />

              <motion.div
                className="preserve-3d relative h-36 w-60 cursor-pointer"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                onClick={handleFlip}
                whileTap={!flipped ? { scale: 0.97 } : {}}
              >
                {/* Front */}
                <div
                  className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-lx-surface) 0%, var(--color-lx-elevated) 100%)',
                    border:     '1px solid var(--color-lx-border)',
                  }}
                >
                  <span
                    style={{
                      fontFamily:    "'Sora', sans-serif",
                      fontSize:      '0.55rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color:         'var(--color-lx-text-muted)',
                      marginBottom:  6,
                    }}
                  >
                    {FIRST_WORD.pos}
                  </span>
                  <span
                    className="lx-word"
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize:   '1.5rem',
                      fontWeight: 700,
                      fontStyle:  'italic',
                      color:      'var(--color-lx-text-primary)',
                    }}
                  >
                    {FIRST_WORD.word}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize:   '0.6rem',
                      color:      'var(--color-lx-text-muted)',
                      marginTop:  8,
                    }}
                  >
                    tap to flip
                  </span>
                </div>

                {/* Back */}
                <div
                  className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-2xl px-4 text-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(230,57,70,0.08) 0%, rgba(230,57,70,0.02) 100%)',
                    border:     '1px solid rgba(230,57,70,0.25)',
                    transform:  'rotateY(180deg)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize:   '0.8rem',
                      fontWeight: 500,
                      color:      'var(--color-lx-text-primary)',
                      lineHeight: 1.5,
                    }}
                  >
                    {FIRST_WORD.definition}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize:   '0.68rem',
                      color:      'var(--color-lx-text-muted)',
                      fontStyle:  'italic',
                      marginTop:  6,
                    }}
                  >
                    {FIRST_WORD.example}
                  </span>
                </div>
              </motion.div>

              {/* Floating points */}
              <AnimatePresence>
                {rated !== null && (
                  <motion.div
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: -30 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute -top-2 right-4"
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize:   '0.9rem',
                      fontWeight: 700,
                      color:      RATINGS.find(r => r.key === rated)?.color,
                    }}
                  >
                    {rated === 'gotIt' ? '+10' : rated === 'unsure' ? '+2' : '+0'}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="done-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-36 w-60 flex-col items-center justify-center gap-2 rounded-2xl"
              style={{
                background: 'var(--color-lx-elevated)',
                border:     '1px solid var(--color-lx-border)',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>✓</span>
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize:   '0.75rem',
                  color:      'var(--color-lx-success)',
                  fontWeight: 600,
                }}
              >
                Word 1 of 100 done.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rating buttons */}
        {flipped && !dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="flex gap-2"
          >
            {RATINGS.map((r) => (
              <div key={r.key} className="relative">
                <PulseRing active={rated === null} shape="0.5rem" />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleRate(r.key)}
                  className="rounded-lg px-3"
                  style={{
                    /* ≥44px min height for tap target */
                    minHeight:  44,
                    background: rated === r.key ? `${r.color}20` : 'var(--color-lx-elevated)',
                    border:     `1px solid ${rated === r.key ? r.color : 'var(--color-lx-border)'}`,
                    fontFamily: "'Sora', sans-serif",
                    fontSize:   '0.65rem',
                    fontWeight: 600,
                    color:      rated === r.key ? r.color : 'var(--color-lx-text-secondary)',
                    cursor:     rated !== null ? 'default' : 'pointer',
                    transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                  }}
                >
                  {r.label}
                </motion.button>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Post-rate copy + CTA */}
      <AnimatePresence>
        {dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="flex flex-col gap-4"
          >
            <p
              className="text-center"
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '0.85rem',
                color:      'var(--color-lx-text-secondary)',
                lineHeight: 1.55,
              }}
            >
              You just learned your first word. 99 to go — and the app schedules every review automatically.
            </p>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onNext}
              className="w-full rounded-[10px] py-4 text-lg font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)',
                fontFamily: "'Sora', sans-serif",
                boxShadow:  '0 4px 20px rgba(230,57,70,0.35)',
              }}
            >
              See what else is waiting
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
