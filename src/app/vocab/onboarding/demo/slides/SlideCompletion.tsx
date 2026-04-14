'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleDashed } from 'lucide-react';
import DemoSlideLayout from '../DemoSlideLayout';

const STEPS = [
  { label: 'Flashcards', color: '#3B82F6' },
  { label: 'Quiz',       color: 'var(--color-lx-accent-gold)' },
  { label: 'Complete',   color: 'var(--color-lx-success)' },
];

const spring = { type: 'spring' as const, stiffness: 360, damping: 28 };

interface Props { onNext: () => void; stepLabel: string }

export default function SlideCompletion({ onNext, stepLabel }: Props) {
  const [completedStep, setCompletedStep] = useState(-1);
  const allDone = completedStep >= 2;

  const advanceStep = () => {
    if (completedStep < 2) setCompletedStep(s => s + 1);
  };

  return (
    <DemoSlideLayout
      icon={<CircleDashed size={22} />}
      label="Progression"
      title="The Learning Cycle"
      description="Finish flashcards, pass the quiz — theme complete. Each completed theme unlocks the next."
      ctaLabel="Next"
      ctaDisabled={!allDone}
      onCta={onNext}
      stepLabel={stepLabel}
    >
      <div className="flex w-full flex-col items-center gap-4">
        {/* Progress steps */}
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center">
              {/* Step circle */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={i === completedStep + 1 ? advanceStep : undefined}
                className="relative flex flex-col items-center gap-1.5"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: i === completedStep + 1 ? 'pointer' : 'default',
                  padding: '0 4px',
                }}
              >
                <motion.div
                  animate={{
                    background: i <= completedStep ? step.color : 'var(--color-lx-elevated)',
                    borderColor: i <= completedStep ? step.color : 'var(--color-lx-border)',
                    scale: i === completedStep + 1 ? [1, 1.08, 1] : 1,
                  }}
                  transition={{
                    ...spring,
                    scale: i === completedStep + 1
                      ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                      : spring,
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2"
                >
                  <AnimatePresence mode="wait">
                    {i <= completedStep ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={spring}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </motion.div>
                    ) : (
                      <motion.span
                        key="num"
                        style={{
                          fontFamily: "'Sora', sans-serif",
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: 'var(--color-lx-text-muted)',
                        }}
                      >
                        {i + 1}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>

                <span
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: '0.58rem',
                    fontWeight: 500,
                    color: i <= completedStep ? 'var(--color-lx-text-primary)' : 'var(--color-lx-text-muted)',
                    transition: 'color 0.2s',
                  }}
                >
                  {step.label}
                </span>
              </motion.button>

              {/* Connecting line */}
              {i < STEPS.length - 1 && (
                <div className="relative mx-1 h-0.5 w-8">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--color-lx-border)' }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: i < completedStep ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      background: STEPS[i].color,
                      transformOrigin: 'left',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Confetti burst on completion */}
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring}
              className="flex flex-col items-center gap-1"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
                style={{ fontSize: '1.5rem', lineHeight: 1 }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-lx-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </motion.div>
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--color-lx-success)',
                }}
              >
                Theme Complete!
              </span>
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
          {allDone ? 'All steps done!' : `Tap step ${completedStep + 2} to advance`}
        </p>
      </div>
    </DemoSlideLayout>
  );
}
