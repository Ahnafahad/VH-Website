'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  ReadingSpeedPassageForTaking, ReadingSpeedSubmitAnswer,
  ReadingSpeedAttemptResult, ReadingSpeedLeaderboardRow,
} from '@/lib/reading-speed-test/types';

const BENCHMARK_WPM = 238;
const BENCHMARK_RANGE: [number, number] = [175, 300];

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; canRetry: boolean }
  | { kind: 'reading'; passage: ReadingSpeedPassageForTaking; token: string }
  | { kind: 'quiz'; passage: ReadingSpeedPassageForTaking; token: string; qIndex: number }
  | { kind: 'submitting' }
  | { kind: 'results'; result: ReadingSpeedAttemptResult };

export default function ReadingSpeedTestScreen() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const answersRef = useRef<Map<string, ReadingSpeedSubmitAnswer>>(new Map());
  const interruptionsRef = useRef(0);

  // Count tab-away/backgrounding while the test is actually in progress.
  useEffect(() => {
    if (phase.kind !== 'reading' && phase.kind !== 'quiz') return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') interruptionsRef.current += 1;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase.kind]);

  async function startTest() {
    setPhase({ kind: 'loading' });
    answersRef.current = new Map();
    interruptionsRef.current = 0;
    try {
      const res = await fetch('/api/reading-speed-test/start');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const authFailed = res.status === 401;
        setPhase({
          kind: 'error',
          message: authFailed ? 'Please sign in to take this test.' : (body.error ?? 'Could not load a passage.'),
          canRetry: !authFailed,
        });
        return;
      }
      const body: { passage: ReadingSpeedPassageForTaking; token: string } = await res.json();
      setPhase({ kind: 'reading', passage: body.passage, token: body.token });
    } catch {
      setPhase({ kind: 'error', message: 'Network error — check your connection.', canRetry: true });
    }
  }

  function finishReading() {
    if (phase.kind !== 'reading') return;
    setPhase({ kind: 'quiz', passage: phase.passage, token: phase.token, qIndex: 0 });
  }

  function answerQuestion(questionId: string, selectedIndex: number | null) {
    if (phase.kind !== 'quiz') return;
    answersRef.current.set(questionId, { questionId, selectedIndex });
    const nextIndex = phase.qIndex + 1;
    if (nextIndex < phase.passage.questions.length) {
      setTimeout(() => setPhase({ ...phase, qIndex: nextIndex }), 150);
    } else {
      setTimeout(() => submit(phase.passage.id, phase.token), 150);
    }
  }

  async function submit(passageId: string, token: string) {
    setPhase({ kind: 'submitting' });
    try {
      const res = await fetch('/api/reading-speed-test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passageId, token,
          answers: Array.from(answersRef.current.values()),
          visibilityInterruptions: interruptionsRef.current,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPhase({ kind: 'error', message: body.error ?? 'Could not submit your result.', canRetry: true });
        return;
      }
      const result: ReadingSpeedAttemptResult = await res.json();
      setPhase({ kind: 'results', result });
    } catch {
      setPhase({ kind: 'error', message: 'Network error — check your connection.', canRetry: true });
    }
  }

  if (phase.kind === 'idle') return <IdleScreen onStart={startTest} />;
  if (phase.kind === 'loading' || phase.kind === 'submitting') {
    return <Centered><p className="text-exam-ink-muted">{phase.kind === 'loading' ? 'Loading…' : 'Scoring your result…'}</p></Centered>;
  }
  if (phase.kind === 'error') {
    return (
      <Centered>
        <p className="text-red-400 mb-4">{phase.message}</p>
        {phase.canRetry
          ? <button onClick={startTest} className="px-5 py-3 rounded-lg text-sm font-bold bg-exam-maroon-bright text-exam-ink">Try again</button>
          : <Link href="/auth/signin" className="text-exam-gold text-sm underline">Sign in</Link>}
      </Centered>
    );
  }
  if (phase.kind === 'reading') return <ReadingScreen passage={phase.passage} onFinished={finishReading} />;
  if (phase.kind === 'quiz') {
    return (
      <QuizScreen
        passage={phase.passage}
        qIndex={phase.qIndex}
        onAnswer={answerQuestion}
      />
    );
  }
  return <ResultsScreen result={phase.result} onRetake={startTest} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-exam-base text-exam-ink flex items-center justify-center px-4">
      <div className="text-center max-w-sm">{children}</div>
    </div>
  );
}

function IdleScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="min-h-screen bg-exam-base text-exam-ink" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
      <div className="max-w-md mx-auto px-4 py-8 text-center">
        <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">Reading Speed Test</p>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold mb-4">How fast can you actually read?</h1>
        <p className="text-exam-ink-muted text-sm leading-relaxed mb-8">
          Read a short passage naturally — at the speed you'd use if you wanted to understand it — then answer 5 quick
          questions. Takes about 1–2 minutes. Your speed only counts if you actually understood what you read.
        </p>
        <button
          onClick={onStart}
          className="w-full py-4 rounded-xl text-base font-bold bg-exam-maroon-bright text-exam-ink active:scale-[0.98] transition-transform"
        >
          Start test
        </button>
      </div>
    </main>
  );
}

function ReadingScreen({ passage, onFinished }: { passage: ReadingSpeedPassageForTaking; onFinished: () => void }) {
  const paragraphs = passage.body.split(/\n\n+/);
  return (
    <main className="min-h-screen bg-exam-base text-exam-ink pb-28" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
      <div className="max-w-[38rem] mx-auto px-4">
        <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-4 text-center">{passage.title}</p>
        <div className="space-y-4 text-[1.0625rem] leading-[1.65] text-exam-ink">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </div>

      {/* Thumb-reachable, always-visible finish button. */}
      <div
        className="fixed bottom-0 inset-x-0 border-t border-exam-border bg-exam-surface"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-[38rem] mx-auto px-4 pt-3">
          <button
            onClick={onFinished}
            className="w-full py-4 rounded-xl text-base font-bold bg-exam-maroon-bright text-exam-ink active:scale-[0.98] transition-transform"
          >
            I've finished reading
          </button>
        </div>
      </div>
    </main>
  );
}

function QuizScreen({
  passage, qIndex, onAnswer,
}: {
  passage: ReadingSpeedPassageForTaking;
  qIndex: number;
  onAnswer: (questionId: string, selectedIndex: number | null) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const question = passage.questions[qIndex];

  useEffect(() => { setSelected(null); }, [qIndex]);

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
      <div className="border-b border-exam-border bg-exam-surface sticky z-10" style={{ top: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md mx-auto px-4 py-4">
          <p className="text-exam-ink-faint text-xs font-semibold">Question {qIndex + 1} of {passage.questions.length}</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <p className="text-lg font-medium leading-snug">{question.question}</p>
        <div className="space-y-3">
          {question.options.map((opt, i) => (
            <button
              key={i}
              disabled={selected !== null}
              onClick={() => { setSelected(i); onAnswer(question.id, i); }}
              className={[
                'w-full text-left px-4 py-4 rounded-xl border text-sm leading-relaxed transition-colors duration-150 active:scale-[0.98]',
                selected === i
                  ? 'bg-exam-maroon/20 border-exam-maroon-bright text-exam-ink'
                  : 'bg-exam-elevated border-exam-border text-exam-ink-muted',
              ].join(' ')}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

function benchmarkPct(wpm: number): number {
  const [lo, hi] = [80, 380];
  return Math.min(100, Math.max(0, ((wpm - lo) / (hi - lo)) * 100));
}

function getQuadrant(rawWpm: number, verified: boolean): { label: string; message: string } {
  const fast = rawWpm >= BENCHMARK_WPM;
  if (fast && verified) return { label: 'Fast + accurate', message: 'You read faster than the research average while maintaining strong comprehension.' };
  if (fast && !verified) return { label: 'Likely skimming', message: 'You moved through the text quickly, but comprehension dropped — this looks more like scanning than reading.' };
  if (!fast && verified) return { label: 'Deliberate + accurate', message: 'Your pace is below the research average, but your understanding was excellent. Room to build speed without losing comprehension.' };
  return { label: 'Comprehension dip', message: 'Both pace and comprehension came in below target on this passage — could be an off passage, try again.' };
}

function ResultsScreen({ result, onRetake }: { result: ReadingSpeedAttemptResult; onRetake: () => void }) {
  const [leaderboard, setLeaderboard] = useState<ReadingSpeedLeaderboardRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reading-speed-test/leaderboard')
      .then(res => res.ok ? res.json() : null)
      .then(body => { if (!cancelled && body) setLeaderboard(body.leaderboard); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const quadrant = getQuadrant(result.rawWpm, result.verified);
  const confidenceColor = result.confidence === 'high' ? 'text-emerald-400' : result.confidence === 'good' ? 'text-exam-gold' : 'text-red-400';

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
      <div className="max-w-md mx-auto px-4 pb-16 space-y-6">
        {/* Headline */}
        <div className="text-center pt-2">
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-2">Your Result</p>
          <p className="font-serif text-5xl font-bold">{result.rawWpm}</p>
          <p className="text-exam-ink-muted text-sm mb-2">words per minute</p>
          {result.verified
            ? <span className="inline-block text-xs font-bold text-emerald-400">✓ Comprehension verified</span>
            : <span className="inline-block text-xs font-bold text-red-400">Comprehension not verified</span>}
        </div>

        {/* Comprehension + confidence */}
        <div className="rounded-xl border border-exam-border bg-exam-elevated p-4 flex items-center justify-between text-sm">
          <div>
            <p className="text-exam-ink-faint text-xs">Comprehension</p>
            <p className="font-bold">{result.correctCount}/{result.totalQuestions} · {result.comprehensionPct}%</p>
          </div>
          <div className="text-right">
            <p className="text-exam-ink-faint text-xs">Test confidence</p>
            <p className={`font-bold uppercase ${confidenceColor}`}>{result.confidence}</p>
          </div>
        </div>

        {/* Benchmark bar */}
        <div className="rounded-xl border border-exam-border bg-exam-elevated p-4">
          <p className="text-exam-ink-faint text-xs mb-3">Adult nonfiction reference</p>
          <div className="relative h-2 rounded-full bg-exam-surface mb-2">
            <div
              className="absolute inset-y-0 rounded-full bg-exam-gold/30"
              style={{ left: `${benchmarkPct(BENCHMARK_RANGE[0])}%`, right: `${100 - benchmarkPct(BENCHMARK_RANGE[1])}%` }}
            />
            <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-exam-ink-faint" style={{ left: `${benchmarkPct(BENCHMARK_WPM)}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-exam-maroon-bright border-2 border-exam-ink"
              style={{ left: `${benchmarkPct(result.rawWpm)}%` }}
            />
          </div>
          <div className="flex justify-between text-[0.65rem] text-exam-ink-faint">
            <span>{BENCHMARK_RANGE[0]}</span>
            <span>avg {BENCHMARK_WPM}</span>
            <span>{BENCHMARK_RANGE[1]}</span>
          </div>
        </div>

        {/* Quadrant read */}
        <div className="rounded-xl border border-exam-border bg-exam-elevated p-4">
          <p className="text-exam-ink-faint text-xs mb-1">Speed × comprehension read</p>
          <p className="font-bold mb-1">{quadrant.label}</p>
          <p className="text-exam-ink-muted text-sm leading-relaxed">{quadrant.message}</p>
        </div>

        {/* Question breakdown */}
        <div className="rounded-xl border border-exam-border bg-exam-elevated overflow-hidden">
          <div className="px-4 py-3 border-b border-exam-border">
            <p className="text-xs font-bold uppercase tracking-wide text-exam-ink-faint">Question breakdown</p>
          </div>
          <div className="divide-y divide-exam-border">
            {result.questionResults.map((q, i) => (
              <div key={q.questionId} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-exam-ink-muted">Q{i + 1} · {QUESTION_TYPE_LABEL[q.type]}</span>
                <span className={q.isCorrect ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {q.isCorrect ? '✓' : '✕'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="rounded-xl border border-exam-border bg-exam-elevated overflow-hidden">
          <div className="px-4 py-3 border-b border-exam-border">
            <p className="text-xs font-bold uppercase tracking-wide text-exam-ink-faint">Leaderboard · Top 5</p>
          </div>
          {leaderboard === null ? (
            <p className="text-exam-ink-muted text-sm p-4">Loading…</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-exam-ink-muted text-sm p-4">No verified results yet.</p>
          ) : (
            <div className="divide-y divide-exam-border">
              {leaderboard.map(row => (
                <div key={row.userId}>
                  {row.rank > 5 && <p className="px-4 pt-2 text-[0.65rem] uppercase tracking-wide text-exam-ink-faint">Your rank</p>}
                  <div className={`px-4 py-3 flex items-center justify-between text-sm ${row.isMe ? 'bg-exam-maroon/10' : ''}`}>
                    <span className="flex items-center gap-3">
                      <span className="w-5 text-exam-ink-faint font-bold">#{row.rank}</span>
                      <span>{row.name}{row.isMe ? ' (you)' : ''}</span>
                    </span>
                    <span className="font-mono tabular-nums text-exam-ink-muted">{row.bestWpm} wpm</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onRetake}
          className="w-full py-4 rounded-xl text-base font-bold bg-exam-maroon-bright text-exam-ink active:scale-[0.98] transition-transform"
        >
          Test again — different passage
        </button>
      </div>
    </main>
  );
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  main_idea: 'Main idea',
  explicit: 'Explicit detail',
  inference: 'Inference',
};
