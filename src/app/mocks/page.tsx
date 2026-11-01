'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { MockListEntry } from '@/lib/mocks/types';
import {
  MOCK_SCHEDULE, formatSlotTime, mockExamCode, slotDay, slotRange, type MockSlot,
} from '@/lib/mocks/registration-pure';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; mocks: MockListEntry[] }
  | { kind: 'error'; message: string };

const DHAKA = 'Asia/Dhaka';
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { timeZone: DHAKA, hour: 'numeric', minute: '2-digit' });
const dayTime = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { timeZone: DHAKA, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

const WINDOW_LABEL: Record<string, string> = { online: 'Online', offline: 'Answer entry (paper)' };

const primaryBtn = 'inline-flex items-center justify-center px-5 py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors';
const ghostBtn = 'inline-flex items-center justify-center px-5 py-3 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted hover:text-exam-ink text-sm transition-colors';

type Tone = 'live' | 'todo' | 'done' | 'muted' | 'idle';
interface SlotStatus { label: string; tone: Tone }

const TONE: Record<Tone, string> = {
  live: 'text-exam-success border-exam-success/40 bg-exam-success/10',
  todo: 'text-exam-gold border-exam-gold/40 bg-exam-gold/10',
  done: 'text-exam-ink border-exam-border bg-exam-elevated',
  muted: 'text-exam-ink-faint border-exam-border bg-transparent',
  idle: 'text-exam-ink-muted border-exam-border bg-exam-elevated',
};

/** What the student should see for one routine slot right now. */
function slotStatus(slot: MockSlot, mock: MockListEntry | undefined, now: number): SlotStatus {
  const { end } = slotRange(slot);
  if (!mock) return { label: now > end.getTime() ? 'Paper not uploaded' : 'Not released yet', tone: 'muted' };
  if (mock.phase === 'official') return { label: 'Results out', tone: 'done' };
  const attempt = mock.attempt;
  const submitted = attempt?.status === 'submitted';
  const essaysLeft = mock.essay ? mock.essay.submitted < mock.essay.essayCount : false;
  if (mock.ended) {
    if (!submitted) return { label: 'Closed · not sat', tone: 'muted' };
    return { label: 'Answers published', tone: 'done' };
  }
  if (submitted) return { label: essaysLeft ? 'Upload essays' : 'Submitted', tone: essaysLeft ? 'todo' : 'done' };
  if (attempt?.status === 'in_progress') return { label: 'In progress', tone: 'todo' };
  if (mock.windows.some(w => w.state === 'open')) return { label: 'Live now', tone: 'live' };
  return { label: 'Not started yet', tone: 'idle' };
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Routine({ slots, mocks, now, selected, onSelect }: {
  slots: readonly MockSlot[]; mocks: MockListEntry[]; now: number; selected: number; onSelect: (n: number) => void;
}) {
  const rail = useRef<HTMLUListElement>(null);
  // keep the selected card in view (horizontal only; never scroll the page)
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>(`[data-slot="${selected}"]`);
    if (el && rail.current) rail.current.scrollTo({ left: el.offsetLeft - rail.current.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [selected]);

  return (
    <ul
      ref={rail}
      aria-label="Mock routine"
      className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-4 px-4 sm:mx-0 sm:px-0"
      style={{ scrollbarWidth: 'thin' }}
    >
      {slots.map(slot => {
        const mock = mocks.find(m => m.examCode === mockExamCode(slot.n));
        const st = slotStatus(slot, mock, now);
        const d = slotDay(slot.date);
        const on = slot.n === selected;
        return (
          <li key={slot.n} data-slot={slot.n} className="snap-start shrink-0">
            <button
              type="button"
              onClick={() => onSelect(slot.n)}
              aria-pressed={on}
              className={`w-44 sm:w-48 text-left rounded-2xl border p-4 transition-colors ${on ? 'border-exam-gold bg-exam-surface' : 'border-exam-border bg-exam-surface/60 hover:border-exam-gold/50'}`}
            >
              <span className="block font-serif text-3xl font-semibold text-exam-ink tabular-nums">{String(slot.n).padStart(2, '0')}</span>
              <span className="mt-2 block text-sm text-exam-ink">{d.weekday}</span>
              <span className="block text-sm text-exam-ink-muted">{d.day} {d.month}</span>
              <span className="mt-1 block text-xs text-exam-ink-faint">{formatSlotTime(slot.time)}</span>
              <span className={`mt-3 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONE[st.tone]}`}>{st.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** One mock's panel. `slot` is its place in the routine; a mock outside the routine (e.g. a sample) has none. */
function Detail({ slot, mock, now }: { slot: MockSlot | null; mock: MockListEntry | undefined; now: number }) {
  const d = slot ? slotDay(slot.date) : null;
  const start = slot ? slotRange(slot).start : new Date(0);
  const heading = slot ? `Mock ${String(slot.n).padStart(2, '0')}` : (mock?.title ?? 'Mock');
  const when = slot && d
    ? `${d.weekday} ${d.day} ${d.month} ${d.year}, ${formatSlotTime(slot.time)}`
    : mock?.windows[0] ? dayTime(mock.windows[0].opensAt) : '';

  if (!mock) {
    if (!slot) return null;
    return (
      <article className="rounded-2xl border border-exam-border bg-exam-surface p-5 sm:p-6">
        <h2 className="font-serif text-2xl font-semibold text-exam-ink">{heading}</h2>
        <p className="text-exam-ink-muted text-sm mt-1">{when}</p>
        <p className="mt-4 text-sm text-exam-ink-muted">
          {now < start.getTime()
            ? `The paper opens with its window. ${countdown(start.getTime() - now)} to go.`
            : 'This mock has not been uploaded yet.'}
        </p>
      </article>
    );
  }

  const submitted = mock.attempt?.status === 'submitted';
  const inProgress = mock.attempt?.status === 'in_progress';
  const open = mock.windows.find(w => w.state === 'open');
  const next = mock.windows.find(w => w.state === 'upcoming');
  const essay = mock.essay;
  const essayHref = essay && mock.hasElectives ? `/essays/${essay.seriesId}` : `/mocks/${mock.slug}/essays`;
  const essaysLeft = essay ? essay.submitted < essay.essayCount : false;
  const examHref = `/tests/${mock.bucket.replace('_', '-')}/${mock.slug}`;
  const status = slot ? slotStatus(slot, mock, now) : slotStatus(MOCK_SCHEDULE[0], mock, now);

  return (
    <article className="rounded-2xl border border-exam-border bg-exam-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-serif text-2xl font-semibold text-exam-ink">{heading}</h2>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${TONE[status.tone]}`}>{status.label}</span>
      </div>
      <p className="text-exam-ink-muted text-sm mt-1">
        {when} · Part 1 · {mock.totalQuestions} MCQs, {mock.totalMarks} marks
        {essay ? ` · Part 2 · ${essay.essayCount} essays, ${essay.maxMarks} marks` : ''}
      </p>

      {mock.windows.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-exam-border pt-4">
          {mock.windows.map(w => (
            <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${w.state === 'open' ? TONE.live : TONE.idle}`}>
                {w.state === 'open' ? 'Open now' : w.state === 'upcoming' ? 'Upcoming' : 'Closed'}
              </span>
              <span className="text-exam-ink">{WINDOW_LABEL[w.mode] ?? w.mode}</span>
              <span className="text-exam-ink-muted">
                {dayTime(w.opensAt)} – {clock(w.closesAt)}{w.durationMinutes ? ` · ${w.durationMinutes} min` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!submitted && !mock.ended && open && (
          <Link href={examHref} className={primaryBtn}>{inProgress ? 'Continue the mock' : mock.hasElectives ? 'Enter your MCQ answers' : 'Start the mock'}</Link>
        )}
        {!submitted && !open && next && !mock.ended && (
          <p className="text-exam-ink-muted text-sm">Opens {dayTime(next.opensAt)} · in {countdown(next.opensAt - now)}</p>
        )}
        {submitted && essay && essaysLeft && !mock.ended && (
          <Link href={essayHref} className={primaryBtn}>{mock.hasElectives ? 'Upload written pages' : 'Upload your essays'}</Link>
        )}
        {submitted && !essaysLeft && !mock.ended && (
          <p className="text-exam-ink-muted text-sm">Everything is in. Your answers are published when the windows close.</p>
        )}
        {mock.ended && submitted && mock.reviewHref && (
          <Link href={mock.reviewHref} className={primaryBtn}>See your answers and the keys</Link>
        )}
        {mock.ended && !submitted && (
          <p className="text-exam-ink-muted text-sm">No answers were submitted for this mock.</p>
        )}
        {mock.phase !== 'locked' && (
          <Link href={`/mocks/${mock.slug}/results`} className={ghostBtn}>
            {mock.phase === 'official' ? 'Result and rank' : 'Your score'}
          </Link>
        )}
        {mock.solutionUrl && (
          <a href={mock.solutionUrl} target="_blank" rel="noreferrer" className={ghostBtn}>Solutions (PDF)</a>
        )}
      </div>

      {mock.ended && !mock.solutionUrl && (
        <p className="mt-4 text-xs text-exam-ink-faint">The solution sheet will appear here as soon as it is uploaded.</p>
      )}

      {essay && (
        <div className="mt-6 pt-4 border-t border-exam-border flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-exam-ink-muted">
            <span className="text-exam-ink">{mock.hasElectives ? 'Written' : 'Essays'}</span> · {essay.submitted} of {essay.essayCount} uploaded · due {dayTime(essay.deadline)}
          </p>
          {submitted && (
            <Link href={essayHref} className={ghostBtn}>
              {essay.submitted > 0 ? 'View essays' : 'Upload essays'}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

export default function MocksPage() {
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [now, setNow] = useState(() => Date.now());
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => fetch('/api/mocks')
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setState({ kind: 'error', message: body.error ?? 'Could not load mocks.' });
          return;
        }
        const body: { mocks: MockListEntry[] } = await res.json();
        if (!cancelled) setState({ kind: 'ready', mocks: body.mocks });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Network error. Check your connection.' }); });
    void load();
    // window states flip while the page is open: refresh the data every minute
    const t = setInterval(() => void load(), 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const mocks = state.kind === 'ready' ? state.mocks : [];
  // default selection: the mock live now, else the next upcoming one that has a paper, else the next slot
  const auto = (() => {
    const live = MOCK_SCHEDULE.find(s => mocks.find(m => m.examCode === mockExamCode(s.n))?.windows.some(w => w.state === 'open'));
    if (live) return live.n;
    const up = MOCK_SCHEDULE.find(s => slotRange(s).end.getTime() > now);
    return (up ?? MOCK_SCHEDULE[MOCK_SCHEDULE.length - 1]).n;
  })();
  const selected = picked ?? auto;
  const slot = MOCK_SCHEDULE.find(s => s.n === selected)!;
  // mocks outside the routine (a staff/tester sample window) are listed under it
  const extras = mocks.filter(m => !MOCK_SCHEDULE.some(s => mockExamCode(s.n) === m.examCode));

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div
          className="max-w-4xl mx-auto px-4 pb-10 sm:pb-14"
          style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}
        >
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">Mock Access</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mb-2">Mock Window</h1>
          <p className="text-exam-ink-muted text-base max-w-lg">
            Ten full-length IBA mocks, 2 to 28 November. Pick a mock to see its window and where you stand.
            Times are Bangladesh time.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        {state.kind === 'loading' && <p className="text-exam-ink-muted">Loading…</p>}
        {state.kind === 'error' && <p className="text-red-400">{state.message}</p>}
        {state.kind === 'ready' && (
          <>
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-exam-ink-faint mb-3">Mock routine</h2>
              <Routine slots={MOCK_SCHEDULE} mocks={mocks} now={now} selected={selected} onSelect={setPicked} />
            </section>
            <section aria-live="polite">
              <Detail slot={slot} mock={mocks.find(m => m.examCode === mockExamCode(slot.n))} now={now} />
            </section>
            {extras.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-exam-ink-faint">Other mocks</h2>
                {extras.map(m => <Detail key={m.slug} slot={null} mock={m} now={now} />)}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
