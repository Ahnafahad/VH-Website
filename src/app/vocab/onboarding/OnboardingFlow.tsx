'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import StepWelcome from './steps/StepWelcome';
import StepDeadline from './steps/StepDeadline';
import StepReady from './steps/StepReady';
import DemoSlides from './demo/DemoSlides';

interface Props {
  userId: number;
  userName: string;
}

/**
 * 11-slide onboarding flow:
 * 0 = Welcome
 * 1 = Deadline picker
 * 2 = Demo slides (8 interactive feature slides handled internally)
 * 3 = Ready! (save + redirect)
 */
export default function OnboardingFlow({ userId, userName }: Props) {
  const [step, setStep]         = useState(0);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [saving, setSaving]     = useState(false);
  const router                  = useRouter();

  async function finish() {
    setSaving(true);
    const chosenDeadline = deadline ?? defaultDeadline();
    await fetch('/api/vocab/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deadline: chosenDeadline.toISOString() }),
    });
    router.replace('/vocab/home');
  }

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5"
      style={{ background: 'var(--color-lx-base)' }}
    >
      <AnimatePresence mode="wait">
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
              onNext={(d) => { setDeadline(d); setStep(2); }}
            />
          </motion.div>
        )}

        {step === 2 && (
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
              onComplete={() => setStep(3)}
            />
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <StepReady saving={saving} onFinish={finish} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grain overlay */}
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
