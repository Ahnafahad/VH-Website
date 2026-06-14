'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import StepWelcome    from './steps/StepWelcome';
import StepDeadline   from './steps/StepDeadline';
import StepProjection from './steps/StepProjection';
import StepFirstWord  from './steps/StepFirstWord';
import StepReady      from './steps/StepReady';
import DemoSlides     from './demo/DemoSlides';
import { trackFeature } from '@/lib/analytics/tracker';

interface Props {
  userId: number;
  userName: string;
}

/**
 * Onboarding flow — 6 steps (outer steps 0-4 + demo at step 3):
 *   0 = Welcome           (outcome-oriented, warmer copy)
 *   1 = Deadline picker
 *   2 = Projection        (reflects deadline back as motivation)
 *   3 = First Word flip   (aha moment — real flashcard interaction)
 *   4 = Feature tour      (DemoSlides, skippable)
 *   5 = Ready!            (celebrates + references deadline)
 *
 * Outer steps 0-2 show a 4-dot pager so the user knows the length up front.
 * Steps 3-5 are inside the tour or finale and manage their own progress.
 */

// The outer pager covers the "numbered" steps the user consciously navigates.
// Steps: Welcome(0) · Deadline(1) · Projection(2) · First Word(3)
// Then Tour + Ready follow without a numbered pager (the demo has its own dots).
const PAGER_STEPS = ['Welcome', 'Deadline', 'Your Plan', 'First Word'];
const PAGER_VISIBLE_MAX = 3; // show pager for steps 0..3

export default function OnboardingFlow({ userId: _userId, userName }: Props) {
  const [step,        setStep]        = useState(0);
  const [deadline,    setDeadline]    = useState<Date | null>(null);
  const [wordsPerDay, setWordsPerDay] = useState(4);
  const [saving,      setSaving]      = useState(false);
  const router                        = useRouter();

  // Track onboarding start once on mount
  useEffect(() => { trackFeature('onboarding_start', 'vocab'); }, []);

  async function finish() {
    setSaving(true);
    trackFeature('onboarding_complete', 'vocab');
    const chosenDeadline = deadline ?? defaultDeadline();
    await fetch('/api/vocab/onboarding/complete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ deadline: chosenDeadline.toISOString() }),
    });
    router.replace('/vocab/home');
  }

  const showPager = step <= PAGER_VISIBLE_MAX;

  return (
    <div
      className="lx-root relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-5"
      style={{ background: 'var(--color-lx-base)' }}
    >
      {/* ── Outer progress pager (steps 0-3) ─────────────────────────── */}
      <AnimatePresence>
        {showPager && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="absolute top-6 left-0 right-0 flex flex-col items-center gap-1.5"
            role="group"
            aria-label={`Onboarding progress, step ${step + 1} of ${PAGER_STEPS.length}`}
          >
            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {PAGER_STEPS.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    width:      i === step ? 18 : 6,
                    background: i === step
                      ? 'var(--color-lx-accent-red)'
                      : i < step
                      ? 'var(--color-lx-text-muted)'
                      : 'var(--color-lx-border)',
                  }}
                  transition={{ duration: 0.25, ease: [0.25, 0, 0, 1] }}
                  className="h-1.5 rounded-full"
                />
              ))}
            </div>
            {/* aria-live step label */}
            <p
              aria-live="polite"
              aria-atomic="true"
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '0.6rem',
                color:      'var(--color-lx-text-muted)',
              }}
            >
              {PAGER_STEPS[step]} · {step + 1} of {PAGER_STEPS.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step content ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* 0 — Welcome */}
        {step === 0 && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <StepWelcome userName={userName} onNext={() => setStep(1)} />
          </motion.div>
        )}

        {/* 1 — Deadline */}
        {step === 1 && (
          <motion.div
            key="deadline"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <StepDeadline
              onNext={(d, wpd) => {
                setDeadline(d);
                setWordsPerDay(wpd);
                setStep(2);
              }}
            />
          </motion.div>
        )}

        {/* 2 — Projection (deadline reflected back) */}
        {step === 2 && deadline && (
          <motion.div
            key="projection"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <StepProjection
              deadline={deadline}
              wordsPerDay={wordsPerDay}
              onNext={() => setStep(3)}
            />
          </motion.div>
        )}

        {/* 3 — First Word (aha moment) */}
        {step === 3 && (
          <motion.div
            key="firstword"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <StepFirstWord onNext={() => setStep(4)} />
          </motion.div>
        )}

        {/* 4 — Feature tour (skippable) */}
        {step === 4 && (
          <motion.div
            key="demo"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <DemoSlides
              mode="onboarding"
              onComplete={() => setStep(5)}
              onSkip={() => { trackFeature('onboarding_skip', 'vocab'); setStep(5); }}
            />
          </motion.div>
        )}

        {/* 5 — Ready (celebrate + reference deadline) */}
        {step === 5 && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <StepReady
              saving={saving}
              onFinish={finish}
              deadline={deadline ?? defaultDeadline()}
              wordsPerDay={wordsPerDay}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grain overlay ─────────────────────────────────────────── */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ opacity: 0.015 }}
      >
        <filter id="grain-onboarding">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-onboarding)" />
      </svg>
    </div>
  );
}

function defaultDeadline(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d;
}
