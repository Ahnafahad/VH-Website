'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import RichText from '@/components/workbook/RichText';
import SprintOptionCard from '@/components/sprint/SprintOptionCard';
import type { SprintLeaderboardRow, SprintReviewQuestion } from '@/lib/sprint/types';

function formatTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; leaderboard: SprintLeaderboardRow[]; review: SprintReviewQuestion[] | null }
  | { kind: 'error'; message: string };

export default function SprintResultsPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = use(params);
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sprint/${setId}/leaderboard`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setState({ kind: 'error', message: body.error ?? 'Could not load results.' });
          return;
        }
        const body: { leaderboard: SprintLeaderboardRow[]; review: SprintReviewQuestion[] | null } = await res.json();
        if (!cancelled) setState({ kind: 'ready', leaderboard: body.leaderboard, review: body.review });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Network error — check your connection.' }); });
    return () => { cancelled = true; };
  }, [setId]);

  const me = state.kind === 'ready' ? state.leaderboard.find(r => r.isMe) : undefined;

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div
        className="border-b border-exam-border bg-exam-surface"
        style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}
      >
        <div className="max-w-2xl mx-auto px-4 pb-10">
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">Sprint Results</p>
          {me && (
            <h1 className="font-serif text-3xl font-semibold text-exam-ink mb-2">
              {me.totalCorrect}/{me.totalQuestions} correct · {formatTime(me.totalTimeMs)}
            </h1>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {state.kind === 'loading' && <p className="text-exam-ink-muted">Loading…</p>}
        {state.kind === 'error' && <p className="text-red-400">{state.message}</p>}
        {state.kind === 'ready' && (
          <div className="rounded-xl border border-exam-border bg-exam-elevated overflow-hidden">
            <div className="px-4 py-3 border-b border-exam-border">
              <p className="text-sm font-bold uppercase tracking-wide text-exam-ink-faint">Leaderboard</p>
            </div>
            <div className="divide-y divide-exam-border">
              {state.leaderboard.map(row => (
                <div
                  key={row.userId}
                  className={[
                    'px-4 py-3 flex items-center justify-between gap-3',
                    row.isMe ? 'bg-exam-maroon/10' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-sm font-bold text-exam-ink-faint">#{row.rank}</span>
                    <span className="text-sm text-exam-ink">{row.name}{row.isMe ? ' (you)' : ''}</span>
                  </div>
                  <span className="text-sm font-mono text-exam-ink-muted tabular-nums">
                    {row.totalCorrect}/{row.totalQuestions} · {formatTime(row.totalTimeMs)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {state.kind === 'ready' && state.review && (
          <section className="space-y-6 pt-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-exam-ink-faint">Review your answers</h2>
            {state.review.map(q => (
              <div key={q.id} className="rounded-xl border border-exam-border bg-exam-surface p-4 space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-exam-gold text-xs font-bold uppercase tracking-widest">Question {q.number}</p>
                  <p className={[
                    'text-xs font-bold uppercase tracking-wide',
                    q.selectedKey === null ? 'text-exam-ink-faint'
                    : q.selectedKey === q.correctKey ? 'text-emerald-500' : 'text-red-400',
                  ].join(' ')}>
                    {q.selectedKey === null ? 'Skipped' : q.selectedKey === q.correctKey ? 'Correct' : 'Wrong'}
                  </p>
                </div>
                <div className="text-base leading-relaxed text-exam-ink">
                  <RichText content={q.stem} />
                </div>
                <div className="space-y-3">
                  {q.options.map(opt => (
                    <SprintOptionCard
                      key={opt.key}
                      optionKey={opt.key}
                      text={opt.text}
                      selected={q.selectedKey === opt.key}
                      revealed
                      isCorrectKey={opt.key === q.correctKey}
                      onSelect={() => {}}
                    />
                  ))}
                </div>
                {q.explanation && (
                  <div className="rounded-xl border border-exam-border bg-exam-elevated p-4 text-sm text-exam-ink-muted leading-relaxed">
                    <RichText content={q.explanation} />
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
        <Link href="/sprint" className="inline-block text-exam-gold text-sm underline">Back to Sprint</Link>
      </div>
    </main>
  );
}
