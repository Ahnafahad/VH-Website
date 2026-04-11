'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import StepWelcome from './steps/StepWelcome';
import StepDeadline from './steps/StepDeadline';
import StepTutorial from './steps/StepTutorial';

interface Props {
  userId: number;
  userName: string;
}

export default function OnboardingFlow({ userId, userName }: Props) {
  const [step, setStep]       = useState(0);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [saving, setSaving]   = useState(false);
  const router                = useRouter();

  async function finish(chosenDeadline: Date) {
    setSaving(true);
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
      {/* Skip button — always visible on step 2 */}
      {step === 2 && (
        <button
          onClick={() => finish(deadline ?? defaultDeadline())}
          className="absolute right-5 top-5 text-sm"
          style={{ color: 'var(--color-lx-text-secondary)' }}
        >
          Skip
        </button>
      )}

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
            key="tutorial"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm"
          >
            <StepTutorial
              saving={saving}
              onFinish={() => finish(deadline ?? defaultDeadline())}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step dots */}
      <div className="absolute bottom-10 flex gap-2">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ scale: step === i ? 1.3 : 1 }}
            transition={{ duration: 0.15 }}
            className="h-2 w-2 rounded-full"
            style={{
              background: step === i
                ? 'var(--color-lx-accent-red)'
                : 'var(--color-lx-text-muted)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function defaultDeadline(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d;
}
