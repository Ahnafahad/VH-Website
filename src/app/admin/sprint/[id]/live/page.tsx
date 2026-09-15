'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SUBJECT_LABELS } from '@/lib/lms/subject-constants';
import type { SprintLiveStats } from '@/lib/sprint/types';

const POLL_MS = 4000;

function formatTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; stats: SprintLiveStats }
  | { kind: 'error'; message: string };

export default function SprintLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/sprint/sets/${id}/live`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setState({ kind: 'error', message: body.error ?? 'Could not load live stats.' });
      return;
    }
    setState({ kind: 'ready', stats: await res.json() });
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const toggleStatus = async () => {
    if (state.kind !== 'ready') return;
    setToggling(true);
    const nextStatus = state.stats.set.status === 'active' ? 'draft' : 'active';
    await fetch(`/api/admin/sprint/sets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    await load();
    setToggling(false);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/sprint/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/admin/sprint" className="text-sm text-muted-foreground hover:underline">&larr; Sprint</Link>

      {state.kind === 'loading' && <p className="text-muted-foreground mt-6">Loading…</p>}
      {state.kind === 'error' && <p className="text-destructive mt-6">{state.message}</p>}

      {state.kind === 'ready' && (
        <>
          <div className="flex items-start justify-between gap-4 mt-2 mb-6">
            <div>
              <h1 className="text-2xl font-semibold">{state.stats.set.title}</h1>
              <p className="text-muted-foreground text-sm">
                {SUBJECT_LABELS[state.stats.set.subject]} · {state.stats.questionCount} questions
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={state.stats.set.status === 'active' ? 'text-emerald-600 text-xs font-semibold' : 'text-muted-foreground text-xs'}>
                {state.stats.set.status}
              </span>
              <Button variant="outline" size="sm" disabled={toggling} onClick={toggleStatus}>
                {state.stats.set.status === 'active' ? 'Deactivate' : 'Activate'}
              </Button>
              <Button variant="outline" size="sm" render={<Link href={`/sprint/${id}/present`} />}>
                Present
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-xl px-4 py-3 mb-6 text-sm">
            <span className="text-muted-foreground truncate">/sprint/{id}</span>
            <Button variant="outline" size="sm" onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</Button>
          </div>

          <div className="text-center mb-8">
            <p className="text-5xl font-semibold tabular-nums">{state.stats.submittedCount}</p>
            <p className="text-muted-foreground text-sm">submitted</p>
          </div>

          <div className="border rounded-xl divide-y mb-8">
            {state.stats.questions.map(q => {
              const maxCount = Math.max(1, ...q.options.map(o => q.counts[o.key] ?? 0));
              return (
                <div key={q.id} className="px-4 py-3">
                  <p className="text-sm font-medium mb-2">Q{q.number}. {q.stem}</p>
                  <div className="space-y-1.5">
                    {q.options.map(o => {
                      const count = q.counts[o.key] ?? 0;
                      const isCorrect = o.key === q.correctKey;
                      const pct = (count / maxCount) * 100;
                      return (
                        <div key={o.key} className="flex items-center gap-2 text-xs">
                          <span className={`w-4 shrink-0 font-semibold ${isCorrect ? 'text-emerald-600' : 'text-muted-foreground'}`}>{o.key}</span>
                          <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                            <div
                              className={`h-full ${isCorrect ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-right shrink-0 tabular-nums text-muted-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {q.correctCount}/{q.answeredCount || 0} correct so far{q.skipped > 0 ? ` · ${q.skipped} skipped` : ''}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="border rounded-xl divide-y">
            <div className="px-4 py-3">
              <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Leaderboard</p>
            </div>
            {state.stats.leaderboard.length === 0 && (
              <p className="text-sm text-muted-foreground px-4 py-3">No submissions yet.</p>
            )}
            {state.stats.leaderboard.map(row => (
              <div key={row.userId} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-muted-foreground font-bold">#{row.rank}</span>
                  <span>{row.name}</span>
                </div>
                <span className="font-mono text-muted-foreground tabular-nums">
                  {row.totalCorrect}/{row.totalQuestions} · {formatTime(row.totalTimeMs)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
