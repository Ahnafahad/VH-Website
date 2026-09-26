'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SentenceView from './SentenceView';
import RevealPanel, { CLASS_COPY } from './RevealPanel';
import type { Confidence, RedlineReveal, RedlineTakingQuestion, ResponseClass } from '@/lib/redline/types';
import type { LevelSummary } from '@/lib/redline/service';

interface StartPayload {
  attemptId: number;
  level: number;
  isFirst: boolean;
  questions: RedlineTakingQuestion[];
  answeredQuestionIds: number[];
  hasNextLevel: boolean;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; code?: string }
  | { kind: 'ready'; data: StartPayload };

type TransferState =
  | { kind: 'idle' }
  | { kind: 'picked'; key: string; correct: boolean | null; answer: string | null; explanation: string | null }
  | { kind: 'skipped' };

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string; code?: string }> {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, message: body.error ?? 'Something went wrong.', code: body.code };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, message: 'Network error. Check your connection and try again.' };
  }
}

export default function TakeLevelScreen({ level, replay }: { level: number; replay: boolean }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [summary, setSummary] = useState<LevelSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<StartPayload>(`/api/redline/levels/${level}/start`, { method: 'POST', body: JSON.stringify({ replay }) }).then(r => {
      if (cancelled) return;
      setLoad(r.ok ? { kind: 'ready', data: r.data } : { kind: 'error', message: r.message, code: r.code });
    });
    return () => { cancelled = true; };
  }, [level, replay]);

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-exam-base text-exam-ink" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
      {children}
    </main>
  );

  if (load.kind === 'loading') return shell(<p className="max-w-2xl mx-auto px-4 py-10 text-exam-ink-muted">Loading level {level}…</p>);
  if (load.kind === 'error') {
    const done = load.code === 'ALREADY_DONE';
    return shell(
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <p className={done ? 'text-exam-ink' : 'text-exam-danger'}>{load.message}</p>
        {done && (
          <Link href={`/redline/level/${level}?replay=1`} className="inline-block px-4 py-2 rounded-lg text-sm font-bold bg-exam-maroon-bright text-exam-ink">
            Replay this level
          </Link>
        )}
        <div><Link href="/redline" className="text-sm text-exam-gold hover:underline">Back to Redline</Link></div>
      </div>,
    );
  }
  if (summary) return shell(<LevelSummaryView summary={summary} />);
  return shell(<LevelRunner level={level} data={load.data} onFinished={setSummary} />);
}

// ─── The question loop ─────────────────────────────────────────────────────────────

function LevelRunner({ level, data, onFinished }: { level: number; data: StartPayload; onFinished: (s: LevelSummary) => void }) {
  const { questions, attemptId } = data;
  const answered = useRef(new Set(data.answeredQuestionIds));
  const firstOpen = questions.findIndex(q => !answered.current.has(q.id));

  const [index, setIndex] = useState(firstOpen === -1 ? questions.length : firstOpen);
  const [picked, setPicked] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [reveal, setReveal] = useState<RedlineReveal | null>(null);
  const [transfer, setTransfer] = useState<TransferState>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const levelStart = useRef(performance.now());
  const qStart = useRef(performance.now());
  const firstClick = useRef<number | null>(null);
  const changes = useRef<{ key: string; t: number }[]>([]);
  const hint1 = useRef<number | null>(null);
  const hint2 = useRef<number | null>(null);
  const revealAt = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(performance.now() - levelStart.current), 500);
    return () => clearInterval(id);
  }, []);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  const finish = useCallback(async () => {
    setBusy(true); setError(null);
    const r = await api<LevelSummary>(`/api/redline/attempts/${attemptId}/finish`, { method: 'POST' });
    setBusy(false);
    if (r.ok) onFinished(r.data); else setError(r.message);
  }, [attemptId, onFinished]);

  // Resumed an attempt where every question was already answered.
  useEffect(() => { if (index >= questions.length) void finish(); }, [index, questions.length, finish]);

  function pick(key: string) {
    if (reveal || busy) return;
    const t = Math.round(performance.now() - qStart.current);
    if (firstClick.current === null) firstClick.current = t;
    changes.current.push({ key, t });
    setPicked(key);
  }

  function openHint(n: 1 | 2) {
    const t = Math.round(performance.now() - qStart.current);
    if (n === 1 && hint1.current === null) hint1.current = t;
    if (n === 2 && hint2.current === null) hint2.current = t;
    setHints(h => Math.max(h, n));
  }

  async function lock(confidence: Confidence | null) {
    if (!question || busy) return;
    setBusy(true); setError(null);
    const r = await api<RedlineReveal>(`/api/redline/attempts/${attemptId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        questionId: question.id,
        selectedKey: confidence === null ? null : picked,
        confidence,
        firstClickMs: firstClick.current ?? 0,
        totalTimeMs: Math.round(performance.now() - qStart.current),
        changes: changes.current,
        hint1Ms: hint1.current,
        hint2Ms: hint2.current,
      }),
    });
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    answered.current.add(question.id);
    revealAt.current = performance.now();
    setReveal(r.data);
  }

  async function answerTransfer(key: string) {
    if (!question || !reveal || transfer.kind !== 'idle') return;
    const r = await api<{ transferCorrect: boolean | null; transferAnswer: string | null; transferExplanation: string | null; klass: ResponseClass }>(
      `/api/redline/attempts/${attemptId}/responses/${question.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ transferKey: key, transferMs: Math.round(performance.now() - revealAt.current), dwellMs: Math.round(performance.now() - revealAt.current) }),
      },
    );
    if (!r.ok) { setError(r.message); return; }
    setTransfer({ kind: 'picked', key, correct: r.data.transferCorrect, answer: r.data.transferAnswer, explanation: r.data.transferExplanation });
    setReveal(prev => (prev ? { ...prev, klass: r.data.klass } : prev));
  }

  async function next() {
    if (!question || !reveal) return;
    // Best-effort: record how long they stayed on the explanation.
    void fetch(`/api/redline/attempts/${attemptId}/responses/${question.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ dwellMs: Math.round(performance.now() - revealAt.current) }),
    }).catch(() => {});
    if (isLast) { await finish(); return; }
    setIndex(i => i + 1);
    setPicked(null); setHints(0); setReveal(null); setTransfer({ kind: 'idle' }); setError(null);
    changes.current = []; firstClick.current = null; hint1.current = null; hint2.current = null;
    qStart.current = performance.now();
  }

  if (!question) {
    return <div className="max-w-2xl mx-auto px-4 py-10 text-exam-ink-muted">{error ?? 'Wrapping up your level…'}</div>;
  }

  const optionKeys = Object.keys(question.options);
  const total = questions.length;

  return (
    <>
      <div className="border-b border-exam-border bg-exam-surface sticky top-24 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-exam-gold text-xs font-bold uppercase tracking-widest">Redline · Level {level}{data.isFirst ? '' : ' · replay'}</p>
              <p className="text-exam-ink-faint text-xs mt-0.5">Question {index + 1} of {total}</p>
            </div>
            <div className="font-mono text-lg font-bold tabular-nums">{fmt(elapsed)}</div>
          </div>
          <div className="mt-2 flex gap-[3px]" aria-hidden>
            {questions.map((q, i) => (
              <span key={q.id} className={`h-1 flex-1 rounded-full ${i < index ? 'bg-exam-success' : i === index ? 'bg-exam-maroon-bright' : 'bg-exam-q-blank'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <p className="text-xs text-exam-ink-faint mb-3">Choose the best version of the underlined part. Option A repeats it unchanged.</p>
          <SentenceView sentence={question.sentence} span={question.span} />
        </div>

        <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
          {optionKeys.map(k => {
            const isKey = reveal?.correctKey === k;
            const isPick = picked === k;
            let cls = 'bg-exam-elevated border-exam-border text-exam-ink-muted hover:border-exam-gold/40 hover:text-exam-ink cursor-pointer';
            if (reveal) {
              cls = isKey ? 'bg-exam-success/15 border-exam-success text-exam-ink'
                : isPick ? 'bg-exam-danger/15 border-exam-danger text-exam-ink'
                : 'bg-exam-elevated border-exam-border text-exam-ink-faint opacity-60';
            } else if (isPick) cls = 'bg-exam-maroon/15 border-exam-maroon-bright text-exam-ink';
            return (
              <button
                key={k}
                role="radio"
                aria-checked={isPick}
                disabled={!!reveal || busy}
                onClick={() => pick(k)}
                className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-exam-gold/50 ${cls}`}
              >
                <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${reveal && isKey ? 'bg-exam-success text-white' : reveal && isPick ? 'bg-exam-danger text-white' : isPick ? 'bg-exam-maroon-bright text-exam-ink' : 'bg-exam-surface border border-exam-gold/20 text-exam-ink-faint'}`}>{k}</span>
                <span className="flex-1 text-sm leading-relaxed pt-1">{question.options[k]}</span>
                {reveal && isPick && !isKey && <span className="text-xs text-exam-danger pt-1.5">Your pick</span>}
              </button>
            );
          })}
        </div>

        {!reveal && (
          <div className="space-y-4">
            {picked && (
              <div className="rounded-xl border border-exam-border bg-exam-surface p-4">
                <p className="text-sm text-exam-ink mb-3">How sure are you? Tap to lock in option {picked}.</p>
                <div className="grid grid-cols-3 gap-2">
                  {([['sure', 'Sure'], ['unsure', 'Unsure'], ['guess', 'Guess']] as const).map(([c, label]) => (
                    <button
                      key={c}
                      disabled={busy}
                      onClick={() => lock(c)}
                      className="min-h-[44px] rounded-lg border border-exam-border bg-exam-elevated text-sm font-semibold text-exam-ink hover:border-exam-gold/60 hover:bg-exam-maroon/20 disabled:opacity-50 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => openHint(1)}
                disabled={hints >= 1}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-exam-border text-exam-ink-muted hover:text-exam-ink disabled:opacity-40"
              >Hint 1</button>
              <button
                onClick={() => openHint(2)}
                disabled={hints < 1 || hints >= 2}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-exam-border text-exam-ink-muted hover:text-exam-ink disabled:opacity-40"
              >Hint 2</button>
              <span className="text-xs text-exam-ink-faint">Hints count against a clean answer.</span>
              <button
                onClick={() => lock(null)}
                disabled={busy}
                className="ml-auto px-3 py-2 rounded-lg text-xs font-semibold text-exam-ink-muted hover:text-exam-ink"
              >I don&apos;t know</button>
            </div>
            {hints >= 1 && <p className="rounded-xl border border-exam-border bg-exam-elevated p-3 text-sm text-exam-ink-muted">{question.hint1}</p>}
            {hints >= 2 && <p className="rounded-xl border border-exam-border bg-exam-elevated p-3 text-sm text-exam-ink-muted">{question.hint2}</p>}
          </div>
        )}

        {error && <p className="text-exam-danger text-sm">{error}</p>}

        {reveal && (
          <>
            <RevealPanel reveal={reveal} options={question.options} />

            {reveal.transfer && (
              <div className="rounded-xl border border-exam-gold/40 bg-exam-surface p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-exam-gold">Try a fresh one</p>
                <p className="text-sm text-exam-ink-muted">Same rule, new sentence. This shows whether the rule stuck or the question just slipped past you.</p>
                <p className="font-serif text-base leading-relaxed text-exam-ink">{reveal.transfer.prompt}</p>
                {transfer.kind === 'idle' && (
                  <div className="space-y-2">
                    {Object.entries(reveal.transfer.options).map(([k, text]) => (
                      <button
                        key={k}
                        onClick={() => void answerTransfer(k)}
                        className="w-full text-left flex gap-3 p-3 rounded-lg border border-exam-border bg-exam-elevated text-sm text-exam-ink-muted hover:text-exam-ink hover:border-exam-gold/40"
                      >
                        <span className="font-bold text-exam-ink-faint">{k}</span><span>{text}</span>
                      </button>
                    ))}
                    <button onClick={() => setTransfer({ kind: 'skipped' })} className="text-xs text-exam-ink-faint hover:text-exam-ink-muted">Skip this one</button>
                  </div>
                )}
                {transfer.kind === 'picked' && (
                  <div className="text-sm space-y-1">
                    <p className={transfer.correct ? 'text-exam-success font-semibold' : 'text-exam-danger font-semibold'}>
                      {transfer.correct ? 'Correct. The rule stuck.' : `Not this time. The answer was ${transfer.answer}.`}
                    </p>
                    {transfer.explanation && <p className="text-exam-ink-muted leading-relaxed">{transfer.explanation}</p>}
                  </div>
                )}
                {transfer.kind === 'skipped' && <p className="text-xs text-exam-ink-faint">Skipped.</p>}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={next}
                disabled={busy}
                className="px-5 py-2.5 rounded-lg text-sm font-bold bg-exam-maroon-bright text-exam-ink hover:brightness-110 transition-[filter] disabled:opacity-50"
              >
                {busy ? 'Saving…' : isLast ? 'Finish level' : 'Next question'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Level summary ──────────────────────────────────────────────────────────────────

function LevelSummaryView({ summary }: { summary: LevelSummary }) {
  const pct = Math.round((summary.correct / summary.total) * 100);
  const order: ResponseClass[] = ['mastered', 'fragile', 'lucky', 'slip', 'gap', 'misconception'];
  const dot = (k: ResponseClass, ok: boolean) =>
    ok ? (k === 'mastered' ? 'bg-exam-success' : 'bg-exam-warning') : k === 'misconception' ? 'bg-exam-danger' : 'bg-exam-maroon-bright';
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div>
        <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-2">Level {summary.level} complete</p>
        <h1 className="font-serif text-4xl font-semibold">{summary.correct}<span className="text-exam-ink-faint text-2xl"> / {summary.total}</span> <span className="text-exam-ink-muted text-2xl">({pct}%)</span></h1>
        <p className="text-exam-ink-muted text-sm mt-2">
          {fmt(summary.totalTimeMs)} total.{' '}
          {summary.isFirst ? 'This first attempt is what your dashboard is built from.' : 'Replays are practice; your dashboard uses your first attempt.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Question results">
        {summary.items.map(it => (
          <span key={it.position} title={`Q${it.position}: ${it.skillLabel}`} className={`w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center text-exam-base ${dot(it.klass, it.isCorrect)}`}>{it.position}</span>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {order.filter(k => summary.classes[k] > 0).map(k => (
          <div key={k} className="rounded-xl border border-exam-border bg-exam-surface p-3">
            <p className="text-2xl font-serif">{summary.classes[k]}</p>
            <p className="text-xs font-semibold text-exam-ink">{CLASS_COPY[k].title}</p>
          </div>
        ))}
      </div>

      {summary.topMisses.length > 0 && (
        <div className="rounded-xl border border-exam-border bg-exam-surface p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-exam-gold mb-2">Where you lost marks</p>
          <ul className="text-sm text-exam-ink-muted space-y-1">
            {summary.topMisses.map(m => <li key={m.label}>{m.label}: {m.count} missed</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {summary.hasNextLevel && (
          <Link href={`/redline/level/${summary.level + 1}`} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-exam-maroon-bright text-exam-ink hover:brightness-110">
            Next level
          </Link>
        )}
        <Link href="/redline" className="px-5 py-2.5 rounded-lg text-sm font-bold border border-exam-border text-exam-ink hover:border-exam-gold/50">
          See my dashboard
        </Link>
      </div>
    </div>
  );
}
