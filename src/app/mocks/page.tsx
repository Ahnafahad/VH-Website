'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MockListEntry, MockWindowDTO } from '@/lib/mocks/types';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; mocks: MockListEntry[] }
  | { kind: 'error'; message: string };

const DHAKA = 'Asia/Dhaka';
const fmt = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { timeZone: DHAKA, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const WINDOW_LABEL: Record<string, string> = { online: 'Online', offline: 'In-class answer entry' };
const STATE_STYLE: Record<MockWindowDTO['state'], string> = {
  upcoming: 'text-exam-ink-faint border-exam-border bg-exam-elevated',
  open: 'text-exam-success border-exam-success/30 bg-exam-success/10',
  closed: 'text-exam-ink-faint border-exam-border bg-exam-elevated',
};
const STATE_LABEL: Record<MockWindowDTO['state'], string> = { upcoming: 'Upcoming', open: 'Open now', closed: 'Closed' };

const primaryBtn = 'inline-flex items-center px-5 py-2.5 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors';
const ghostBtn = 'inline-flex items-center px-5 py-2.5 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted hover:text-exam-ink text-sm transition-colors';

function MockCard({ mock }: { mock: MockListEntry }) {
  const open = mock.windows.find(w => w.state === 'open');
  const next = mock.windows.find(w => w.state === 'upcoming');
  const submitted = mock.attempt?.status === 'submitted';
  const examHref = `/tests/${mock.bucket}/${mock.slug}`;

  return (
    <article className="rounded-2xl border border-exam-border bg-exam-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold text-exam-ink">{mock.title}</h2>
        {mock.examCode && <span className="text-xs font-mono text-exam-ink-faint">Exam code {mock.examCode}</span>}
      </div>
      <p className="text-exam-ink-muted text-sm mt-1">
        Part 1 · {mock.totalQuestions} MCQs, {mock.totalMarks} marks
        {mock.essay ? ` · Part 2 · ${mock.essay.essayCount} essays, ${mock.essay.maxMarks} marks` : ''}
      </p>

      {mock.windows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {mock.windows.map(w => (
            <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATE_STYLE[w.state]}`}>
                {STATE_LABEL[w.state]}
              </span>
              <span className="text-exam-ink">{WINDOW_LABEL[w.mode] ?? w.mode}</span>
              <span className="text-exam-ink-muted">
                {fmt(w.opensAt)} – {new Date(w.closesAt).toLocaleTimeString('en-GB', { timeZone: DHAKA, hour: '2-digit', minute: '2-digit' })}
                {w.durationMinutes ? ` · ${w.durationMinutes} min` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {mock.phase === 'official' && (
          <Link href={`/mocks/${mock.slug}/results`} className={primaryBtn}>View results</Link>
        )}
        {mock.phase === 'provisional' && (
          <Link href={`/mocks/${mock.slug}/results`} className={primaryBtn}>View provisional result</Link>
        )}
        {mock.phase === 'locked' && submitted && (
          <p className="text-exam-ink-muted text-sm">Answers submitted. Your result appears about 10 minutes after the exam window closes.</p>
        )}
        {!submitted && open && <Link href={examHref} className={primaryBtn}>Sit the mock</Link>}
        {!submitted && !open && next && (
          <p className="text-exam-ink-muted text-sm">Opens {fmt(next.opensAt)}</p>
        )}
        {!submitted && !open && !next && mock.phase !== 'official' && (
          <p className="text-exam-ink-muted text-sm">No answers were submitted for this mock.</p>
        )}
      </div>

      {mock.essay && (
        <div className="mt-5 pt-4 border-t border-exam-border flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-exam-ink-muted">
            <span className="text-exam-ink">Essays</span> · {mock.essay.submitted} of {mock.essay.essayCount} uploaded · due {fmt(mock.essay.deadline)}
          </p>
          <Link href={`/essays/${mock.essay.seriesId}`} className={ghostBtn}>
            {mock.essay.submitted > 0 ? 'View / re-upload essays' : 'Upload essays'}
          </Link>
        </div>
      )}

      <p className="mt-4 text-xs text-exam-ink-faint">
        Sat it on paper? Your scanned OMR sheet is the official result, whatever you enter here.
      </p>
    </article>
  );
}

export default function MocksPage() {
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/mocks')
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setState({ kind: 'error', message: body.error ?? 'Could not load mocks.' });
          return;
        }
        const body: { mocks: MockListEntry[] } = await res.json();
        if (!cancelled) setState({ kind: 'ready', mocks: body.mocks });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Network error — check your connection.' }); });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div
          className="max-w-3xl mx-auto px-4 pb-10 sm:pb-14"
          style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}
        >
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">Mocks</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mb-2">Mock Exams</h1>
          <p className="text-exam-ink-muted text-base max-w-lg">
            Full-length IBA mocks: English, Mathematics and Analytical MCQs, then essays. Sit online or on paper;
            results are published once every sheet has been checked.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 space-y-6">
        {state.kind === 'loading' && <p className="text-exam-ink-muted">Loading…</p>}
        {state.kind === 'error' && <p className="text-red-400">{state.message}</p>}
        {state.kind === 'ready' && state.mocks.length === 0 && (
          <p className="text-exam-ink-muted">No mocks are scheduled for you yet.</p>
        )}
        {state.kind === 'ready' && state.mocks.map(m => <MockCard key={m.slug} mock={m} />)}
      </div>
    </main>
  );
}
