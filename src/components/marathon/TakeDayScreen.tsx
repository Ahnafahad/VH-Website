'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RichText from '@/components/workbook/RichText';
import OptionCard from '@/components/tests/OptionCard';
import { Button } from '@/components/ui/button';
import type { MarathonAttemptPayload } from '@/lib/marathon/types';

const HEARTBEAT_MS = 4000;
const MIN_FLUSH_MS = 300;
const MAX_PAUSES = 2;

interface AnswerState { selectedKey: string | null; timeSpentMs: number; visited: boolean }

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TakeDayScreen({ slug, day, initial }: { slug: string; day: number; initial: MarathonAttemptPayload }) {
  const router = useRouter();
  const [payload] = useState(initial);
  const [answers, setAnswers] = useState<Map<number, AnswerState>>(() => {
    const m = new Map<number, AnswerState>();
    for (const q of payload.questions) m.set(q.id, { selectedKey: null, timeSpentMs: 0, visited: false });
    for (const a of payload.answers) m.set(a.questionId, { selectedKey: a.selectedKey, timeSpentMs: a.timeSpentMs, visited: a.visited });
    return m;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pausedAt, setPausedAt] = useState<number | null>(payload.attempt.pausedAt);
  const [pauseCount, setPauseCount] = useState(payload.attempt.pauseCount);
  const [totalPausedMs, setTotalPausedMs] = useState(payload.attempt.totalPausedMs);
  const [now, setNow] = useState(Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = payload.questions[currentIndex];
  const segmentStartRef = useRef<number>(Date.now());
  const pausedRef = useRef(pausedAt !== null);
  pausedRef.current = pausedAt !== null;

  // ── Clock tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedActiveMs = useMemo(() => {
    const raw = now - payload.attempt.startedAt - totalPausedMs;
    const openPause = pausedAt !== null ? Math.max(0, now - pausedAt) : 0;
    return Math.max(0, raw - openPause);
  }, [now, payload.attempt.startedAt, totalPausedMs, pausedAt]);

  // ── Time heartbeat: flush accumulated ms on the CURRENT question ──────────
  const flush = useCallback((questionId: number) => {
    const elapsed = Date.now() - segmentStartRef.current;
    segmentStartRef.current = Date.now();
    if (elapsed < MIN_FLUSH_MS || pausedRef.current) return;
    setAnswers(prev => {
      const next = new Map(prev);
      const cur = next.get(questionId);
      if (cur) next.set(questionId, { ...cur, timeSpentMs: cur.timeSpentMs + elapsed, visited: true });
      return next;
    });
    fetch(`/api/marathon/${slug}/${day}/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, deltaMs: elapsed }),
      keepalive: true,
    }).catch(() => {});
  }, [slug, day]);

  // Mark current question visited immediately (before any time accrues) so the navigator updates.
  useEffect(() => {
    if (!question) return;
    segmentStartRef.current = Date.now();
    setAnswers(prev => {
      const cur = prev.get(question.id);
      if (cur?.visited) return prev;
      const next = new Map(prev);
      if (cur) next.set(question.id, { ...cur, visited: true });
      return next;
    });
    const id = setInterval(() => flush(question.id), HEARTBEAT_MS);
    return () => {
      clearInterval(id);
      flush(question.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, flush]);

  // Flush on tab hide / unload so a closed tab doesn't lose the open segment.
  useEffect(() => {
    const onHide = () => { if (question) flush(question.id); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [question, flush]);

  const goTo = (index: number) => {
    if (index < 0 || index >= payload.questions.length) return;
    setCurrentIndex(index);
  };

  const selectOption = async (key: string) => {
    if (!question || pausedAt !== null) return;
    setAnswers(prev => {
      const next = new Map(prev);
      const cur = next.get(question.id)!;
      next.set(question.id, { ...cur, selectedKey: key });
      return next;
    });
    fetch(`/api/marathon/${slug}/${day}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: question.id, selectedKey: key }),
    }).catch(() => {});
  };

  const skip = () => {
    if (!question) return;
    flush(question.id);
    goTo(currentIndex + 1);
  };

  const togglePause = async () => {
    setPauseBusy(true);
    setError(null);
    try {
      if (pausedAt === null) {
        if (question) flush(question.id);
        const res = await fetch(`/api/marathon/${slug}/${day}/pause`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pause' }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Could not pause');
        setPausedAt(body.pausedAt);
        setPauseCount(body.pauseCount);
      } else {
        const res = await fetch(`/api/marathon/${slug}/${day}/pause`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resume' }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Could not resume');
        setTotalPausedMs(prev => prev + Math.max(0, Date.now() - (pausedAt ?? Date.now())));
        setPausedAt(null);
        if (question) segmentStartRef.current = Date.now();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setPauseBusy(false);
    }
  };

  const doSubmit = async () => {
    if (question) flush(question.id);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/marathon/${slug}/${day}/submit`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not submit');
      router.push(`/marathon/${slug}/${day}/results`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  if (!question) return null;
  const answered = payload.questions.filter(q => answers.get(q.id)?.selectedKey).length;
  const isPaused = pausedAt !== null;

  return (
    <div className="min-h-screen bg-exam-base text-exam-ink">
      {/* Masthead */}
      <div className="border-b border-exam-border bg-exam-surface sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-exam-gold text-xs font-bold uppercase tracking-widest">{payload.chapter.title}</p>
            <p className="text-sm text-exam-ink-muted">Day {payload.day.dayNumber} · Question {currentIndex + 1} of {payload.questions.length}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-mono text-lg tabular-nums text-exam-ink">{formatClock(elapsedActiveMs)}</p>
              <p className="text-[11px] text-exam-ink-faint">{answered}/{payload.questions.length} answered</p>
            </div>
            <Button variant="outline" size="sm" disabled={pauseBusy || (pauseCount >= MAX_PAUSES && !isPaused)} onClick={togglePause}>
              {isPaused ? 'Resume' : `Pause (${MAX_PAUSES - pauseCount} left)`}
            </Button>
            <Button variant="default" size="sm" onClick={() => setConfirmSubmit(true)}>Submit Day</Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6">
        {/* Question panel */}
        <div className={isPaused ? 'pointer-events-none opacity-30 select-none' : ''}>
          <div className="bg-exam-elevated border border-exam-border rounded-xl p-5 mb-4">
            <p className="text-xs text-exam-gold font-bold mb-2">Question {question.number}</p>
            <div className="text-base leading-relaxed text-exam-ink">
              <RichText content={question.stem} />
            </div>
            {question.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={question.imageUrl} alt="" className="mt-4 max-w-full rounded-lg" />
            )}
          </div>
          <div className="space-y-2.5">
            {question.options.map(opt => (
              <OptionCard
                key={opt.key}
                optionKey={opt.key}
                text={opt.text}
                selected={answers.get(question.id)?.selectedKey === opt.key}
                onSelect={() => selectOption(opt.key)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-5">
            <Button variant="outline" size="sm" disabled={currentIndex === 0} onClick={() => { flush(question.id); goTo(currentIndex - 1); }}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={skip}>Skip</Button>
              <Button
                variant="default"
                size="sm"
                disabled={currentIndex === payload.questions.length - 1}
                onClick={() => { flush(question.id); goTo(currentIndex + 1); }}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* Navigator */}
        <div className="bg-exam-elevated border border-exam-border rounded-xl p-4 h-fit">
          <p className="text-xs font-bold uppercase tracking-wide text-exam-ink-faint mb-3">Questions</p>
          <div className="grid grid-cols-6 md:grid-cols-5 gap-1.5">
            {payload.questions.map((q, i) => {
              const a = answers.get(q.id);
              const status = a?.selectedKey ? 'answered' : a?.visited ? 'skipped' : 'unvisited';
              const isCurrent = i === currentIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => { flush(question.id); goTo(i); }}
                  className={[
                    'h-8 rounded-md text-xs font-semibold flex items-center justify-center border transition-colors',
                    isCurrent ? 'ring-2 ring-exam-gold-bright' : '',
                    status === 'answered' ? 'bg-exam-maroon/30 border-exam-maroon-bright text-exam-ink' :
                    status === 'skipped' ? 'bg-exam-surface border-exam-gold/30 text-exam-ink-muted' :
                    'bg-exam-surface border-exam-border text-exam-ink-faint',
                  ].join(' ')}
                >
                  {q.number}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1.5 text-[11px] text-exam-ink-faint">
            <p><span className="inline-block w-2.5 h-2.5 rounded-sm bg-exam-maroon/30 border border-exam-maroon-bright mr-1.5 align-middle" /> Answered</p>
            <p><span className="inline-block w-2.5 h-2.5 rounded-sm bg-exam-surface border border-exam-gold/30 mr-1.5 align-middle" /> Skipped</p>
            <p><span className="inline-block w-2.5 h-2.5 rounded-sm bg-exam-surface border border-exam-border mr-1.5 align-middle" /> Not seen</p>
          </div>
        </div>
      </div>

      {/* Pause overlay */}
      {isPaused && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-20 p-4">
          <div className="bg-exam-surface border border-exam-border rounded-xl p-8 max-w-sm text-center">
            <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-2">Paused</p>
            <p className="text-exam-ink text-lg font-semibold mb-1">Stopwatch stopped</p>
            <p className="text-exam-ink-muted text-sm mb-6">Your progress is saved. Resume when you're ready — you have {MAX_PAUSES - pauseCount} pause{MAX_PAUSES - pauseCount === 1 ? '' : 's'} left after this.</p>
            <Button onClick={togglePause} disabled={pauseBusy} className="w-full">Resume</Button>
          </div>
        </div>
      )}

      {/* Submit confirm */}
      {confirmSubmit && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-20 p-4">
          <div className="bg-exam-surface border border-exam-border rounded-xl p-8 max-w-sm text-center">
            <p className="text-exam-ink text-lg font-semibold mb-1">Submit Day {payload.day.dayNumber}?</p>
            <p className="text-exam-ink-muted text-sm mb-6">
              You've answered {answered} of {payload.questions.length}. Once submitted you can't change any answers, but you'll see the answer key and solutions right away.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmSubmit(false)} disabled={submitting}>Keep working</Button>
              <Button className="flex-1" onClick={doSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
