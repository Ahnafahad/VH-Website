'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import TimerArc from '@/components/tests/TimerArc';
import OmrSheet from '@/components/tests/OmrSheet';
import SubmitDialog from '@/components/tests/SubmitDialog';
import type { AttemptPayload } from '@/lib/tests/types';

interface Props {
  slug: string;
  bucket: string;
  initialPayload: AttemptPayload;
}

export default function OfflineExamScreen({ slug, bucket, initialPayload }: Props) {
  const router = useRouter();

  const initAnswers = () => {
    const m: Record<number, string | null> = {};
    for (const a of initialPayload.answers) {
      m[a.questionId] = a.selectedKey;
    }
    return m;
  };

  const [answers, setAnswers] = useState<Record<number, string | null>>(initAnswers);
  const [submitDialog, setSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = useCallback(async (questionId: number, key: string | null) => {
    setAnswers(prev => ({ ...prev, [questionId]: key }));
    try {
      await fetch(`/api/tests/${slug}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, selectedKey: key }),
      });
    } catch { /* fire-and-forget; no anti-cheat in offline mode */ }
  }, [slug]);

  const doSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/tests/${slug}/submit`, { method: 'POST' });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
      setSubmitDialog(false);
    }
  }, [slug]);

  const handleAutoSubmit = useCallback(() => {
    if (!submitted) doSubmit();
  }, [doSubmit, submitted]);

  const allQuestions = initialPayload.sections.flatMap(s => s.questions);
  const answeredCount = allQuestions.filter(q => answers[q.id] != null).length;
  const blankCount = allQuestions.length - answeredCount;

  if (submitted) {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
          className="max-w-sm"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-exam-gold mb-6"
            style={{ boxShadow: 'var(--color-exam-glow-gold) 0 0 32px 0' }}>
            <span className="text-exam-gold text-2xl">✓</span>
          </div>
          <h1 className="text-exam-ink font-serif text-2xl font-semibold mb-2">Answers Locked In</h1>
          <p className="text-exam-ink-muted text-sm leading-relaxed mb-6">
            Results will be available once the test window closes and all answers have been reviewed.
          </p>
          <button
            onClick={() => router.push(`/tests/${bucket}`)}
            className="px-6 py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors"
          >
            Back to Tests
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-exam-base flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-exam-ink text-sm font-semibold">{initialPayload.test.title}</h1>
          <p className="text-exam-ink-faint text-xs">Offline Answer Entry</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-exam-elevated border border-exam-border">
            <TimerArc deadlineMs={initialPayload.attempt.deadline} onExpire={handleAutoSubmit} />
          </div>
          <motion.button
            onClick={() => setSubmitDialog(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 22 }}
            className="px-3 py-1.5 rounded-lg bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-xs font-medium transition-colors"
          >
            Submit
          </motion.button>
        </div>
      </header>

      <OmrSheet
        sections={initialPayload.sections}
        answers={answers}
        onAnswer={handleAnswer}
      />

      <SubmitDialog
        open={submitDialog}
        answered={answeredCount}
        flagged={0}
        blank={blankCount}
        total={allQuestions.length}
        onConfirm={doSubmit}
        onCancel={() => setSubmitDialog(false)}
        isLoading={submitting}
      />
    </div>
  );
}
