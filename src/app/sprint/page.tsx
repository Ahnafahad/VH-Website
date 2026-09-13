'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SUBJECT_LABELS } from '@/lib/lms/subject-constants';
import type { SprintSetListEntry } from '@/lib/sprint/types';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; sets: SprintSetListEntry[] }
  | { kind: 'error'; message: string };

export default function SprintHubPage() {
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sprint')
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setState({ kind: 'error', message: body.error ?? 'Could not load Sprint.' });
          return;
        }
        const body: { sets: SprintSetListEntry[] } = await res.json();
        if (!cancelled) setState({ kind: 'ready', sets: body.sets });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Network error — check your connection.' }); });
    return () => { cancelled = true; };
  }, []);

  const bySubject = state.kind === 'ready'
    ? state.sets.reduce<Record<string, SprintSetListEntry[]>>((acc, s) => {
        (acc[s.subject] ??= []).push(s);
        return acc;
      }, {})
    : {};

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div
          className="max-w-4xl mx-auto px-4 pb-10 sm:pb-14"
          style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}
        >
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">Sprint</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mb-2">In-Class Sprints</h1>
          <p className="text-exam-ink-muted text-base max-w-lg">
            Quick rounds of MCQs with a stopwatch running — answer or skip, see the correct answer right away, then move on. One attempt per set.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-10">
        {state.kind === 'loading' && <p className="text-exam-ink-muted">Loading…</p>}
        {state.kind === 'error' && <p className="text-red-400">{state.message}</p>}
        {state.kind === 'ready' && state.sets.length === 0 && (
          <p className="text-exam-ink-muted">No Sprint sets are active right now.</p>
        )}
        {Object.entries(bySubject).map(([subject, sets]) => (
          <section key={subject}>
            <h2 className="font-serif text-xl font-semibold mb-4">
              {SUBJECT_LABELS[subject as keyof typeof SUBJECT_LABELS] ?? subject}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {sets.map(s => <SetCard key={s.id} set={s} />)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function SetCard({ set }: { set: SprintSetListEntry }) {
  const done = !!set.attempt;
  const href = done ? `/sprint/${set.id}/results` : `/sprint/${set.id}`;

  return (
    <Link
      href={href}
      className={[
        'rounded-xl border p-4 flex items-center justify-between gap-3 transition-colors',
        done ? 'bg-emerald-500/10 border-emerald-600/40 hover:border-emerald-500'
             : 'bg-exam-elevated border-exam-border hover:border-exam-gold/50',
      ].join(' ')}
    >
      <div>
        <p className="font-semibold text-exam-ink">{set.title}</p>
        <p className="text-xs text-exam-ink-faint mt-0.5">{set.questionCount} questions</p>
      </div>
      <span className="text-xs font-bold uppercase tracking-wide text-exam-ink-muted whitespace-nowrap">
        {done ? `${set.attempt!.totalCorrect}/${set.attempt!.totalQuestions}` : 'Start'}
      </span>
    </Link>
  );
}
