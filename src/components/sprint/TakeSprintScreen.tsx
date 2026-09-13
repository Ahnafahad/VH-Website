'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RichText from '@/components/workbook/RichText';
import SprintOptionCard from './SprintOptionCard';
import type { SprintTakingQuestion, SprintSubmitAnswer } from '@/lib/sprint/types';

interface TakeSprintScreenProps {
  setId: number;
  title: string;
  questions: SprintTakingQuestion[];
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function TakeSprintScreen({ setId, title, questions }: TakeSprintScreenProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRef = useRef(performance.now());
  const questionStartRef = useRef(performance.now());
  const answersRef = useRef<Map<number, SprintSubmitAnswer>>(new Map());

  useEffect(() => {
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, []);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  function recordAnswer(key: string | null) {
    if (revealed || !question) return;
    const timeSpentMs = Math.round(performance.now() - questionStartRef.current);
    answersRef.current.set(question.id, { questionId: question.id, selectedKey: key, timeSpentMs });
    setSelectedKey(key);
    setRevealed(true);
  }

  async function goNext() {
    if (!isLast) {
      setIndex(i => i + 1);
      setSelectedKey(null);
      setRevealed(false);
      questionStartRef.current = performance.now();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sprint/${setId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: Array.from(answersRef.current.values()) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'ALREADY_SUBMITTED') { router.replace(`/sprint/${setId}/results`); return; }
        setError(body.error ?? 'Could not submit your attempt.');
        setSubmitting(false);
        return;
      }
      router.replace(`/sprint/${setId}/results`);
    } catch {
      setError('Network error — check your connection.');
      setSubmitting(false);
    }
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-exam-base text-exam-ink flex items-center justify-center px-4">
        <p className="text-exam-ink-muted">This set has no questions.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
      {/* Masthead — sticky top-24 (6rem) clears the fixed floating nav on scroll */}
      <div className="border-b border-exam-border bg-exam-surface sticky top-24 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-exam-gold text-xs font-bold uppercase tracking-widest">{title}</p>
            <p className="text-exam-ink-faint text-xs mt-0.5">Question {index + 1} of {questions.length}</p>
          </div>
          <div className="font-mono text-lg font-bold text-exam-ink tabular-nums">{formatElapsed(elapsed)}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-base leading-relaxed text-exam-ink">
          <RichText content={question.stem} />
        </div>

        <div className="space-y-3">
          {question.options.map(opt => (
            <SprintOptionCard
              key={opt.key}
              optionKey={opt.key}
              text={opt.text}
              selected={selectedKey === opt.key}
              revealed={revealed}
              isCorrectKey={opt.key === question.correctKey}
              onSelect={() => recordAnswer(opt.key)}
            />
          ))}
        </div>

        {revealed && question.explanation && (
          <div className="rounded-xl border border-exam-border bg-exam-elevated p-4 text-sm text-exam-ink-muted leading-relaxed">
            <RichText content={question.explanation} />
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          {!revealed && (
            <button
              onClick={() => recordAnswer(null)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-exam-ink-muted hover:text-exam-ink transition-colors"
            >
              Skip
            </button>
          )}
          {revealed && (
            <button
              onClick={goNext}
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg text-sm font-bold bg-exam-maroon-bright text-exam-ink hover:brightness-110 transition-[filter] disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : isLast ? 'Finish' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
