'use client';

/**
 * WordChargeScreen — main state-machine orchestrator for the Word Charge game.
 *
 * State machine:
 *   loading → intro? → countdown → playing ↔ (explain | help | paused) → finishing → results
 *
 * Timer implementation: drift-proof.
 *   - We accumulate `activeMs` = sum of (performance.now() deltas while status==='playing').
 *   - Each animation frame, remaining = ROUND_MS - activeMs.
 *   - Pausing = stop accumulating (save checkpoint). Resuming = set new startAt.
 *   - This means the timer never drifts regardless of tab-hide or heavy GC pauses.
 *
 * Hard conventions honored:
 *   - Full-page wrapper: opacity only (no transform/filter) — see PageTransition header comment.
 *   - Drag tint overlays: only mounted while dragging (see ChargeCard).
 *   - Decorative CSS animations: visible frozen state at end.
 *   - useReducedMotion: countdown instant, animations faded.
 *   - Touch targets ≥44px.
 *   - Keyboard: ← negative, → positive, H help, Space/P pause.
 *   - Auto-pause on visibilitychange hidden.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Pause, HelpCircle, Flame } from 'lucide-react';
import { useSafeNavigate } from '@/hooks/useSafeNavigate';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import AnimatedNumber from '@/components/vocab/AnimatedNumber';

import ChargeCard    from './ChargeCard';
import ChargeIntro   from './ChargeIntro';
import ExplainSheet  from './ExplainSheet';
import ChargeResults from './ChargeResults';

import type {
  ChargeWord,
  ChargeAnswer,
  ChargeStartResponse,
  ChargeFinishResponse,
} from '@/lib/vocab/word-charge/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROUND_MS    = 30_000;
const INTRO_KEY   = 'lx-charge-intro';
const SANS        = "'Sora', sans-serif";
const SERIF       = "'Cormorant Garamond', Georgia, serif";

// ─── Game state machine ───────────────────────────────────────────────────────

type Phase =
  | 'loading'
  | 'error'
  | 'intro'
  | 'countdown'
  | 'playing'
  | 'explain'      // wrong-answer sheet open (timer paused)
  | 'help'         // help sheet open (timer paused)
  | 'paused'       // manual pause or visibility-hidden (timer paused)
  | 'finishing'    // POST /finish in flight
  | 'results';

interface GameState {
  phase:        Phase;
  words:        ChargeWord[];
  roundId:      number;
  personalBest: number;
  totalPoints:  number;
  // Gameplay
  cardIndex:    number;    // index into words[]
  answers:      ChargeAnswer[];
  streak:       number;
  bestStreak:   number;
  roundPoints:  number;    // client-side accumulator (display only; server is authoritative)
  // Help
  helpUsedForCurrent: boolean;
  // Timer
  activeMs:     number;    // accumulated active time
  timerStartAt: number;    // performance.now() snapshot when last resumed
  // Results
  result:       ChargeFinishResponse | null;
  saveError:    boolean;
}

type Action =
  | { type: 'LOAD_OK'; payload: ChargeStartResponse }
  | { type: 'LOAD_ERR' }
  | { type: 'INTRO_DONE' }
  | { type: 'COUNTDOWN_DONE'; now: number }
  | { type: 'COMMIT'; choice: 'positive' | 'negative'; now: number }
  | { type: 'OPEN_HELP'; now: number }
  | { type: 'HELP_CHOOSE'; choice: 'positive' | 'negative'; now: number }
  | { type: 'HELP_SKIP'; now: number }
  | { type: 'WRONG_CONTINUE'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'TIME_UP'; now: number }
  | { type: 'FINISH_OK'; result: ChargeFinishResponse }
  | { type: 'FINISH_ERR' }
  | { type: 'RETRY_SAVE' }
  | { type: 'PLAY_AGAIN' }
  | { type: 'TICK'; now: number };   // unused currently — kept for future rAF-driven dispatch

function pointsFor(isCorrect: boolean, usedHelp: boolean, streak: number): number {
  if (!isCorrect) return 0;
  const base = usedHelp ? 2 : 5;
  // Milestone bonus: every 5th consecutive correct
  const newStreak = streak + 1;
  const milestone = newStreak % 5 === 0 ? 10 : 0;
  return base + milestone;
}

function initialState(): GameState {
  return {
    phase: 'loading',
    words: [], roundId: 0, personalBest: 0, totalPoints: 0,
    cardIndex: 0, answers: [], streak: 0, bestStreak: 0, roundPoints: 0,
    helpUsedForCurrent: false,
    activeMs: 0, timerStartAt: 0,
    result: null, saveError: false,
  };
}

function advanceCard(s: GameState, now: number): GameState {
  const nextIndex = s.cardIndex + 1;
  const hasMore   = nextIndex < s.words.length;
  return {
    ...s,
    cardIndex:           hasMore ? nextIndex : s.cardIndex,
    helpUsedForCurrent:  false,
    phase:               hasMore ? 'playing' : 'finishing',
    timerStartAt:        hasMore ? now : s.timerStartAt,
  };
}

function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'LOAD_OK': {
      const skipIntro = typeof window !== 'undefined' && localStorage.getItem(INTRO_KEY) === '1';
      return {
        ...s,
        phase:        skipIntro ? 'countdown' : 'intro',
        words:        a.payload.words,
        roundId:      a.payload.roundId,
        personalBest: a.payload.personalBest,
        totalPoints:  a.payload.totalPoints,
      };
    }
    case 'LOAD_ERR':
      return { ...s, phase: 'error' };

    case 'INTRO_DONE':
      return { ...s, phase: 'countdown' };

    case 'COUNTDOWN_DONE':
      return { ...s, phase: 'playing', timerStartAt: a.now, activeMs: 0 };

    case 'COMMIT': {
      if (s.phase !== 'playing') return s;
      const word    = s.words[s.cardIndex];
      if (!word) return s;
      const correct = a.choice === word.connotation;
      const pts     = pointsFor(correct, s.helpUsedForCurrent, s.streak);
      const newStreak    = correct ? s.streak + 1 : 0;
      const newBestStreak = Math.max(s.bestStreak, newStreak);
      const newAnswers = [...s.answers, { wordId: word.id, choice: a.choice, usedHelp: s.helpUsedForCurrent }];

      if (!correct) {
        // Pause timer, open explain sheet
        const elapsed = a.now - s.timerStartAt;
        return {
          ...s,
          phase:       'explain',
          answers:     newAnswers,
          streak:      0,
          bestStreak:  newBestStreak,
          activeMs:    s.activeMs + elapsed,
        };
      }
      // Correct: advance
      return advanceCard({
        ...s,
        answers:     newAnswers,
        streak:      newStreak,
        bestStreak:  newBestStreak,
        roundPoints: s.roundPoints + pts,
      }, a.now);
    }

    case 'OPEN_HELP': {
      if (s.phase !== 'playing') return s;
      const elapsed = a.now - s.timerStartAt;
      return {
        ...s,
        phase:              'help',
        helpUsedForCurrent: true,
        activeMs:           s.activeMs + elapsed,
      };
    }

    case 'HELP_CHOOSE': {
      if (s.phase !== 'help') return s;
      const word    = s.words[s.cardIndex];
      if (!word) return s;
      const correct = a.choice === word.connotation;
      const pts     = pointsFor(correct, true, s.streak);
      const newStreak    = correct ? s.streak + 1 : 0;
      const newBestStreak = Math.max(s.bestStreak, newStreak);
      const newAnswers = [...s.answers, { wordId: word.id, choice: a.choice, usedHelp: true }];

      if (!correct) {
        // Swap from help → explain (timer stays paused)
        return {
          ...s,
          phase:      'explain',
          answers:    newAnswers,
          streak:     0,
          bestStreak: newBestStreak,
        };
      }
      return advanceCard({
        ...s,
        answers:     newAnswers,
        streak:      newStreak,
        bestStreak:  newBestStreak,
        roundPoints: s.roundPoints + pts,
      }, a.now);
    }

    case 'HELP_SKIP': {
      if (s.phase !== 'help') return s;
      const word = s.words[s.cardIndex];
      if (!word) return s;
      const newAnswers = [...s.answers, { wordId: word.id, choice: null, usedHelp: true }];
      return advanceCard({ ...s, answers: newAnswers }, a.now);
    }

    case 'WRONG_CONTINUE':
      return advanceCard({ ...s }, a.now);

    case 'PAUSE': {
      if (s.phase !== 'playing') return s;
      const elapsed = a.now - s.timerStartAt;
      return { ...s, phase: 'paused', activeMs: s.activeMs + elapsed };
    }

    case 'RESUME': {
      if (s.phase !== 'paused') return s;
      return { ...s, phase: 'playing', timerStartAt: a.now };
    }

    case 'TIME_UP': {
      const elapsed = a.now - s.timerStartAt;
      return { ...s, phase: 'finishing', activeMs: s.activeMs + elapsed };
    }

    case 'FINISH_OK':
      return { ...s, phase: 'results', result: a.result, saveError: false };

    case 'FINISH_ERR':
      return { ...s, phase: 'results', result: null, saveError: true };

    case 'RETRY_SAVE':
      return { ...s, phase: 'finishing', saveError: false };

    case 'PLAY_AGAIN':
      return initialState();

    case 'TICK':
      // Only update timerStartAt conceptually — actual remaining derived in component
      return s;

    default:
      return s;
  }
}

// ─── Drift-proof timer hook ───────────────────────────────────────────────────

function useGameTimer(phase: Phase, activeMs: number, timerStartAt: number) {
  const [remaining, setRemaining] = useState(ROUND_MS);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (phase === 'playing') {
      function tick() {
        const elapsed = performance.now() - timerStartAt;
        const r = Math.max(0, ROUND_MS - (activeMs + elapsed));
        setRemaining(r);
        if (r > 0) {
          rafRef.current = requestAnimationFrame(tick);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    } else {
      // Paused/explain/help: show frozen remaining
      setRemaining(Math.max(0, ROUND_MS - activeMs));
    }
  }, [phase, activeMs, timerStartAt]);

  return remaining;
}

// ─── Countdown component ──────────────────────────────────────────────────────

function Countdown({ onDone, reduce }: { onDone: () => void; reduce: boolean }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (reduce) {
      // Instant: skip animation entirely
      const t = setTimeout(() => onDone(), 50);
      return () => clearTimeout(t);
    }
    const interval = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          clearInterval(interval);
          setTimeout(onDone, 450);
          return 0;
        }
        return c - 1;
      });
    }, 450);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduce) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 55,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-lx-base)',
      pointerEvents: 'none',
    }}>
      <AnimatePresence mode="wait">
        <motion.p
          key={count}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
            fontSize: 'clamp(4rem, 20vw, 8rem)',
            color: count === 0 ? 'var(--color-lx-accent-gold)' : 'var(--color-lx-text-primary)',
          }}
        >
          {count === 0 ? 'Go!' : count}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ─── Time-up beat ─────────────────────────────────────────────────────────────

function TimeUpBeat({ onDone, reduce }: { onDone: () => void; reduce: boolean }) {
  useEffect(() => {
    const t = setTimeout(onDone, reduce ? 50 : 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduce) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 55,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)', pointerEvents: 'none',
      }}
    >
      <motion.p
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.2, opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
          fontSize: 'clamp(2.5rem, 12vw, 5rem)',
          color: 'var(--color-lx-accent-gold)',
        }}
      >
        Time!
      </motion.p>
    </motion.div>
  );
}

// ─── Pause overlay ────────────────────────────────────────────────────────────

function PauseOverlay({
  onResume, onHelp, onExit, reduce,
}: {
  onResume: () => void;
  onHelp:   () => void;
  onExit:   () => void;
  reduce:   boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 58,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 340,
        background: 'var(--color-lx-surface)',
        border: '1px solid var(--color-lx-border)',
        borderRadius: 20,
        padding: '2rem 1.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.875rem',
        alignItems: 'center',
      }}>
        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, fontSize: '2rem', color: 'var(--color-lx-text-primary)' }}>
          Paused
        </p>
        <motion.button
          whileTap={reduce ? {} : { scale: 0.975 }}
          onClick={onResume}
          style={{
            width: '100%', minHeight: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-lx-accent-red)',
            border: 'none', borderRadius: 14,
            fontFamily: SANS, fontSize: '0.9rem', fontWeight: 700,
            color: '#fff', cursor: 'pointer',
          }}
        >
          Resume
        </motion.button>
        <button
          onClick={onHelp}
          style={{
            width: '100%', minHeight: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'var(--color-lx-elevated)',
            border: '1px solid var(--color-lx-border)', borderRadius: 14,
            fontFamily: SANS, fontSize: '0.85rem', fontWeight: 500,
            color: 'var(--color-lx-text-secondary)', cursor: 'pointer',
          }}
        >
          <HelpCircle size={15} /> How to play
        </button>
        <button
          onClick={onExit}
          style={{
            background: 'none', border: 'none',
            fontFamily: SANS, fontSize: '0.78rem',
            color: 'var(--color-lx-text-muted)',
            cursor: 'pointer', padding: '0.375rem', minHeight: 44,
          }}
        >
          Exit
        </button>
      </div>
    </motion.div>
  );
}

// ─── Floating points chip ─────────────────────────────────────────────────────

interface FloatingChipProps { label: string; onDone: () => void; reduce: boolean }
function FloatingChip({ label, onDone, reduce }: FloatingChipProps) {
  useEffect(() => {
    const t = setTimeout(onDone, reduce ? 100 : 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: reduce ? 0 : -48 }}
      transition={{ duration: reduce ? 0.1 : 0.85, ease: 'easeOut' }}
      style={{
        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, pointerEvents: 'none',
        fontFamily: SANS, fontSize: '0.85rem', fontWeight: 700,
        color: 'var(--color-lx-success)',
        background: 'rgba(46,204,113,0.12)',
        border: '1px solid rgba(46,204,113,0.4)',
        borderRadius: 20, padding: '0.2rem 0.65rem',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </motion.div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WordChargeScreen() {
  const { navigate } = useSafeNavigate();
  const fb           = useVocabFeedback();
  const reduce       = useReducedMotion() ?? false;

  // loadKey increments on play-again to re-trigger the start fetch
  const [loadKey, setLoadKey] = useState(0);
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const {
    phase, words, roundId, answers,
    streak, bestStreak, roundPoints,
    activeMs, timerStartAt,
    result, saveError,
  } = state;

  // Drift-proof timer
  const remaining  = useGameTimer(phase, activeMs, timerStartAt);
  const remainSecs = Math.ceil(remaining / 1000);

  // Container width for commit threshold
  const containerRef   = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(320);
  useLayoutEffect(() => {
    if (containerRef.current) setContainerW(containerRef.current.offsetWidth);
  }, []);

  // Floating chip state
  const [floatingChip, setFloatingChip] = useState<{ id: number; label: string } | null>(null);
  const chipId = useRef(0);

  // Intro overlay shown from help
  const [showIntroOverlay, setShowIntroOverlay] = useState(false);

  // Time-up beat shown flag
  const [timeUpVisible, setTimeUpVisible] = useState(false);
  const timeUpFired = useRef(false);

  // ── Load on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    fetch('/api/vocab/word-charge/start', { method: 'POST' })
      .then(r => r.ok ? r.json() as Promise<ChargeStartResponse> : Promise.reject(r))
      .then(data => { if (!cancelled) dispatch({ type: 'LOAD_OK', payload: data }); })
      .catch(() => { if (!cancelled) dispatch({ type: 'LOAD_ERR' }); });
    return () => { cancelled = true; };
  }, [loadKey]);

  // ── Timer expiry ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase === 'playing' && remaining <= 0 && !timeUpFired.current) {
      timeUpFired.current = true;
      setTimeUpVisible(true);
      dispatch({ type: 'TIME_UP', now: performance.now() });
    }
  }, [remaining, phase]);

  // ── Auto-pause on visibility change ──────────────────────────────────────

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden && phase === 'playing') {
        dispatch({ type: 'PAUSE', now: performance.now() });
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'playing') return;

    function handleKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handleCommit('negative');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleCommit('positive');
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          dispatch({ type: 'OPEN_HELP', now: performance.now() });
          break;
        case ' ':
        case 'p':
        case 'P':
          e.preventDefault();
          dispatch({ type: 'PAUSE', now: performance.now() });
          break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state.cardIndex]);

  // ── Finish POST ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'finishing') return;
    const req = { roundId, answers, bestStreak };
    let cancelled = false;

    fetch('/api/vocab/word-charge/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
      .then(r => r.ok ? r.json() as Promise<ChargeFinishResponse> : Promise.reject(r))
      .then(res => { if (!cancelled) dispatch({ type: 'FINISH_OK', result: res }); })
      .catch(() => { if (!cancelled) dispatch({ type: 'FINISH_ERR' }); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handleCommit = useCallback((choice: 'positive' | 'negative') => {
    const word = words[state.cardIndex];
    if (!word || state.phase !== 'playing') return;
    const correct = choice === word.connotation;

    if (correct) {
      fb.play('correct');
      // Floating chip
      const pts = pointsFor(true, state.helpUsedForCurrent, state.streak);
      const isStreak5 = (state.streak + 1) % 5 === 0;
      const label = isStreak5 ? `+${pts} 🔥 Streak!` : `+${pts}`;
      chipId.current += 1;
      setFloatingChip({ id: chipId.current, label });
      if (isStreak5) fb.play('levelUp');
    } else {
      fb.play('incorrect');
    }

    dispatch({ type: 'COMMIT', choice, now: performance.now() });
  }, [words, state.cardIndex, state.phase, state.helpUsedForCurrent, state.streak, fb, dispatch]);

  // No separate handleCountdownDone — inline in JSX dispatch below

  function handleExit() {
    // Fire-and-forget best-effort finish
    if (roundId && answers.length > 0) {
      try {
        navigator.sendBeacon(
          '/api/vocab/word-charge/finish',
          JSON.stringify({ roundId, answers, bestStreak }),
        );
      } catch {
        fetch('/api/vocab/word-charge/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundId, answers, bestStreak }),
        }).catch(() => {});
      }
    }
    navigate('/vocab/games');
  }

  function handlePlayAgain() {
    timeUpFired.current = false;
    dispatch({ type: 'PLAY_AGAIN' });
    setLoadKey(k => k + 1);
    setTimeUpVisible(false);
    setFloatingChip(null);
    setShowIntroOverlay(false);
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div style={{ padding: '2rem 1.25rem', maxWidth: 560, margin: '0 auto' }}>
        <div style={{
          height: 208, borderRadius: 18,
          background: 'var(--color-lx-surface)',
          border: '1px solid var(--color-lx-border)',
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.04) 50%, transparent 80%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s ease infinite',
          }} />
        </div>
      </div>
    );
  }

  // ── Render: error ─────────────────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <div style={{ padding: '2rem 1.25rem', maxWidth: 560, margin: '0 auto' }}>
        <div style={{
          padding: '1rem 1.125rem', borderRadius: 12,
          background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.2)',
          fontFamily: SANS, fontSize: '0.8rem', color: 'var(--color-lx-text-secondary)',
        }}>
          Couldn&apos;t load the round. Check your connection and try again.
        </div>
      </div>
    );
  }

  // ── Render: intro ─────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <ChargeIntro
        reduce={reduce}
        onDone={() => {
          try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ }
          dispatch({ type: 'INTRO_DONE' });
        }}
        onSkip={() => {
          try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ }
          dispatch({ type: 'INTRO_DONE' });
        }}
      />
    );
  }

  // ── Render: results / finishing ───────────────────────────────────────────

  if (phase === 'results' || phase === 'finishing') {
    return (
      <ChargeResults
        result={result}
        saveError={saveError}
        onSaveRetry={() => dispatch({ type: 'RETRY_SAVE' })}
        onPlayAgain={handlePlayAgain}
        onBack={() => navigate('/vocab/games')}
        words={words}
        answers={answers}
        reduce={reduce}
      />
    );
  }

  // ── Render: countdown + playing + paused + explain + help ─────────────────

  const currentWord = words[state.cardIndex];
  const timerPct    = (remaining / ROUND_MS) * 100;
  const isLowTime   = remainSecs <= 5;
  const cardKey     = currentWord ? `${currentWord.id}-${state.cardIndex}` : 'none';

  return (
    <div
      style={{
        height: 'calc(100dvh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        padding: '0.75rem 1.25rem 1rem',
        maxWidth: 560,
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* ── Countdown overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'countdown' && (
          <Countdown
            key="countdown"
            reduce={reduce}
            onDone={() => {
              timeUpFired.current = false;
              // Dispatch with now timestamp embedded via special handling
              dispatch({ type: 'COUNTDOWN_DONE', now: performance.now() });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Time-up beat ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {timeUpVisible && (
          <TimeUpBeat
            key="timeup"
            reduce={reduce}
            onDone={() => setTimeUpVisible(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Pause overlay ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'paused' && !showIntroOverlay && (
          <PauseOverlay
            key="pause"
            reduce={reduce}
            onResume={() => dispatch({ type: 'RESUME', now: performance.now() })}
            onHelp={() => setShowIntroOverlay(true)}
            onExit={handleExit}
          />
        )}
      </AnimatePresence>

      {/* ── Intro overlay (from help icon / pause) ─────────────────────────── */}
      <AnimatePresence>
        {showIntroOverlay && (
          <ChargeIntro
            key="intro-overlay"
            reduce={reduce}
            asOverlay
            onDone={() => setShowIntroOverlay(false)}
            onSkip={() => setShowIntroOverlay(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Explain / Help sheet ───────────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === 'explain' || phase === 'help') && currentWord && (
          phase === 'explain' ? (
            <ExplainSheet
              key="explain"
              mode="wrong"
              word={currentWord}
              playerChoice={
                // Last answer's choice
                (answers[answers.length - 1]?.choice ?? 'positive') as 'positive' | 'negative'
              }
              onContinue={() => dispatch({ type: 'WRONG_CONTINUE', now: performance.now() })}
              reduce={reduce}
            />
          ) : (
            <ExplainSheet
              key="help"
              mode="help"
              word={currentWord}
              onChoose={choice => {
                const correct = choice === currentWord.connotation;
                if (correct) fb.play('correct'); else fb.play('incorrect');
                dispatch({ type: 'HELP_CHOOSE', choice, now: performance.now() });
              }}
              onSkip={() => dispatch({ type: 'HELP_SKIP', now: performance.now() })}
              reduce={reduce}
            />
          )
        )}
      </AnimatePresence>

      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: '0.75rem', flexShrink: 0,
      }}>
        {/* Pause button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => dispatch({ type: 'PAUSE', now: performance.now() })}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-lx-elevated)',
            border: '1px solid var(--color-lx-border)',
            color: 'var(--color-lx-text-secondary)',
            cursor: 'pointer', flexShrink: 0,
          }}
          aria-label="Pause game"
        >
          <Pause size={16} />
        </motion.button>

        {/* Timer ring (manual SVG ring, proportional to timerPct) */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={32} cy={32} r={26} fill="none" strokeWidth={5} stroke="var(--color-lx-elevated)" />
            <circle
              cx={32} cy={32} r={26} fill="none" strokeWidth={5}
              stroke={isLowTime ? 'var(--color-lx-accent-red)' : 'var(--color-lx-accent-gold)'}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 26}
              strokeDashoffset={2 * Math.PI * 26 * (1 - timerPct / 100)}
              style={{ transition: 'stroke 0.3s' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: SERIF, fontWeight: 700, fontSize: '1.1rem',
              color: isLowTime ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-primary)',
              // CSS pulse at ≤5s — pure class, frozen state = opacity:1
            }} className={isLowTime && !reduce ? 'lx-timer-pulse' : undefined}>
              {remainSecs}
            </span>
          </div>
        </div>

        {/* Points + streak */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: SANS, fontSize: '0.82rem', fontWeight: 700,
            color: 'var(--color-lx-accent-gold)',
          }}>
            <AnimatedNumber value={roundPoints} />
          </span>
          {streak >= 2 && (
            <motion.span
              key={streak}
              initial={{ scale: reduce ? 1 : 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                fontFamily: SANS, fontSize: '0.75rem', fontWeight: 700,
                color: 'var(--color-lx-accent-gold)',
              }}
            >
              <Flame size={13} />
              {streak}
            </motion.span>
          )}
        </div>

        {/* Help icon */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            dispatch({ type: 'PAUSE', now: performance.now() });
            setShowIntroOverlay(true);
          }}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-lx-elevated)',
            border: '1px solid var(--color-lx-border)',
            color: 'var(--color-lx-text-muted)',
            cursor: 'pointer', flexShrink: 0,
          }}
          aria-label="How to play"
        >
          <HelpCircle size={16} />
        </motion.button>
      </div>

      {/* ── Progress dots ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3, marginBottom: '0.75rem',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {words.slice(0, Math.min(words.length, 20)).map((_, i) => {
          const isAttempted = i < state.cardIndex;
          const isCurrent   = i === state.cardIndex;
          return (
            <div key={i} style={{
              width: isCurrent ? 10 : 6,
              height: 6,
              borderRadius: 3,
              background: isAttempted
                ? 'var(--color-lx-text-muted)'
                : isCurrent
                ? 'var(--color-lx-accent-gold)'
                : 'var(--color-lx-elevated)',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }} />
          );
        })}
        {words.length > 20 && (
          <span style={{ fontFamily: SANS, fontSize: '0.6rem', color: 'var(--color-lx-text-muted)' }}>
            +{words.length - 20}
          </span>
        )}
      </div>

      {/* ── Side rails ────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', flex: 1, display: 'flex', alignItems: 'center',
      }}>
        {/* Left rail — Negative — blue */}
        <div style={{
          position: 'absolute', left: -16, top: 0, bottom: 0, width: 36,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6, zIndex: 1,
        }}>
          <span style={{
            fontFamily: SANS, fontWeight: 800, fontSize: '1.2rem',
            color: 'var(--color-lx-mastery-familiar)',
            opacity: 0.4,
          }}>−</span>
          <span style={{
            fontFamily: SANS, fontSize: '0.52rem', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--color-lx-mastery-familiar)',
            opacity: 0.4,
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
          }}>Negative</span>
        </div>

        {/* Card area */}
        <div
          ref={containerRef}
          style={{ flex: 1, position: 'relative', margin: '0 28px' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {currentWord && (
              <motion.div
                key={cardKey}
                initial={{ opacity: 0, y: reduce ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -10 }}
                transition={{ duration: reduce ? 0.05 : 0.2, ease: 'easeOut' }}
                style={{ position: 'relative' }}
              >
                {/* Floating chip */}
                <AnimatePresence>
                  {floatingChip && (
                    <FloatingChip
                      key={floatingChip.id}
                      label={floatingChip.label}
                      reduce={reduce}
                      onDone={() => setFloatingChip(null)}
                    />
                  )}
                </AnimatePresence>

                <ChargeCard
                  word={currentWord}
                  containerWidth={containerW}
                  onCommit={handleCommit}
                  disabled={phase !== 'playing'}
                  reduce={reduce}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right rail — Positive — gold */}
        <div style={{
          position: 'absolute', right: -16, top: 0, bottom: 0, width: 36,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6, zIndex: 1,
        }}>
          <span style={{
            fontFamily: SANS, fontWeight: 800, fontSize: '1.2rem',
            color: 'var(--color-lx-accent-gold)',
            opacity: 0.4,
          }}>+</span>
          <span style={{
            fontFamily: SANS, fontSize: '0.52rem', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--color-lx-accent-gold)',
            opacity: 0.4,
            writingMode: 'vertical-rl',
          }}>Positive</span>
        </div>
      </div>

      {/* ── Bottom controls ────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, marginTop: '0.875rem',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Negative / Positive buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button
            whileTap={reduce ? {} : { scale: 0.97 }}
            onClick={() => handleCommit('negative')}
            disabled={phase !== 'playing'}
            style={{
              flex: 1, minHeight: 52,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'rgba(91,163,245,0.1)',
              border: '1px solid rgba(91,163,245,0.35)',
              borderRadius: 14,
              fontFamily: SANS, fontSize: '0.88rem', fontWeight: 700,
              color: 'var(--color-lx-mastery-familiar)',
              cursor: phase === 'playing' ? 'pointer' : 'not-allowed',
              opacity: phase === 'playing' ? 1 : 0.4,
            }}
            aria-label="Negative (left arrow)"
          >
            − Negative
          </motion.button>
          <motion.button
            whileTap={reduce ? {} : { scale: 0.97 }}
            onClick={() => handleCommit('positive')}
            disabled={phase !== 'playing'}
            style={{
              flex: 1, minHeight: 52,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'rgba(244,168,40,0.1)',
              border: '1px solid rgba(244,168,40,0.35)',
              borderRadius: 14,
              fontFamily: SANS, fontSize: '0.88rem', fontWeight: 700,
              color: 'var(--color-lx-accent-gold)',
              cursor: phase === 'playing' ? 'pointer' : 'not-allowed',
              opacity: phase === 'playing' ? 1 : 0.4,
            }}
            aria-label="Positive (right arrow)"
          >
            + Positive
          </motion.button>
        </div>

        {/* Help button */}
        <button
          onClick={() => { if (phase === 'playing') dispatch({ type: 'OPEN_HELP', now: performance.now() }); }}
          disabled={phase !== 'playing'}
          style={{
            width: '100%', minHeight: 44,
            background: 'none', border: 'none',
            fontFamily: SANS, fontSize: '0.78rem',
            color: phase === 'playing' ? 'var(--color-lx-text-muted)' : 'transparent',
            cursor: phase === 'playing' ? 'pointer' : 'default',
          }}
        >
          Not sure?
        </button>
      </div>

      {/* ── CSS keyframes for timer pulse and shimmer ──────────────────────── */}
      <style>{`
        @keyframes lx-timer-pulse {
          0%, 100% { opacity: 1; }
          45%       { opacity: 0.45; }
        }
        .lx-timer-pulse {
          animation: lx-timer-pulse 0.9s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </div>
  );
}
