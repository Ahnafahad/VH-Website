'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import LivingFlashcard, { type LivingCardWord } from '@/components/vocab/LivingFlashcard';
import LSays from '@/components/vocab/onboarding/L';
import { Fade, PrimaryButton } from '@/components/vocab/onboarding/ui';
import { DEFAULT_CARD_PREFS, type CardPrefs } from '@/lib/vocab/card-prefs';
import { readDraft, clearDraft } from '@/lib/vocab/onboarding/state';
import { RETENTION_EVENTS, trackRetention } from '@/lib/vocab/retention-events';

export interface TrackOption {
  id:          number;
  name:        string;
  description: string | null;
  trialWords:  number;
  totalWords:  number;
}

/**
 * Post-signin half of onboarding. The pre-signin half (/lexicore) left a draft
 * in sessionStorage: the card style the user built and the words they actually
 * got wrong. This half closes the loop — teach those words on that card, test
 * them in context, then set up what they are studying and how fast.
 */
type Stage = 'study' | 'quiz' | 'result' | 'tracks' | 'pace';

export default function OnboardingFlow({ userName, tracks }: { userName: string; tracks: TrackOption[] }) {
  const reduce = useReducedMotion() ?? false;
  const router = useRouter();

  const [prefs, setPrefs]   = useState<CardPrefs>(DEFAULT_CARD_PREFS);
  const [words, setWords]   = useState<LivingCardWord[] | null>(null);
  const [stage, setStage]   = useState<Stage>('study');
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number } | null>(null);
  const [trackIds, setTrackIds]   = useState<number[]>([]);
  const [error, setError]   = useState('');

  // The repair quiz is generated while the user is still studying the cards,
  // so the transition into it never lands on a loading state.
  const quizRef = useRef<Promise<QuizSession | null> | null>(null);

  useEffect(() => {
    trackRetention(RETENTION_EVENTS.onboardingStarted);
    const draft = readDraft();
    if (draft) setPrefs(draft.prefs);

    const ids = draft?.weakWordIds.slice(0, 5) ?? [];
    if (ids.length === 0) { setWords([]); setStage('result'); return; }

    fetch(`/api/vocab/onboarding/repair-words?ids=${ids.join(',')}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { words?: LivingCardWord[] } | null) => {
        const got = d?.words ?? [];
        setWords(got);
        if (got.length === 0) setStage('result');
        else quizRef.current = generateQuiz(got.map(w => w.id));
      })
      .catch(() => { setWords([]); setStage('result'); });
  }, []);

  const submit = useCallback(async (deadline: Date | null, wordsPerDay: number) => {
    setError('');
    try {
      const res = await fetch('/api/vocab/onboarding/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefs,
          syllabusIds: trackIds,
          deadline: deadline ? deadline.toISOString() : null,
          wordsPerDay,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Your setup could not be saved.');
      }
      clearDraft();
      router.replace('/vocab/home?activated=1');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your setup could not be saved. Try again.');
      return false;
    }
  }, [prefs, trackIds, router]);

  const onQuizDone = useCallback((score: { correct: number; total: number }) => {
    setQuizScore(score);
    setStage('result');
  }, []);

  return (
    <main
      className="flex min-h-[100dvh] w-full justify-center"
      style={{
        background: 'var(--color-lx-base)',
        paddingTop:    'calc(env(safe-area-inset-top) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)',
      }}
    >
      <div className="flex w-full max-w-lg flex-col px-5 md:max-w-xl lg:max-w-2xl">
        <AnimatePresence mode="wait">
          {stage === 'study' && words && words.length > 0 && (
            <Fade key="study" reduce={reduce}>
              <RepairStudy words={words} prefs={prefs} reduce={reduce} onDone={() => setStage('quiz')} />
            </Fade>
          )}

          {stage === 'quiz' && (
            <Fade key="quiz" reduce={reduce}>
              <RepairQuiz sessionPromise={quizRef.current} onDone={onQuizDone} />
            </Fade>
          )}

          {stage === 'result' && (
            <Fade key="result" reduce={reduce}>
              <ActivationResult
                userName={userName}
                score={quizScore}
                repaired={words?.length ?? 0}
                reduce={reduce}
                onNext={() => setStage('tracks')}
              />
            </Fade>
          )}

          {stage === 'tracks' && (
            <Fade key="tracks" reduce={reduce}>
              <TrackPicker
                tracks={tracks}
                selected={trackIds}
                onToggle={id => setTrackIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])}
                onNext={() => setStage('pace')}
              />
            </Fade>
          )}

          {stage === 'pace' && (
            <Fade key="pace" reduce={reduce}>
              <PacePicker tracks={tracks} trackIds={trackIds} onSubmit={submit} />
            </Fade>
          )}
        </AnimatePresence>

        {error && (
          <p role="alert" className="pb-2 text-sm" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-accent-red)' }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

/* ─── 1. repair study — the words that broke, on the user's own card ── */

function RepairStudy({ words, prefs, reduce, onDone }: {
  words: LivingCardWord[]; prefs: CardPrefs; reduce: boolean; onDone: () => void;
}) {
  const [index, setIndex]     = useState(0);
  const [flipped, setFlipped] = useState(false);
  const last = index === words.length - 1;

  return (
    <div className="flex flex-1 flex-col gap-6 py-4">
      <LSays>
        {index === 0
          ? `${words.length === 1 ? 'This is the word' : `These are the ${words.length} words`} that slipped. Same card you built.`
          : `${index + 1} of ${words.length}.`}
      </LSays>

      <div className="relative w-full" style={{ minHeight: 'min(58vh, 420px)', display: 'flex' }}>
        <LivingFlashcard
          key={words[index].id}
          word={words[index]}
          prefs={prefs}
          isFlipped={flipped}
          onFlip={() => setFlipped(true)}
          onFlipBack={() => setFlipped(false)}
          reduce={reduce}
          footerHint={flipped ? undefined : 'tap to turn it over'}
        />
      </div>

      <PrimaryButton
        disabled={!flipped}
        onClick={() => {
          if (last) { onDone(); return; }
          setFlipped(false);
          setIndex(i => i + 1);
        }}
      >
        {last ? 'Now test me' : 'Next word'}
      </PrimaryButton>
    </div>
  );
}

/* ─── 2. repair quiz — in a sentence, not a definition ─────────────── */

interface QuizQuestion {
  id:           string;
  questionText: string;
  options:      { letter: string; wordId: number; word: string }[];
  optionKind?:  'word' | 'string';
  inputMode?:   'choice' | 'typed';
}
interface QuizSession { sessionId: number; questions: QuizQuestion[] }

async function generateQuiz(wordIds: number[]): Promise<QuizSession | null> {
  try {
    const res = await fetch('/api/vocab/quiz/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'briefing', wordIds }),
    });
    if (!res.ok) return null;
    const data = await res.json() as QuizSession;
    // Typed questions have no options to tap — onboarding stays multiple choice.
    const questions = data.questions.filter(q => q.inputMode !== 'typed');
    return questions.length ? { ...data, questions } : null;
  } catch { return null; }
}

function RepairQuiz({ sessionPromise, onDone }: {
  sessionPromise: Promise<QuizSession | null> | null;
  onDone: (score: { correct: number; total: number }) => void;
}) {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [index, setIndex]     = useState(0);
  const [picked, setPicked]   = useState<string | null>(null);
  const [result, setResult]   = useState<{ isCorrect: boolean; correctLetter: string; explanation: string } | null>(null);
  const correctRef = useRef(0);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    if (!sessionPromise) { onDone({ correct: 0, total: 0 }); return; }
    // A failed generation must not strand the user — skip straight to the result.
    sessionPromise.then(s => { if (s) setSession(s); else onDone({ correct: 0, total: 0 }); });
  }, [sessionPromise, onDone]);

  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div style={{ position: 'relative', width: '100%', maxWidth: 320, padding: 2, borderRadius: 20 }}>
          <motion.div
            animate={reduce ? {} : { rotate: 360 }}
            transition={reduce ? {} : { repeat: Infinity, duration: 2.5, ease: 'linear' }}
            style={{
              position: 'absolute', inset: 0, borderRadius: 20,
              background: 'conic-gradient(from 0deg, var(--color-lx-accent-red) 0%, transparent 35%, transparent 65%, var(--color-lx-accent-red) 100%)',
            }}
          />
          <div style={{
            position: 'relative', borderRadius: 18,
            background: 'var(--color-lx-surface)',
            padding: '2rem 1.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
            alignItems: 'center', textAlign: 'center',
          }}>
            <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.8125rem', color: 'var(--color-lx-text-secondary)', letterSpacing: '0.04em' }}>
              Writing your sentences…
            </p>
          </div>
        </div>
        <LSays>Writing you a sentence for each one.</LSays>
      </div>
    );
  }

  const q        = session.questions[index];
  const byLetter = q.optionKind === 'string';
  const isLast   = index === session.questions.length - 1;

  async function choose(opt: QuizQuestion['options'][number]) {
    if (picked || !session) return;
    setPicked(opt.letter);
    const res = await fetch('/api/vocab/quiz/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId:  session.sessionId,
        questionId: q.id,
        ...(byLetter ? { selectedLetter: opt.letter } : { selectedWordId: opt.wordId }),
      }),
    });
    const data = await res.json() as { isCorrect: boolean; correctLetter: string; explanation: string };
    if (data.isCorrect) correctRef.current += 1;
    setResult(data);
  }

  function next() {
    if (!session) return;
    if (isLast) { onDone({ correct: correctRef.current, total: session.questions.length }); return; }
    setPicked(null);
    setResult(null);
    setIndex(i => i + 1);
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-4">
      <span className="text-xs tabular-nums" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-text-muted)' }}>
        {index + 1} of {session.questions.length}
      </span>

      <p style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 'clamp(1.35rem, 5.5vw, 1.8rem)',
        lineHeight: 1.45,
        color: 'var(--color-lx-text-primary)',
        margin: 0,
      }}>
        {q.questionText}
      </p>

      <div className="flex flex-col gap-2.5">
        {q.options.map(opt => {
          const isPicked = picked === opt.letter;
          const isAnswer = result?.correctLetter === opt.letter;
          const tone = !result ? null : isAnswer ? 'right' : isPicked ? 'wrong' : null;
          return (
            <motion.button
              key={opt.letter}
              onClick={() => choose(opt)}
              disabled={Boolean(picked)}
              whileTap={picked ? {} : { scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className="rounded-2xl px-4 py-3.5 text-left text-[0.95rem]"
              style={{
                fontFamily: "'Sora', sans-serif",
                background: tone === 'right' ? 'rgba(46,204,113,0.12)'
                          : tone === 'wrong' ? 'rgba(230,57,70,0.12)'
                          : 'var(--color-lx-elevated)',
                border: `1px solid ${tone === 'right' ? 'rgba(46,204,113,0.4)'
                                   : tone === 'wrong' ? 'rgba(230,57,70,0.4)'
                                   : 'var(--color-lx-border)'}`,
                boxShadow: tone === 'right' ? '0 0 0 3px rgba(46,204,113,0.1)'
                         : tone === 'wrong' ? '0 0 0 3px rgba(230,57,70,0.1)'
                         : 'none',
                color: 'var(--color-lx-text-primary)',
                opacity: picked && !tone ? 0.45 : 1,
              }}
            >
              {opt.word}
            </motion.button>
          );
        })}
      </div>

      {result && (
        <div className="mt-auto flex flex-col gap-4">
          <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-lx-text-muted)', margin: 0 }}>
            {result.explanation}
          </p>
          <PrimaryButton onClick={next}>{isLast ? 'Done' : 'Next'}</PrimaryButton>
        </div>
      )}
    </div>
  );
}

/* ─── 3. activation — what actually just happened ──────────────────── */

function ActivationResult({ userName, score, repaired, reduce, onNext }: {
  userName: string;
  score: { correct: number; total: number } | null;
  repaired: number;
  reduce: boolean;
  onNext: () => void;
}) {
  const line = !score || score.total === 0
    ? `Nothing broke, ${firstName(userName)} — so we start at the edge instead.`
    : score.correct === score.total
      ? `${score.total === 1 ? 'That word' : `All ${score.total}`} came back in a sentence you had never seen. That is the whole method.`
      : score.correct > 0
        ? `${score.correct} of ${score.total} came back in context. The rest go into review, not the bin.`
        : 'They have not stuck yet. That is what review is for — you will see them again tomorrow.';

  const metricDelay = reduce ? 0 : 0.12;
  const lineDelay    = reduce ? 0 : metricDelay + 0.3 + 0.03;

  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-10">
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0.1 : 0.18 }}
        className="text-xs font-semibold tracking-[0.16em]"
        style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-accent-gold)' }}
      >
        L&rsquo;S READ
      </motion.span>

      {score && score.total > 0 && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.32, delay: metricDelay, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-2 gap-3"
        >
          <ReadMetric value={score.correct} label="back in context" />
          <ReadMetric value={score.total - score.correct} label="into review" tone={score.total - score.correct > 0 ? 'flag' : undefined} />
        </motion.div>
      )}

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.22, delay: lineDelay, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-4"
      >
        <LSays>{line}</LSays>

        {repaired > 0 && score && score.total > 0 && (
          <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--color-lx-text-muted)', margin: 0 }}>
            A minute ago {repaired === 1 ? 'that word was' : 'those words were'} a guess. Everything after this is the
            same loop, on a longer list.
          </p>
        )}
      </motion.div>

      <div className="mt-auto">
        <PrimaryButton onClick={onNext}>Set up my list</PrimaryButton>
      </div>
    </div>
  );
}

function ReadMetric({ value, label, tone }: { value: number; label: string; tone?: 'flag' }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl px-4 py-3.5"
      style={{
        background: 'var(--color-lx-surface)',
        border: `1px solid ${tone === 'flag' ? 'rgba(230,57,70,0.35)' : 'var(--color-lx-border)'}`,
      }}
    >
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--color-lx-text-primary)' }}
      >
        {value}
      </span>
      <span className="text-xs" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

/* ─── 4. tracks ────────────────────────────────────────────────────── */

function TrackPicker({ tracks, selected, onToggle, onNext }: {
  tracks: TrackOption[];
  selected: number[];
  onToggle: (id: number) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 py-4">
      <LSays>What are you actually studying for? Pick as many as apply.</LSays>

      <div className="flex flex-col gap-2.5">
        {tracks.map(t => {
          const on = selected.includes(t.id);
          return (
            <motion.button
              key={t.id}
              onClick={() => onToggle(t.id)}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              aria-pressed={on}
              className="rounded-2xl px-4 py-3.5 text-left"
              style={{
                fontFamily: "'Sora', sans-serif",
                background: on ? 'rgba(230,57,70,0.10)' : 'var(--color-lx-elevated)',
                border: `1px solid ${on ? 'var(--color-lx-accent-red)' : 'var(--color-lx-border)'}`,
                boxShadow: on ? '0 0 0 3px rgba(230,57,70,0.1)' : 'none',
                color: 'var(--color-lx-text-primary)',
              }}
            >
              <span className="text-[0.95rem] font-semibold">{t.name}</span>
              <span className="mt-1 block text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>
                {t.description ?? `${t.totalWords} words`}
                {' · first '}{Math.min(t.trialWords, t.totalWords)} free
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-auto">
        <PrimaryButton disabled={selected.length === 0} onClick={onNext}>
          {selected.length > 1 ? `Continue with ${selected.length}` : 'Continue'}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ─── 5. pace ──────────────────────────────────────────────────────── */

const PACES = [
  { words: 3,  label: 'Steady',   note: '3 words a day' },
  { words: 6,  label: 'Serious',  note: '6 words a day' },
  { words: 12, label: 'Deadline', note: '12 words a day' },
];

function PacePicker({ tracks, trackIds, onSubmit }: {
  tracks: TrackOption[];
  trackIds: number[];
  onSubmit: (deadline: Date | null, wordsPerDay: number) => Promise<boolean>;
}) {
  const [pace, setPace] = useState(6);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  const min = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), []);

  // An exam date implies its own pace — the two can't both drive wordsPerDay,
  // so picking a date overrides (and visually disables) the manual buttons.
  const totalWords = useMemo(
    () => tracks.filter(t => trackIds.includes(t.id)).reduce((sum, t) => sum + t.totalWords, 0),
    [tracks, trackIds],
  );
  const examPace = useMemo(() => {
    if (!date) return null;
    const days = Math.max(1, Math.round((new Date(`${date}T00:00:00.000Z`).getTime() - Date.now()) / 86400000));
    return Math.min(100, Math.max(1, Math.ceil(totalWords / days)));
  }, [date, totalWords]);
  const effectivePace = examPace ?? pace;

  return (
    <div className="flex flex-1 flex-col gap-6 py-4">
      <LSays>How hard are you going at this?</LSays>

      <div
        className="flex flex-col gap-2.5"
        style={{ opacity: examPace !== null ? 0.4 : 1, pointerEvents: examPace !== null ? 'none' : 'auto' }}
      >
        {PACES.map(p => {
          const on = pace === p.words;
          return (
            <motion.button
              key={p.words}
              onClick={() => setPace(p.words)}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              aria-pressed={on}
              className="rounded-2xl px-4 py-3.5 text-left"
              style={{
                fontFamily: "'Sora', sans-serif",
                background: on ? 'rgba(230,57,70,0.10)' : 'var(--color-lx-elevated)',
                border: `1px solid ${on ? 'var(--color-lx-accent-red)' : 'var(--color-lx-border)'}`,
                boxShadow: on ? '0 0 0 3px rgba(230,57,70,0.1)' : 'none',
                color: 'var(--color-lx-text-primary)',
              }}
            >
              <span className="text-[0.95rem] font-semibold">{p.label}</span>
              <span className="mt-1 block text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>{p.note}</span>
            </motion.button>
          );
        })}
      </div>

      <label className="flex flex-col gap-2" style={{ fontFamily: "'Sora', sans-serif" }}>
        <span className="text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>Exam date, if you have one</span>
        <input
          type="date"
          value={date}
          min={min}
          onChange={e => setDate(e.target.value)}
          className="rounded-2xl px-4 py-3.5 text-[0.95rem]"
          style={{
            background: 'var(--color-lx-elevated)',
            border: '1px solid var(--color-lx-border)',
            color: 'var(--color-lx-text-primary)',
            colorScheme: 'dark',
          }}
        />
        {examPace !== null && (
          <span className="text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>
            That&rsquo;s {examPace} words a day to be ready in time — this replaces the pace above.
          </span>
        )}
      </label>

      <div className="mt-auto">
        <PrimaryButton
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onSubmit(date ? new Date(`${date}T00:00:00.000Z`) : null, effectivePace);
            if (!ok) setBusy(false);
          }}
        >
          {busy ? 'Setting up…' : 'Start'}
        </PrimaryButton>
      </div>
    </div>
  );
}
