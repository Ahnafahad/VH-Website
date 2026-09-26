'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LevelPath from '@/components/redline/LevelPath';
import RedlineDashboard from '@/components/redline/RedlineDashboard';
import type { RedlineAnalysis, RedlineLevelTile } from '@/lib/redline/types';

type PageState =
  | { kind: 'loading' }
  | { kind: 'inactive' }
  | { kind: 'ready'; staff: boolean; active: boolean; levels: RedlineLevelTile[]; analysis: RedlineAnalysis }
  | { kind: 'error'; message: string };

export default function RedlinePage() {
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/redline/overview')
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setState({ kind: 'error', message: body.error ?? 'Could not load Redline.' }); return; }
        if (!body.active && !body.staff) { setState({ kind: 'inactive' }); return; }
        setState({ kind: 'ready', staff: body.staff, active: body.active, levels: body.levels, analysis: body.analysis });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Network error. Check your connection.' }); });
    return () => { cancelled = true; };
  }, []);

  const next = state.kind === 'ready'
    ? state.levels.find(l => l.status === 'open' && l.inProgress) ?? state.levels.find(l => l.status === 'open')
    : undefined;

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-4xl mx-auto px-4 pb-10 sm:pb-14" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">Sentence Correction Mastery</p>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold text-exam-ink mb-3">Redline</h1>
          <p className="text-exam-ink-muted text-base max-w-xl">
            Forty-two levels of sentence correction, twenty questions each. Finish a level to unlock the next. Every answer teaches you the rule and teaches us where you slip, so your dashboard below shows exactly what to fix.
          </p>
          {next && (
            <Link href={`/redline/level/${next.level}`} className="inline-block mt-6 px-5 py-2.5 rounded-lg text-sm font-bold bg-exam-maroon-bright text-exam-ink hover:brightness-110">
              {next.inProgress ? 'Continue' : 'Start'} Level {next.level}
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-14">
        {state.kind === 'loading' && <p className="text-exam-ink-muted">Loading…</p>}
        {state.kind === 'error' && <p className="text-exam-danger">{state.message}</p>}
        {state.kind === 'inactive' && <p className="text-exam-ink-muted">Redline is not open yet. Your instructors will switch it on soon.</p>}
        {state.kind === 'ready' && (
          <>
            {state.staff && (
              <p className="rounded-xl border border-exam-border bg-exam-elevated p-3 text-sm text-exam-ink-muted">
                Staff preview{state.active ? '' : ' (module is switched off for students)'}. Your answers here are excluded from cohort analytics.
              </p>
            )}
            <section aria-labelledby="levels-h">
              <h2 id="levels-h" className="font-serif text-2xl font-semibold mb-5">Levels</h2>
              <LevelPath levels={state.levels} />
            </section>
            <section aria-labelledby="dash-h">
              <h2 id="dash-h" className="sr-only">Dashboard</h2>
              <RedlineDashboard analysis={state.analysis} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
