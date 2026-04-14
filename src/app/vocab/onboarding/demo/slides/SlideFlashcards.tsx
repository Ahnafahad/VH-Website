'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GalleryVerticalEnd } from 'lucide-react';
import DemoSlideLayout from '../DemoSlideLayout';

const RATINGS = [
  { label: 'Got It',    color: 'var(--color-lx-success)', points: '+10' },
  { label: 'Unsure',    color: 'var(--color-lx-accent-gold)', points: '+2' },
  { label: 'Missed It', color: 'var(--color-lx-accent-red)', points: '+0' },
];

interface Props { onNext: () => void; stepLabel: string }

export default function SlideFlashcards({ onNext, stepLabel }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const unlocked = rated !== null;

  const handleRate = (idx: number) => {
    if (rated !== null) return;
    setRated(idx);
    setTimeout(() => setDismissed(true), 600);
  };

  return (
    <DemoSlideLayout
      icon={<GalleryVerticalEnd size={22} />}
      label="Flashcards"
      title="Flip & Rate"
      description="Flip to reveal, then rate yourself honestly. The app adapts — words you miss come back sooner."
      ctaLabel="Next"
      ctaDisabled={!unlocked}
      onCta={onNext}
      stepLabel={stepLabel}
    >
      <div className="flex w-full flex-col items-center gap-3">
        {/* Flashcard */}
        <AnimatePresence mode="wait">
          {!dismissed ? (
            <motion.div
              key="card"
              exit={{ x: -200, opacity: 0, rotate: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <motion.div
                className="preserve-3d relative h-32 w-56 cursor-pointer"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => !flipped && setFlipped(true)}
                whileTap={!flipped ? { scale: 0.97 } : {}}
              >
                {/* Front */}
                <div
                  className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-lx-surface) 0%, var(--color-lx-elevated) 100%)',
                    border: '1px solid var(--color-lx-border)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.55rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--color-lx-text-muted)',
                      marginBottom: 6,
                    }}
                  >
                    adjective
                  </span>
                  <span
                    className="lx-word"
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      fontStyle: 'italic',
                      color: 'var(--color-lx-text-primary)',
                    }}
                  >
                    MAGNANIMOUS
                  </span>
                  <span
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.6rem',
                      color: 'var(--color-lx-text-muted)',
                      marginTop: 8,
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
                    border: '1px solid rgba(230,57,70,0.25)',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: 'var(--color-lx-text-primary)',
                      lineHeight: 1.5,
                    }}
                  >
                    Generous in forgiving
                  </span>
                  <span
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize: '0.68rem',
                      color: 'var(--color-lx-text-muted)',
                      fontStyle: 'italic',
                      marginTop: 6,
                    }}
                  >
                    &quot;a magnanimous gesture of goodwill&quot;
                  </span>
                </div>
              </motion.div>

              {/* Floating points on rate */}
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
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: RATINGS[rated].color,
                    }}
                  >
                    {RATINGS[rated].points}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-32 w-56 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--color-lx-elevated)',
                border: '1px solid var(--color-lx-border)',
              }}
            >
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.75rem',
                  color: 'var(--color-lx-text-muted)',
                }}
              >
                Card reviewed!
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
            {RATINGS.map((r, i) => (
              <motion.button
                key={r.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleRate(i)}
                className="rounded-lg px-3 py-2"
                style={{
                  background: rated === i
                    ? `${r.color}20`
                    : 'var(--color-lx-elevated)',
                  border: `1px solid ${rated === i ? r.color : 'var(--color-lx-border)'}`,
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: rated === i ? r.color : 'var(--color-lx-text-secondary)',
                  cursor: rated !== null ? 'default' : 'pointer',
                  transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                }}
              >
                {r.label}
              </motion.button>
            ))}
          </motion.div>
        )}

        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.65rem',
            color: 'var(--color-lx-text-muted)',
            textAlign: 'center',
          }}
        >
          {!flipped ? 'Tap the card to flip it' : rated === null ? 'Now rate yourself' : 'Well done!'}
        </p>
      </div>
    </DemoSlideLayout>
  );
}
