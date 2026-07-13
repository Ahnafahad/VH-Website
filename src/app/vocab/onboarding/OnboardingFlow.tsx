'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import StepWelcome from './steps/StepWelcome';
import StepDeadline from './steps/StepDeadline';
import StepGoal, { type LearningGoal } from './steps/StepGoal';
import StepLearningSprint from './steps/StepLearningSprint';
import { RETENTION_EVENTS, trackRetention } from '@/lib/vocab/retention-events';

const steps = ['Welcome', 'Your goal', 'Your pace', 'First recall'];

export default function OnboardingFlow({ userId: _userId, userName }: { userId: number; userName: string }) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<LearningGoal>('general');
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [wordsPerDay, setWordsPerDay] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  useEffect(() => { trackRetention(RETENTION_EVENTS.onboardingStarted); }, []);

  async function completeRecall(payload: { starterWordIds: number[]; recalledWordId: number; selectedWordId: number }) {
    if (submitting) return false;
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/vocab/onboarding/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deadline: (deadline ?? defaultDeadline()).toISOString(), wordsPerDay, learningGoal: goal, ...payload,
        }),
      });
      const result = await response.json() as { ok?: boolean; isCorrect?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Your progress could not be saved.');
      if (!result.isCorrect) return false;
      window.setTimeout(() => router.replace('/vocab/home?activated=1'), reduceMotion ? 900 : 1500);
      return true;
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Your progress could not be saved. Try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="lx-root lx-onboarding-root">
      <div className="lx-onboarding-progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label={`${steps[step]}, step ${step + 1} of ${steps.length}`}>
        <div>{steps.map((label, index) => <span key={label} className={index <= step ? 'is-active' : ''} />)}</div>
        <p>{steps[step]} · {step + 1} of {steps.length}</p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} className="lx-onboarding-stage"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.16, 1, 0.3, 1] }}>
          {step === 0 && <StepWelcome userName={userName} onNext={() => setStep(1)} />}
          {step === 1 && <StepGoal onNext={value => { setGoal(value); setStep(2); }} />}
          {step === 2 && <StepDeadline onNext={(value, pace) => { setDeadline(value); setWordsPerDay(pace); setStep(3); }} />}
          {step === 3 && <StepLearningSprint onRecall={completeRecall} />}
        </motion.div>
      </AnimatePresence>
      {submitError && <p className="lx-onboarding-submit-error" role="alert">{submitError}</p>}
    </main>
  );
}

function defaultDeadline() {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date;
}
