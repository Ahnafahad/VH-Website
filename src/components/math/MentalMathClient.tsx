'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import type { MathOperation } from '@/lib/db/schema';
import { detectSuspicious } from '@/lib/math/fraud';
import { generateQuestion, pickNextOperation, type Question } from '@/lib/math/problem-gen';
import { calculatePoints, questionTimeLimit } from '@/lib/math/scoring';
import {
  ADAPTIVE_INITIAL_SKILL, OP_LABELS, SKIPS_FREE, SKIP_PENALTY_SECONDS,
  bucketDifficulty,
} from '@/lib/math/constants';
import { useMathFeedback } from '@/lib/math/use-math-feedback';
import { applyAttempt, chooseNextQuestion, skillLevelCrossings } from '@/lib/math/adaptive/engine';
import { createInitialState, type AdaptiveState, type AttemptSignal } from '@/lib/math/adaptive/state';
import { SetupScreen } from './SetupScreen';
import { PlayingScreen } from './PlayingScreen';
import { ResultsScreen } from './ResultsScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { DashboardScreen } from './DashboardScreen';
import { SettingsScreen } from './SettingsScreen';
import { MathBottomNav, type MathNavTab } from './MathBottomNav';
import { MathShell } from './MathShell';
import { trackFeature } from '@/lib/analytics/tracker';
import type { Tier } from '@/lib/math/constants';
import type { DashboardPayload } from './dashboard-types';
import type { GameMode, GameResult, LeaderboardData, LegacyTier } from './types';

type GameState = 'setup' | 'playing' | 'finished' | 'leaderboard' | 'dashboard' | 'settings';
type FeedbackFlash = 'correct' | 'incorrect' | null;
type LevelUp = { operation: MathOperation; from: number; to: number };

const TIER_TO_DIFF: Record<LegacyTier, number> = {
  easy: 1.0, medium: 2.0, hard: 3.0, extreme: 4.5,
};

const TIER_LABEL: Record<number, string> = {
  1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Extreme', 5: 'Extreme',
};

export function MentalMathClient() {
  const [gameState, setGameState] = useState<GameState>('setup');
  const [selectedOps, setSelectedOps] = useState<MathOperation[]>(['addition']);
  const [difficulty, setDifficulty]   = useState<GameMode>('easy');
  const [timeLimit, setTimeLimit]     = useState(2);

  const [currentQ, setCurrentQ]             = useState<Question | null>(null);
  const [userAnswer, setUserAnswer]         = useState('');
  const [score, setScore]                   = useState(0);
  const [answered, setAnswered]             = useState(0);
  const [correct, setCorrect]               = useState(0);
  const [skipped, setSkipped]               = useState(0);
  const [timeRemaining, setTimeRemaining]   = useState(0);
  const [gameStartTime, setGameStartTime]   = useState<number | null>(null);
  const [prevQuestions, setPrevQuestions]   = useState<Question[]>([]);
  const [qStartTime, setQStartTime]         = useState<number | null>(null);
  const [qTimeRemaining, setQTimeRemaining] = useState(0);
  const [allocatedMs, setAllocatedMs]       = useState(0);
  const [responseTimes, setResponseTimes]   = useState<number[]>([]);
  const [suspicious, setSuspicious]         = useState<boolean[]>([]);
  const [skipsLeft, setSkipsLeft]           = useState(SKIPS_FREE);
  const [timePenalty, setTimePenalty]       = useState(0);
  const [feedbackFlash, setFeedbackFlash]   = useState<FeedbackFlash>(null);
  const [levelUpFlash, setLevelUpFlash]     = useState<LevelUp | null>(null);

  const [sessionId, setSessionId]             = useState<number | null>(null);
  const [adaptiveState, setAdaptiveState]     = useState<AdaptiveState>(() => createInitialState());

  const [leaderboard, setLeaderboard] = useState<LeaderboardData>({ individual: [], accumulated: [] });
  const [isLoading, setIsLoading]     = useState(false);

  const [dashboard, setDashboard]           = useState<DashboardPayload | null>(null);
  const [dashboardLoading, setDashLoading]  = useState(false);
  const dashboardLoadedRef                  = useRef(false);

  const feedback = useMathFeedback();

  // Track whether we've already posted the finish call for this session (prevents double-fire)
  const finishedRef = useRef(false);

  const adaptive   = difficulty === 'auto';
  const legacyTier: LegacyTier = adaptive ? 'medium' : difficulty;
  const fixedDiff  = adaptive ? ADAPTIVE_INITIAL_SKILL : TIER_TO_DIFF[legacyTier];

  const toggleOp = useCallback((op: MathOperation) => {
    setSelectedOps((prev) =>
      prev.includes(op) ? (prev.length === 1 ? prev : prev.filter((o) => o !== op)) : [...prev, op],
    );
  }, []);

  const flashFeedback = useCallback((flash: FeedbackFlash) => {
    setFeedbackFlash(flash);
    if (flash !== null) setTimeout(() => setFeedbackFlash(null), 420);
  }, []);

  const flashLevelUp = useCallback((lu: LevelUp) => {
    setLevelUpFlash(lu);
    setTimeout(() => setLevelUpFlash(null), 1400);
  }, []);

  // Persist sound/haptics preference on toggle (fire-and-forget).
  const persistSettings = useCallback((body: { soundEnabled?: boolean; hapticsEnabled?: boolean }) => {
    void fetch('/api/math/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => { /* silent */ });
  }, []);

  const handleToggleSound = useCallback((v: boolean) => {
    trackFeature('settings_change', 'math');
    feedback.setSoundEnabled(v);
    persistSettings({ soundEnabled: v });
  }, [feedback, persistSettings]);

  const handleToggleHaptics = useCallback((v: boolean) => {
    trackFeature('settings_change', 'math');
    feedback.setHapticsEnabled(v);
    persistSettings({ hapticsEnabled: v });
  }, [feedback, persistSettings]);

  // Compute next (operation, difficulty) and allocated time for a question.
  const nextQuestionPlan = useCallback(
    (state: AdaptiveState, prev: Question[], penalty: number): { question: Question; allocatedSec: number } => {
      let op: MathOperation;
      let diff: number;
      if (adaptive) {
        const plan = chooseNextQuestion(state, selectedOps);
        op = plan.operation;
        diff = plan.difficulty;
      } else {
        op = pickNextOperation(selectedOps);
        diff = fixedDiff;
      }
      const question = generateQuestion(op, diff, prev);
      const allocatedSec = questionTimeLimit(op, diff, penalty);
      return { question, allocatedSec };
    },
    [adaptive, selectedOps, fixedDiff],
  );

  const genNewQuestion = useCallback(() => {
    const { question: q, allocatedSec } = nextQuestionPlan(adaptiveState, prevQuestions, timePenalty);
    setCurrentQ(q);
    setPrevQuestions((prev) => [...prev.slice(-20), q]);
    setQTimeRemaining(allocatedSec);
    setAllocatedMs(allocatedSec * 1000);
    setQStartTime(Date.now());
    setUserAnswer('');
  }, [adaptiveState, prevQuestions, timePenalty, nextQuestionPlan]);

  const startGame = useCallback(async () => {
    feedback.unlock(); // user gesture — unlock WebAudio context
    finishedRef.current = false;
    trackFeature('game_start', 'math', { operations: selectedOps, difficulty });
    setGameState('playing');
    setScore(0); setAnswered(0); setCorrect(0); setSkipped(0);
    setTimeRemaining(timeLimit * 60);
    setGameStartTime(Date.now());
    setPrevQuestions([]);
    setResponseTimes([]); setSuspicious([]);
    setSkipsLeft(SKIPS_FREE); setTimePenalty(0);
    setFeedbackFlash(null);
    setLevelUpFlash(null);
    setSessionId(null);

    const initial = createInitialState();
    setAdaptiveState(initial);

    // Generate first question locally for snappy UX.
    const { question: firstQ, allocatedSec } = nextQuestionPlan(initial, [], 0);
    setCurrentQ(firstQ);
    setPrevQuestions([firstQ]);
    setQTimeRemaining(allocatedSec);
    setAllocatedMs(allocatedSec * 1000);
    setQStartTime(Date.now());
    setUserAnswer('');

    // Open the session on the server. We don't block on this — answers are fire-and-forget.
    try {
      const res = await fetch('/api/math/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations: selectedOps,
          difficulty: adaptive ? ADAPTIVE_INITIAL_SKILL : legacyTier,
          timeLimit,
          adaptive,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.sessionId === 'number') setSessionId(data.sessionId);
      }
    } catch { /* silent — play continues locally */ }
  }, [feedback, timeLimit, selectedOps, adaptive, legacyTier, nextQuestionPlan]);

  const fetchDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const res = await fetch('/api/math/dashboard');
      const data = res.ok ? (await res.json()) as DashboardPayload : null;
      setDashboard(data);
      dashboardLoadedRef.current = true;
    } catch {
      setDashboard(null);
    } finally {
      setDashLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mental-math/leaderboard');
      const data = res.ok ? await res.json() : {};
      setLeaderboard({ individual: data.individual || [], accumulated: data.accumulated || [] });
    } catch {
      setLeaderboard({ individual: [], accumulated: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fire-and-forget attempt log to server. Returns the server's level-up crossings if it responded.
  const logAttempt = useCallback(async (payload: {
    sessionId: number;
    operation: MathOperation;
    difficulty: number;
    num1: number;
    num2: number;
    correctAnswer: number;
    userAnswer: number | null;
    wasSkipped: boolean;
    wasSuspicious: boolean;
    responseTimeMs: number;
    pointsEarned: number;
    allocatedMs: number;
  }) => {
    try {
      await fetch('/api/math/session/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          selectedOps,
          timePenaltySeconds: timePenalty,
        }),
      });
    } catch { /* silent */ }
  }, [selectedOps, timePenalty]);

  const submitAnswer = useCallback(() => {
    if (userAnswer === '' || userAnswer === '-' || !currentQ || !qStartTime) return;
    const rtMs = Date.now() - qStartTime;
    const rtSec = rtMs / 1000;
    const parsed = parseInt(userAnswer, 10);
    const isCorrect = parsed === currentQ.answer;
    const allocated = questionTimeLimit(currentQ.operation, currentQ.difficulty, timePenalty);
    const overage = Math.max(0, allocated - qTimeRemaining);
    const isSusp = detectSuspicious({
      responseTimeSec: rtSec,
      allocatedSeconds: allocated,
      recentTimesSec: responseTimes,
    });

    const spent = Date.now() - (gameStartTime || Date.now());
    const avgMs = spent / (answered + 1);
    const pts = calculatePoints({
      isCorrect,
      isSkip: false,
      operation: currentQ.operation,
      difficulty: currentQ.difficulty,
      overageSeconds: overage,
      multiOp: selectedOps.length > 1,
      avgResponseMs: avgMs,
    });

    setResponseTimes((prev) => [...prev, rtSec]);
    setSuspicious((prev) => [...prev, isSusp]);
    setScore((prev) => prev + pts);
    setAnswered((prev) => prev + 1);
    if (isCorrect) setCorrect((prev) => prev + 1);

    feedback.play(isCorrect ? 'correct' : 'incorrect');
    flashFeedback(isCorrect ? 'correct' : 'incorrect');

    // Apply adaptive update locally, emit level-up toast if thresholds crossed.
    const signal: AttemptSignal = {
      operation: currentQ.operation,
      difficulty: currentQ.difficulty,
      isCorrect,
      wasSkipped: false,
      wasSuspicious: isSusp,
      responseTimeMs: rtMs,
    };
    const next = applyAttempt(adaptiveState, signal, { expectedTimeMs: allocatedMs });
    const crossings = skillLevelCrossings(adaptiveState, next);
    setAdaptiveState(next);
    if (crossings.length > 0 && adaptive) {
      feedback.play('levelUp');
      flashLevelUp(crossings[0]);
    }

    // Server log (fire-and-forget).
    if (sessionId !== null) {
      void logAttempt({
        sessionId,
        operation: currentQ.operation,
        difficulty: currentQ.difficulty,
        num1: currentQ.num1,
        num2: currentQ.num2,
        correctAnswer: currentQ.answer,
        userAnswer: parsed,
        wasSkipped: false,
        wasSuspicious: isSusp,
        responseTimeMs: rtMs,
        pointsEarned: pts,
        allocatedMs,
      });
    }

    genNewQuestion();
  }, [
    userAnswer, currentQ, qStartTime, qTimeRemaining, timePenalty, responseTimes,
    gameStartTime, answered, selectedOps.length, genNewQuestion, feedback, flashFeedback,
    adaptiveState, allocatedMs, adaptive, flashLevelUp, sessionId, logAttempt,
  ]);

  const skipQuestion = useCallback(() => {
    if (!currentQ || !qStartTime) return;
    const rtMs = Date.now() - qStartTime;
    const rtSec = rtMs / 1000;
    const pts = calculatePoints({
      isCorrect: false,
      isSkip: true,
      operation: currentQ.operation,
      difficulty: currentQ.difficulty,
      overageSeconds: 0,
      multiOp: selectedOps.length > 1,
      avgResponseMs: 0,
    });
    setResponseTimes((prev) => [...prev, rtSec]);
    setSuspicious((prev) => [...prev, false]);
    setScore((prev) => prev + pts);
    setAnswered((prev) => prev + 1);
    setSkipped((prev) => prev + 1);
    if (skipsLeft > 0) setSkipsLeft((prev) => prev - 1);
    else setTimePenalty((prev) => prev + SKIP_PENALTY_SECONDS);
    feedback.play('back');

    const signal: AttemptSignal = {
      operation: currentQ.operation,
      difficulty: currentQ.difficulty,
      isCorrect: false,
      wasSkipped: true,
      wasSuspicious: false,
      responseTimeMs: rtMs,
    };
    const next = applyAttempt(adaptiveState, signal, { expectedTimeMs: allocatedMs });
    setAdaptiveState(next);

    if (sessionId !== null) {
      void logAttempt({
        sessionId,
        operation: currentQ.operation,
        difficulty: currentQ.difficulty,
        num1: currentQ.num1,
        num2: currentQ.num2,
        correctAnswer: currentQ.answer,
        userAnswer: null,
        wasSkipped: true,
        wasSuspicious: false,
        responseTimeMs: rtMs,
        pointsEarned: pts,
        allocatedMs,
      });
    }

    genNewQuestion();
  }, [
    currentQ, qStartTime, selectedOps.length, skipsLeft, genNewQuestion, feedback,
    adaptiveState, allocatedMs, sessionId, logAttempt,
  ]);

  useEffect(() => {
    if (gameState === 'playing' && timeRemaining > 0) {
      const t = setTimeout(() => setTimeRemaining((p) => p - 1), 1000);
      return () => clearTimeout(t);
    } else if (gameState === 'playing' && timeRemaining === 0) {
      feedback.play('timeout');
      setGameState('finished');
    }
  }, [gameState, timeRemaining, feedback]);

  useEffect(() => {
    if (gameState === 'playing') {
      const t = setTimeout(() => setQTimeRemaining((p) => p - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [gameState, qTimeRemaining]);

  // On game finish: call session/finish, then refresh leaderboard.
  useEffect(() => {
    if (gameState !== 'finished' || finishedRef.current) return;
    finishedRef.current = true;

    const finalize = async () => {
      trackFeature('game_complete', 'math', { score });
      // If we have a server session, ask it to finalize (it dual-writes legacy mathScores).
      if (sessionId !== null) {
        try {
          await fetch('/api/math/session/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
        } catch { /* silent */ }
      } else if (answered > 0) {
        // Fallback: legacy direct-write if the session never opened.
        const acc = Math.round((correct / answered) * 100);
        const suspCount = suspicious.filter(Boolean).length;
        const result: GameResult = {
          score,
          questionsCorrect:  correct,
          questionsAnswered: answered,
          accuracy:          acc,
          difficulty:        legacyTier,
          operations:        selectedOps,
          timeLimit,
          playedAt:          new Date(),
          ...(suspCount / answered > 0.3 ? { isSuspicious: true } : {}),
        };
        try {
          await fetch('/api/mental-math/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result),
          });
        } catch { /* silent */ }
      }
      void fetchLeaderboard();
      dashboardLoadedRef.current = false;  // force refresh next time dashboard is opened
    };

    void finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  const tone: 'deep' | 'brass' | 'violet' =
    gameState === 'playing' ? 'deep'
    : gameState === 'finished' ? 'brass'
    : gameState === 'leaderboard' ? 'violet'
    : gameState === 'dashboard' ? 'brass'
    : 'deep';

  const tierToMode = (t: Tier): GameMode => (t === 'easy' || t === 'medium' || t === 'hard' || t === 'extreme') ? t : 'easy';

  const startDrill = useCallback((op: MathOperation, tier: Tier) => {
    setSelectedOps([op]);
    setDifficulty(tierToMode(tier));
    setGameState('setup');
  }, []);

  const handleNavChange = useCallback((tab: MathNavTab) => {
    if (tab === 'play') { setGameState('setup'); return; }
    if (tab === 'leaderboard') { void fetchLeaderboard(); setGameState('leaderboard'); return; }
    if (tab === 'dashboard') {
      if (!dashboardLoadedRef.current) void fetchDashboard();
      setGameState('dashboard');
      return;
    }
    if (tab === 'settings') { setGameState('settings'); return; }
  }, [fetchLeaderboard, fetchDashboard]);

  const activeTab: MathNavTab =
    gameState === 'dashboard'   ? 'dashboard'
    : gameState === 'leaderboard' ? 'leaderboard'
    : gameState === 'settings'  ? 'settings'
    : 'play';

  const showBottomNav =
    gameState === 'setup' || gameState === 'finished'
    || gameState === 'leaderboard' || gameState === 'dashboard' || gameState === 'settings';

  return (
    <MathShell tone={tone}>
      {gameState === 'leaderboard' && (
        <LeaderboardScreen
          data={leaderboard}
          isLoading={isLoading}
          onBack={() => setGameState('setup')}
        />
      )}

      {gameState === 'setup' && (
        <SetupScreen
          selectedOps={selectedOps}
          difficulty={difficulty}
          timeLimit={timeLimit}
          onToggleOp={toggleOp}
          onDifficulty={setDifficulty}
          onTimeLimit={setTimeLimit}
          onStart={() => { void startGame(); }}
          onLeaderboard={() => { void fetchLeaderboard(); setGameState('leaderboard'); }}
        />
      )}

      {gameState === 'playing' && (
        <>
          <PlayingScreen
            currentQ={currentQ}
            userAnswer={userAnswer}
            setUserAnswer={setUserAnswer}
            onSubmit={submitAnswer}
            onSkip={skipQuestion}
            timeRemaining={timeRemaining}
            score={score}
            qTimeRemaining={qTimeRemaining}
            skipsLeft={skipsLeft}
            timePenalty={timePenalty}
            selectedOps={selectedOps}
            difficulty={difficulty}
            soundEnabled={feedback.soundEnabled}
            hapticsEnabled={feedback.hapticsEnabled}
            onToggleSound={handleToggleSound}
            onToggleHaptics={handleToggleHaptics}
            onFeedback={feedback.play}
            feedbackFlash={feedbackFlash}
          />
          <LevelUpToast flash={levelUpFlash} />
        </>
      )}

      {gameState === 'finished' && (
        <ResultsScreen
          score={score}
          correct={correct}
          answered={answered}
          skipped={skipped}
          accuracy={accuracy}
          selectedOps={selectedOps}
          difficulty={difficulty}
          timeLimit={timeLimit}
          onReplay={() => { void startGame(); }}
          onLeaderboard={() => { void fetchLeaderboard(); setGameState('leaderboard'); }}
        />
      )}

      {gameState === 'dashboard' && (
        <DashboardScreen
          data={dashboard}
          isLoading={dashboardLoading}
          onStartDrill={startDrill}
          onPlay={() => setGameState('setup')}
        />
      )}

      {gameState === 'settings' && (
        <SettingsScreen
          soundEnabled={feedback.soundEnabled}
          hapticsEnabled={feedback.hapticsEnabled}
          onToggleSound={handleToggleSound}
          onToggleHaptics={handleToggleHaptics}
        />
      )}

      {showBottomNav && (
        <MathBottomNav active={activeTab} onChange={handleNavChange} />
      )}
    </MathShell>
  );
}

// ── Level-up toast ──────────────────────────────────────────────────────────
function LevelUpToast({ flash }: { flash: LevelUp | null }) {
  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 24 }}
          className="fixed top-6 left-1/2 z-50 -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <div className="relative inline-flex items-center gap-3 rounded-full border border-[var(--color-math-accent-gold)]/60 bg-[var(--color-math-elevated)]/95 backdrop-blur-sm px-5 py-2.5 math-glow-gold">
            <Sparkles size={14} className="text-[var(--color-math-accent-gold)]" />
            <span className="font-sans text-[11px] tracking-[0.24em] uppercase text-[var(--color-math-ink-muted)]">
              Level Up
            </span>
            <span className="font-heading text-sm font-light text-[var(--color-math-ink)]">
              {OP_LABELS[flash.operation].split(' ')[0]} → {TIER_LABEL[flash.to] ?? bucketDifficulty(flash.to)}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
