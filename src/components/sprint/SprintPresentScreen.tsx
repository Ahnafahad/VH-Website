'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import RichText from '@/components/workbook/RichText';
import type { SprintLiveStats } from '@/lib/sprint/types';

const POLL_MS = 4000;

/**
 * Only the instructor's own browser renders this screen, so "revealed" is
 * local UI state, not synced anywhere — the class answers on their own
 * devices while this page just controls what's shown to the room.
 */
export default function SprintPresentScreen({ setId }: { setId: number }) {
  const [stats, setStats] = useState<SprintLiveStats | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/sprint/sets/${setId}/live`);
    if (res.ok) setStats(await res.json());
  }, [setId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const question = stats?.questions[index];
  const isRevealed = question ? revealed.has(question.id) : false;

  function reveal() {
    if (!question || isRevealed) return;
    setRevealed(prev => new Set(prev).add(question.id));
  }

  function go(delta: number) {
    if (!stats) return;
    setIndex(i => Math.min(Math.max(i + delta, 0), stats.questions.length - 1));
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center">
        <p className="text-exam-ink-muted">Loading…</p>
      </div>
    );
  }
  if (!question) {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center">
        <p className="text-exam-ink-muted">This set has no questions.</p>
      </div>
    );
  }

  const maxCount = Math.max(1, ...question.options.map(o => question.counts[o.key] ?? 0));

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink flex flex-col">
      <div className="border-b border-exam-border px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest">{stats.set.title}</p>
          <p className="text-exam-ink-faint text-xs mt-0.5">Question {index + 1} of {stats.questions.length}</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-exam-ink-muted text-sm tabular-nums">{stats.submittedCount} submitted</p>
          <Link href={`/admin/sprint/${setId}/live`} className="text-exam-gold text-sm underline">Dashboard</Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-3xl w-full space-y-8">
          <div className="text-2xl md:text-3xl leading-snug text-center">
            <RichText content={question.stem} />
          </div>

          <div className="space-y-3">
            {question.options.map(opt => {
              const count = question.counts[opt.key] ?? 0;
              const isCorrect = opt.key === question.correctKey;
              const pct = isRevealed ? (count / maxCount) * 100 : 0;
              return (
                <button
                  key={opt.key}
                  onClick={reveal}
                  disabled={isRevealed}
                  className={[
                    'relative w-full text-left flex items-center gap-4 p-4 rounded-xl border overflow-hidden transition-colors duration-150',
                    isRevealed && isCorrect ? 'border-emerald-500' : 'border-exam-border',
                    'bg-exam-elevated',
                    !isRevealed ? 'hover:border-exam-gold/40 cursor-pointer' : '',
                  ].join(' ')}
                >
                  {isRevealed && (
                    <div
                      className={`absolute inset-y-0 left-0 ${isCorrect ? 'bg-emerald-500/15' : 'bg-exam-ink/5'}`}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <span
                    className={[
                      'relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold',
                      isRevealed && isCorrect ? 'bg-emerald-500 text-white' : 'bg-exam-surface border border-exam-gold/20 text-exam-ink-faint',
                    ].join(' ')}
                  >
                    {opt.key}
                  </span>
                  <span className="relative flex-1 text-lg leading-relaxed">
                    <RichText content={opt.text} />
                  </span>
                  {isRevealed && (
                    <span className="relative text-sm font-mono tabular-nums text-exam-ink-muted">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {isRevealed && (
            <p className="text-center text-exam-ink-muted text-sm">
              {question.correctCount}/{question.answeredCount || 0} correct so far{question.skipped > 0 ? ` · ${question.skipped} skipped` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-exam-border px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-exam-ink-muted hover:text-exam-ink disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => go(1)}
          disabled={index === stats.questions.length - 1}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-exam-ink-muted hover:text-exam-ink disabled:opacity-30 transition-colors"
        >
          Next
        </button>
      </div>
    </main>
  );
}
