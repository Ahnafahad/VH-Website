'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MarathonChapterListEntry } from '@/lib/marathon/types';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; chapters: MarathonChapterListEntry[] }
  | { kind: 'error'; message: string };

export default function MarathonHubPage() {
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/marathon')
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setState({ kind: 'error', message: body.error ?? 'Could not load the marathon.' });
          return;
        }
        const body: { chapters: MarathonChapterListEntry[] } = await res.json();
        if (!cancelled) setState({ kind: 'ready', chapters: body.chapters });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Network error — check your connection.' }); });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">Math Marathon</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mb-2">Chapter Drills</h1>
          <p className="text-exam-ink-muted text-base max-w-lg">
            30 questions a day, one chapter at a time. Days unlock on schedule — finish a day late and later days still open on time.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-10">
        {state.kind === 'loading' && <p className="text-exam-ink-muted">Loading…</p>}
        {state.kind === 'error' && <p className="text-red-400">{state.message}</p>}
        {state.kind === 'ready' && state.chapters.length === 0 && (
          <p className="text-exam-ink-muted">No marathon has been assigned to you yet.</p>
        )}
        {state.kind === 'ready' && state.chapters.map(chapter => (
          <section key={chapter.id}>
            <h2 className="font-serif text-xl font-semibold mb-1">{chapter.title}</h2>
            <p className="text-exam-ink-faint text-xs mb-4">{chapter.totalDays} days · {chapter.questionsPerDay} questions/day</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
              {chapter.days.map(d => (
                <DayTile key={d.id} slug={chapter.slug} day={d} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function DayTile({ slug, day }: { slug: string; day: MarathonChapterListEntry['days'][number] }) {
  const locked = day.state === 'locked';
  const submitted = day.attempt?.status === 'submitted';
  const inProgress = day.attempt?.status === 'in_progress';
  const href = locked ? undefined : submitted ? `/marathon/${slug}/${day.dayNumber}/results` : `/marathon/${slug}/${day.dayNumber}`;

  const tile = (
    <div className={[
      'aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors',
      locked ? 'bg-exam-surface border-exam-border opacity-50 cursor-not-allowed' :
      submitted ? 'bg-emerald-500/10 border-emerald-600/40 hover:border-emerald-500' :
      inProgress ? 'bg-exam-maroon/15 border-exam-maroon-bright hover:border-exam-gold' :
      'bg-exam-elevated border-exam-border hover:border-exam-gold/50',
    ].join(' ')}>
      <span className="text-lg font-bold text-exam-ink">{day.dayNumber}</span>
      <span className="text-[10px] text-exam-ink-faint uppercase tracking-wide">
        {locked ? 'Locked' : submitted ? `${day.attempt?.correct ?? 0}/${day.totalQuestions}` : inProgress ? 'Resume' : 'Start'}
      </span>
    </div>
  );

  return href ? <Link href={href}>{tile}</Link> : tile;
}
