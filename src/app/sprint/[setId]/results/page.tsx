'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import type { SprintLeaderboardRow } from '@/lib/sprint/types';

function formatTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; leaderboard: SprintLeaderboardRow[] }
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
        const body: { leaderboard: SprintLeaderboardRow[] } = await res.json();
        if (!cancelled) setState({ kind: 'ready', leaderboard: body.leaderboard });
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
        <Link href="/sprint" className="inline-block text-exam-gold text-sm underline">Back to Sprint</Link>
      </div>
    </main>
  );
}
