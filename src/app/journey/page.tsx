'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QuestionView from '@/components/tests/QuestionView';
import type { JourneyPayload } from '@/lib/journey/types';

const SECTION = { english: 'English', math: 'Mathematics', analytical: 'Analytical' } as const;
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const btn = 'px-5 py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors disabled:opacity-50';
const ghost = 'px-4 py-2 rounded-xl border border-exam-border bg-exam-elevated text-exam-ink-muted hover:text-exam-ink text-sm transition-colors';

interface State { enabled: boolean; payload: JourneyPayload | null }

export default function JourneyPage() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  const load = useCallback(async (method: 'GET' | 'POST' = 'GET') => {
    try {
      const res = await fetch('/api/journey', { method });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? 'Could not load this page.'); return; }
      setError(null);
      setState(body);
    } catch { setError('Network error — check your connection.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const build = async () => { setBuilding(true); await load('POST'); setBuilding(false); };

  const p = state?.payload ?? null;
  return (
    <main className="min-h-screen bg-exam-base text-exam-ink" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-2">Sprint</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold mb-2">Exorcise the Past</h1>
        {error && <p className="text-red-400 mt-4">{error}</p>}
        {!state && !error && <p className="text-exam-ink-muted mt-4">Loading…</p>}

        {state && !p && (
          <div className="mt-4 space-y-5">
            <p className="text-exam-ink-muted max-w-xl">
              One hour. The ghosts of your last five mocks: the questions you missed that you were most likely to get, built just for you.
              You can pause the timer whenever you like.
            </p>
            {state.enabled
              ? <button onClick={build} disabled={building} className={btn}>{building ? 'Building your set…' : 'Build my set'}</button>
              : <p className="text-exam-ink-faint text-sm">Not open yet. Your instructor will unlock it.</p>}
          </div>
        )}

        {p && p.status === 'done' && <Done p={p} />}
        {p && p.status !== 'done' && <Session key={p.questions.length} payload={p} onDone={() => load()} />}
      </div>
    </main>
  );
}

function Session({ payload, onDone }: { payload: JourneyPayload; onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>(payload.answers);
  const [elapsed, setElapsed] = useState(payload.elapsedMs);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const live = useRef({ answers, elapsed });
  live.current = { answers, elapsed };

  const save = useCallback((status: 'running' | 'paused' | 'done') =>
    fetch('/api/journey', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: live.current.answers, elapsedMs: Math.round(live.current.elapsed), status }),
    }).catch(() => undefined), []);

  const finish = useCallback(async () => { setRunning(false); await save('done'); onDone(); }, [save, onDone]);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const tick = setInterval(() => {
      const now = performance.now();
      setElapsed(e => Math.min(payload.limitMs, e + (now - last)));
      last = now;
    }, 250);
    const beat = setInterval(() => save('running'), 20_000);
    return () => { clearInterval(tick); clearInterval(beat); };
  }, [running, save, payload.limitMs]);

  useEffect(() => { if (running) save('running'); }, [answers]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (elapsed >= payload.limitMs && running) finish(); }, [elapsed, running, finish, payload.limitMs]);

  const q = payload.questions[index];
  const group = payload.groups.find(g => g.id === q.groupId) ?? null;
  const answered = Object.keys(answers).length;
  const go = (n: number) => setIndex(Math.min(payload.questions.length - 1, Math.max(0, n)));
  const setRun = (on: boolean) => { setRunning(on); save(on ? 'running' : 'paused'); };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-exam-border bg-exam-surface px-4 py-3 sticky top-24 z-10">
        <div>
          <p className="font-mono text-2xl font-bold tabular-nums">{mmss(payload.limitMs - elapsed)}</p>
          <p className="text-exam-ink-faint text-xs">{answered}/{payload.questions.length} answered · {SECTION[q.section]}</p>
        </div>
        <div className="flex gap-2">
          {running && <button className={ghost} onClick={() => setRun(false)}>Pause</button>}
          {running && <button className={ghost} onClick={() => confirm('Submit now? You cannot change answers afterwards.') && finish()}>Finish</button>}
        </div>
      </div>

      {!running ? (
        <div className="rounded-2xl border border-exam-border bg-exam-surface p-6 space-y-4">
          <p className="text-exam-ink-muted text-sm">
            {payload.status === 'ready'
              ? `${payload.questions.length} questions · 60 minutes. The timer only runs while you are in the set.`
              : 'Paused. Your answers and remaining time are saved.'}
          </p>
          <button className={btn} onClick={() => setRun(true)}>{payload.status === 'ready' && elapsed === 0 ? 'Start' : 'Resume'}</button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-exam-border bg-exam-surface flex flex-col h-[70vh] min-h-[28rem] overflow-hidden">
            <QuestionView
              key={q.id}
              question={q} group={group}
              selectedKey={answers[q.id] ?? null}
              flagged={flagged.has(q.id)}
              onFlag={() => setFlagged(f => { const n = new Set(f); if (!n.delete(q.id)) n.add(q.id); return n; })}
              onSelect={key => setAnswers(a => { const n = { ...a }; if (key) n[q.id] = key; else delete n[q.id]; return n; })}
              onPrev={index > 0 ? () => go(index - 1) : null}
              onNext={index < payload.questions.length - 1 ? () => go(index + 1) : null}
              questionNumber={index + 1} totalQuestions={payload.questions.length}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {payload.questions.map((x, i) => (
              <button
                key={x.id} onClick={() => go(i)}
                className={`w-9 h-9 rounded-lg text-xs font-semibold border transition-colors ${i === index ? 'border-exam-gold text-exam-ink' : answers[x.id] ? 'border-exam-maroon-bright bg-exam-maroon/20 text-exam-ink' : 'border-exam-border text-exam-ink-faint'}`}
              >{i + 1}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Done({ p }: { p: JourneyPayload }) {
  const r = p.result!;
  return (
    <div className="mt-4 space-y-6">
      <div className="rounded-2xl border border-exam-border bg-exam-surface p-6">
        <p className="font-serif text-4xl font-semibold tabular-nums">{r.correct}<span className="text-exam-ink-faint text-2xl">/{r.total}</span></p>
        <p className="text-exam-ink-muted text-sm mt-1">{r.wrong} wrong · {r.skipped} skipped · {r.marks} marks (+1 / −0.25)</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(SECTION) as (keyof typeof SECTION)[]).map(s => (
            <span key={s} className="text-xs rounded-full border border-exam-border px-3 py-1 text-exam-ink-muted">
              {SECTION[s]} {r.bySection[s].correct}/{r.bySection[s].total}
            </span>
          ))}
        </div>
      </div>
      <ul className="rounded-2xl border border-exam-border divide-y divide-exam-border overflow-hidden">
        {p.review!.map(row => {
          const ok = row.selected === row.correct;
          return (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm bg-exam-surface">
              <span className="text-exam-ink-muted">{row.source}</span>
              <span className={ok ? 'text-exam-success' : 'text-exam-ink'}>
                {row.selected ?? '—'}{ok ? ' ✓' : ` · answer ${row.correct}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
