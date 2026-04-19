'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SkipForward, RotateCcw, ArrowRight, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  num1: number; num2: number; answer: number; symbol: string; operation: string;
}
interface GameResult {
  score: number; questionsCorrect: number; questionsAnswered: number;
  accuracy: number; difficulty: string; operations: string[];
  timeLimit: number; playerName?: string; playedAt: Date;
}
interface LeaderboardEntry {
  playerName: string; score: number; questionsCorrect: number;
  questionsAnswered: number; accuracy: number; difficulty: string;
  operations?: string[]; playedAt: Date;
}
interface AccumulatedScore {
  playerName: string; totalScore: number; gamesPlayed: number;
  averageScore: number; bestScore: number; overallAccuracy: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OP_LABELS: Record<string, string> = {
  addition: 'Addition (+)', subtraction: 'Subtraction (−)',
  multiplication: 'Multiplication (×)', division: 'Division (÷)',
};
const TIME_OPTIONS = [
  { value: 0.5, label: '30 seconds' }, { value: 1, label: '1 minute' },
  { value: 1.5, label: '1.5 minutes' }, { value: 2, label: '2 minutes' },
  { value: 3, label: '3 minutes' }, { value: 5, label: '5 minutes' },
];
const RANK_LABEL = (i: number) => i === 0 ? '01' : i === 1 ? '02' : i === 2 ? '03' : String(i + 1).padStart(2, '0');

// ─── Main App ─────────────────────────────────────────────────────────────────

const MentalMathApp = () => {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished' | 'leaderboard'>('setup');
  const [selectedOps, setSelectedOps]   = useState<string[]>(['addition']);
  const [difficulty, setDifficulty]     = useState<'easy' | 'medium' | 'hard' | 'extreme'>('easy');
  const [timeLimit, setTimeLimit]       = useState(2);
  const [currentQ, setCurrentQ]         = useState<Question | null>(null);
  const [userAnswer, setUserAnswer]     = useState('');
  const [score, setScore]               = useState(0);
  const [answered, setAnswered]         = useState(0);
  const [correct, setCorrect]           = useState(0);
  const [skipped, setSkipped]           = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [prevQuestions, setPrevQuestions] = useState<Question[]>([]);
  const [leaderboard, setLeaderboard]   = useState<{ individual: LeaderboardEntry[]; accumulated: AccumulatedScore[] }>({ individual: [], accumulated: [] });
  const [isLoading, setIsLoading]       = useState(false);
  const [qStartTime, setQStartTime]     = useState<number | null>(null);
  const [qTimeRemaining, setQTimeRemaining] = useState(0);
  const [responseTimes, setResponseTimes]   = useState<number[]>([]);
  const [suspicious, setSuspicious]         = useState<boolean[]>([]);
  const [skipsLeft, setSkipsLeft]           = useState(3);
  const [timePenalty, setTimePenalty]       = useState(0);

  const getQTimeLimit = useCallback((op: string, diff: string): number => {
    const base = {
      addition:       { easy: 5,  medium: 8,  hard: 12, extreme: 18 },
      subtraction:    { easy: 6,  medium: 10, hard: 15, extreme: 20 },
      multiplication: { easy: 8,  medium: 12, hard: 20, extreme: 25 },
      division:       { easy: 10, medium: 15, hard: 25, extreme: 30 },
    };
    return (base[op as keyof typeof base]?.[diff as keyof typeof base.addition] ?? 15) + timePenalty;
  }, [timePenalty]);

  const detectCalc = (rt: number, op: string, diff: string): boolean => {
    const expected = getQTimeLimit(op, diff);
    const minHuman = Math.max(2, expected * 0.1);
    if (rt < minHuman) return true;
    if (responseTimes.length >= 3) {
      const recent = responseTimes.slice(-3);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const variance = recent.reduce((acc, t) => acc + Math.pow(t - avg, 2), 0) / recent.length;
      if (variance < 0.5 && rt < expected * 0.3) return true;
    }
    return false;
  };

  const toggleOp = (op: string) => setSelectedOps(prev =>
    prev.includes(op) ? (prev.length === 1 ? prev : prev.filter(o => o !== op)) : [...prev, op]
  );

  const genNumbers = useCallback((op: string) => {
    let n1: number, n2: number;
    switch (op) {
      case 'addition':
        if (difficulty === 'easy')    { n1 = Math.floor(Math.random()*9)+1; n2 = Math.floor(Math.random()*9)+1; }
        else if (difficulty === 'medium') { n1 = Math.floor(Math.random()*90)+10; n2 = Math.floor(Math.random()*9)+1; }
        else if (difficulty === 'hard')   { n1 = Math.floor(Math.random()*90)+10; n2 = Math.floor(Math.random()*90)+10; }
        else { n1 = Math.floor(Math.random()*150)+50; n2 = Math.floor(Math.random()*150)+50; if (n1+n2>200) n2=200-n1; }
        return { num1: n1, num2: n2, answer: n1+n2, symbol: '+', operation: op };
      case 'subtraction':
        if (difficulty === 'easy')    { n2=Math.floor(Math.random()*9)+1; n1=n2+Math.floor(Math.random()*9)+1; }
        else if (difficulty === 'medium') { n2=Math.floor(Math.random()*9)+1; n1=Math.floor(Math.random()*90)+10; }
        else if (difficulty === 'hard')   { n2=Math.floor(Math.random()*90)+10; n1=n2+Math.floor(Math.random()*90)+10; }
        else { n2=Math.floor(Math.random()*100)+50; n1=Math.floor(Math.random()*100)+100; if(n1<=n2) n1=n2+Math.floor(Math.random()*50)+10; if(n1>200) n1=200; }
        return { num1: n1, num2: n2, answer: n1-n2, symbol: '−', operation: op };
      case 'multiplication':
        if (difficulty === 'easy')    { n1=Math.floor(Math.random()*9)+1; n2=Math.floor(Math.random()*9)+1; }
        else if (difficulty === 'medium') { n1=Math.floor(Math.random()*9)+1; n2=Math.floor(Math.random()*16)+10; }
        else if (difficulty === 'hard')   { n1=Math.floor(Math.random()*16)+10; n2=Math.floor(Math.random()*16)+10; }
        else { n1=Math.floor(Math.random()*21)+10; n2=Math.floor(Math.random()*21)+10; }
        return { num1: n1, num2: n2, answer: n1*n2, symbol: '×', operation: op };
      case 'division': {
        let q: number;
        if (difficulty === 'easy')    { n2=Math.floor(Math.random()*9)+1; q=Math.floor(Math.random()*9)+1; }
        else if (difficulty === 'medium') { n2=Math.floor(Math.random()*9)+1; q=Math.floor(Math.random()*16)+10; }
        else if (difficulty === 'hard')   { n2=Math.floor(Math.random()*16)+10; q=Math.floor(Math.random()*16)+10; }
        else { n2=Math.floor(Math.random()*21)+10; q=Math.floor(Math.random()*21)+10; }
        n1 = n2 * q;
        return { num1: n1, num2: n2, answer: n1/n2, symbol: '÷', operation: op };
      }
      default: return null;
    }
  }, [difficulty]);

  const calcPoints = useCallback((isCorrect: boolean, isSkip = false, op: string, overage = 0) => {
    const base = { easy: 10, medium: 15, hard: 25, extreme: 40 };
    const diffMult = { easy: 1, medium: 1.5, hard: 2, extreme: 3 };
    const opBonus: Record<string, number> = { addition: 1, subtraction: 1.2, multiplication: 1.5, division: 1.8 };
    const multiBonus = selectedOps.length > 1 ? 1.3 : 1;
    if (isSkip) return -Math.floor(base[difficulty] * 0.3);
    if (isCorrect) {
      let pts = base[difficulty] * diffMult[difficulty] * opBonus[op] * multiBonus;
      if (overage <= 0) {
        const spent = Date.now() - (gameStartTime || Date.now());
        const avg = spent / (answered + 1);
        if (avg < 3000) pts *= 1.5; else if (avg < 5000) pts *= 1.2;
      }
      if (overage > 0) {
        const allocated = getQTimeLimit(op, difficulty);
        const rate = Math.max(0.1, 1 / Math.sqrt(allocated));
        pts *= Math.max(0.1, Math.pow(0.5, overage * rate));
      }
      return Math.floor(pts);
    }
    return -Math.floor(base[difficulty] * 0.5);
  }, [difficulty, selectedOps.length, answered, gameStartTime, getQTimeLimit]);

  const genNewQuestion = useCallback(() => {
    const isUnique = (q: Question) => !prevQuestions.some(p => p.num1===q.num1 && p.num2===q.num2 && p.operation===q.operation);
    let q: Question | null = null, attempts = 0;
    do {
      const op = selectedOps[Math.floor(Math.random() * selectedOps.length)];
      q = genNumbers(op);
      attempts++;
    } while (q && !isUnique(q) && attempts < 50);
    if (q) {
      setCurrentQ(q);
      setPrevQuestions(prev => [...prev.slice(-20), q!]);
      setQTimeRemaining(getQTimeLimit(q.operation, difficulty));
      setQStartTime(Date.now());
    }
    setUserAnswer('');
  }, [genNumbers, selectedOps, prevQuestions, difficulty, getQTimeLimit]);

  const startGame = () => {
    setGameState('playing');
    setScore(0); setAnswered(0); setCorrect(0); setSkipped(0);
    setTimeRemaining(timeLimit * 60);
    setGameStartTime(Date.now());
    setPrevQuestions([]);
    setResponseTimes([]); setSuspicious([]);
    setSkipsLeft(3); setTimePenalty(0);
    genNewQuestion();
  };

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/mental-math/leaderboard');
      const data = res.ok ? await res.json() : {};
      setLeaderboard({ individual: data.individual || [], accumulated: data.accumulated || [] });
    } catch { setLeaderboard({ individual: [], accumulated: [] }); }
    finally { setIsLoading(false); }
  }, []);

  const saveResult = useCallback(async (result: GameResult) => {
    try {
      const res = await fetch('/api/mental-math/scores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      if (res.ok) fetchLeaderboard();
    } catch { /* silent */ }
  }, [fetchLeaderboard]);

  const submitAnswer = () => {
    if (userAnswer === '' || !currentQ || !qStartTime) return;
    const rt = (Date.now() - qStartTime) / 1000;
    const isCorrect = parseInt(userAnswer) === currentQ.answer;
    const allocated = getQTimeLimit(currentQ.operation, difficulty);
    const overage = Math.max(0, allocated - qTimeRemaining);
    const isSusp = detectCalc(rt, currentQ.operation, difficulty);
    setResponseTimes(prev => [...prev, rt]);
    setSuspicious(prev => [...prev, isSusp]);
    const pts = calcPoints(isCorrect, false, currentQ.operation, overage);
    setScore(prev => prev + pts);
    setAnswered(prev => prev + 1);
    if (isCorrect) setCorrect(prev => prev + 1);
    genNewQuestion();
  };

  const skipQuestion = useCallback(() => {
    if (!currentQ || !qStartTime) return;
    const rt = (Date.now() - qStartTime) / 1000;
    setResponseTimes(prev => [...prev, rt]);
    setSuspicious(prev => [...prev, false]);
    setScore(prev => prev + calcPoints(false, true, currentQ.operation, 0));
    setAnswered(prev => prev + 1);
    setSkipped(prev => prev + 1);
    if (skipsLeft > 0) setSkipsLeft(prev => prev - 1);
    else setTimePenalty(prev => prev + 60);
    genNewQuestion();
  }, [currentQ, qStartTime, calcPoints, genNewQuestion, skipsLeft]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && userAnswer !== '') submitAnswer();
  };

  useEffect(() => {
    if (gameState === 'playing' && timeRemaining > 0) {
      const t = setTimeout(() => setTimeRemaining(p => p - 1), 1000);
      return () => clearTimeout(t);
    } else if (gameState === 'playing' && timeRemaining === 0) setGameState('finished');
  }, [gameState, timeRemaining]);

  useEffect(() => {
    if (gameState === 'playing') {
      const t = setTimeout(() => setQTimeRemaining(p => p - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [gameState, qTimeRemaining]);

  useEffect(() => {
    if (gameState === 'finished' && answered > 0) {
      const acc = Math.round((correct / answered) * 100);
      const suspCount = suspicious.filter(Boolean).length;
      saveResult({
        score, questionsCorrect: correct, questionsAnswered: answered,
        accuracy: acc, difficulty, operations: selectedOps,
        timeLimit, playedAt: new Date(),
        ...(suspCount / answered > 0.3 ? { isSuspicious: true } as any : {}),
      });
    }
  }, [gameState]); // eslint-disable-line

  const fmtTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  // ── Leaderboard ─────────────────────────────────────────────────────────────
  if (gameState === 'leaderboard') return (
    <div className="min-h-screen bg-[#1A0507] text-[#FAF5EF] relative overflow-hidden">
      <GrainOverlay />
      <CursorSpotlight />

      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 pb-28">
        <SectionMark chapter="Chapter Two" title="Champions" />

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mb-20">
          <h1 className="lg:col-span-8 font-heading text-[clamp(2.5rem,7vw,6rem)] leading-[0.92] tracking-[-0.02em] font-light">
            The leaderboard.
            <em className="block font-extralight text-[#D4B094]">who's fastest?</em>
          </h1>
          <button
            onClick={() => setGameState('setup')}
            className="lg:col-span-4 lg:justify-self-end group inline-flex items-center gap-3 rounded-full border border-[#D4B094]/40 bg-transparent text-[#D4B094] px-7 py-3.5 font-sans text-sm font-medium tracking-wide transition-all duration-500 hover:bg-[#D4B094] hover:text-[#1A0507]"
          >
            <span>Back to game</span>
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Individual scores */}
          <div className="relative rounded-2xl border border-[#D4B094]/20 bg-[#D4B094]/[0.04] p-8 sm:p-10 overflow-hidden">
            <CornerBrackets accent="#D4B094" />
            <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094] mb-6">Top individual scores</div>
            {isLoading ? (
              <p className="font-sans text-sm text-[#FAF5EF]/40">Loading…</p>
            ) : leaderboard.individual.length === 0 ? (
              <p className="font-sans text-sm text-[#FAF5EF]/40">No scores yet. Be the first to play.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.individual.slice(0, 10).map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-white/[0.06] last:border-0">
                    <div className="flex items-center gap-4">
                      <span className={`font-heading italic text-sm ${i < 3 ? 'text-[#D4B094]' : 'text-[#FAF5EF]/30'}`}>
                        {RANK_LABEL(i)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-sans text-sm text-[#FAF5EF]">{e.playerName || 'Anonymous'}</span>
                          {(e as any).isSuspicious && (
                            <span className="font-sans text-[9px] tracking-widest uppercase text-red-400 border border-red-400/40 px-1.5 py-0.5 rounded">calc</span>
                          )}
                        </div>
                        <div className="font-sans text-[11px] text-[#FAF5EF]/35 mt-0.5">
                          {e.difficulty} · {e.accuracy}% acc · {(e as any).timeLimit}min
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-heading text-xl font-light text-[#D4B094]">{e.score}</div>
                      <div className="font-sans text-[10px] text-[#FAF5EF]/30">{e.questionsCorrect}/{e.questionsAnswered}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accumulated scores */}
          <div className="relative rounded-2xl border border-[#D4B094]/20 bg-[#D4B094]/[0.04] p-8 sm:p-10 overflow-hidden">
            <CornerBrackets accent="#D4B094" />
            <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094] mb-6">Accumulated champions</div>
            {isLoading ? (
              <p className="font-sans text-sm text-[#FAF5EF]/40">Loading…</p>
            ) : leaderboard.accumulated.length === 0 ? (
              <p className="font-sans text-sm text-[#FAF5EF]/40">No accumulated scores yet.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.accumulated.slice(0, 10).map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-white/[0.06] last:border-0">
                    <div className="flex items-center gap-4">
                      <span className={`font-heading italic text-sm ${i < 3 ? 'text-[#D4B094]' : 'text-[#FAF5EF]/30'}`}>
                        {RANK_LABEL(i)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-sans text-sm text-[#FAF5EF]">{e.playerName || 'Anonymous'}</span>
                          {(e as any).hasSuspiciousGames && (
                            <span className="font-sans text-[9px] tracking-widest uppercase text-red-400 border border-red-400/40 px-1.5 py-0.5 rounded">calc</span>
                          )}
                        </div>
                        <div className="font-sans text-[11px] text-[#FAF5EF]/35 mt-0.5">
                          {e.gamesPlayed} games · avg {Math.round(e.averageScore)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-heading text-xl font-light text-[#D4B094]">{e.totalScore}</div>
                      <div className="font-sans text-[10px] text-[#FAF5EF]/30">total pts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Setup ────────────────────────────────────────────────────────────────────
  if (gameState === 'setup') return (
    <div className="min-h-screen bg-[#FAF5EF] text-[#1A0507] relative overflow-hidden">
      <LedgerOverlay />
      <WarmGlow />

      <div className="relative max-w-[900px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 pb-28 sm:pt-28">
        <SectionMark chapter="Chapter Zero" title="Mental Math" light />

        <h1 className="mt-10 font-heading text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.92] tracking-[-0.02em] font-light">
          Train your mind.
          <em className="block font-extralight text-[#760F13]">beat the clock.</em>
        </h1>

        <p className="mt-6 font-sans text-base text-[#1A0507]/60 max-w-md leading-relaxed">
          Select your operations, pick a difficulty, and go. The leaderboard tracks the sharpest minds.
        </p>

        {/* Settings card */}
        <div className="mt-12 relative rounded-2xl border border-[#D4B094]/40 bg-white/70 backdrop-blur-sm p-8 sm:p-12 overflow-hidden">
          <CornerBrackets accent="#A86E58" />
          <span aria-hidden className="absolute -top-4 -right-2 font-heading italic text-[#D4B094]/18 text-[7rem] font-extralight leading-none pointer-events-none select-none">00</span>

          <div className="relative space-y-10">
            {/* Operations */}
            <div>
              <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-4">Operations</div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(OP_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleOp(key)}
                    className={[
                      'relative text-left rounded-xl border px-5 py-4 transition-all duration-300 overflow-hidden',
                      selectedOps.includes(key)
                        ? 'bg-[#1A0507] border-[#1A0507] text-[#FAF5EF]'
                        : 'border-[#D4B094]/40 hover:border-[#A86E58]/60',
                    ].join(' ')}
                  >
                    {selectedOps.includes(key) && <CornerBrackets accent="#D4B094" />}
                    <div className={`font-sans text-sm font-medium ${selectedOps.includes(key) ? 'text-[#FAF5EF]' : 'text-[#1A0507]'}`}>{label}</div>
                    {selectedOps.includes(key) && (
                      <span className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#D4B094] flex items-center justify-center">
                        <Check size={9} className="text-[#1A0507]" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {selectedOps.length > 1 && (
                <p className="mt-3 font-sans text-xs text-[#A86E58]">Multi-operation bonus active — +30% points</p>
              )}
            </div>

            {/* Difficulty */}
            <div>
              <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-2">Difficulty</div>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as typeof difficulty)}
                className="w-full bg-transparent border-0 border-b border-[#1A0507]/20 py-3 px-0 font-heading text-xl text-[#1A0507] focus:outline-none focus:border-[#760F13] transition-colors appearance-none"
              >
                <option value="easy">Easy — Single Digits</option>
                <option value="medium">Medium — Mixed</option>
                <option value="hard">Hard — Double Digits</option>
                <option value="extreme">Extreme — Challenge Mode</option>
              </select>
              {difficulty === 'extreme' && (
                <p className="mt-2 font-sans text-xs text-[#760F13]">
                  Addition/Subtraction up to 200 · Multiplication/Division up to 30×30
                </p>
              )}
            </div>

            {/* Time limit */}
            <div>
              <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-2">Time limit</div>
              <select
                value={timeLimit}
                onChange={e => setTimeLimit(parseFloat(e.target.value))}
                className="w-full bg-transparent border-0 border-b border-[#1A0507]/20 py-3 px-0 font-heading text-xl text-[#1A0507] focus:outline-none focus:border-[#760F13] transition-colors appearance-none"
              >
                {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={startGame}
            disabled={selectedOps.length === 0}
            className="group/cta relative inline-flex items-center gap-3 rounded-full bg-[#1A0507] text-[#FAF5EF] px-9 py-4 font-sans text-sm font-medium tracking-wide transition-all duration-500 disabled:opacity-30 hover:bg-[#760F13] hover:shadow-[0_12px_40px_-12px_rgba(90,11,15,0.5)]"
          >
            <span className="relative overflow-hidden">
              <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:-translate-y-full">Start challenge</span>
              <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-y-0">Start challenge</span>
            </span>
            <ArrowRight size={16} className="transition-transform group-hover/cta:translate-x-0.5" />
          </button>

          <button
            onClick={() => { fetchLeaderboard(); setGameState('leaderboard'); }}
            className="group inline-flex items-center gap-3 font-sans text-sm text-[#A86E58] hover:text-[#1A0507] transition-colors"
          >
            <span className="w-6 h-px bg-current transition-all duration-300 group-hover:w-10" />
            View leaderboard
          </button>
        </div>
      </div>
    </div>
  );

  // ── Playing ──────────────────────────────────────────────────────────────────
  if (gameState === 'playing') return (
    <div className="min-h-screen bg-[#1A0507] text-[#FAF5EF] relative overflow-hidden flex flex-col">
      <GrainOverlay />

      {/* Top bar */}
      <div className="relative z-10 border-b border-white/[0.06] px-6 sm:px-10 py-4 flex items-center justify-between gap-4">
        {/* Game clock */}
        <div className="flex items-center gap-2">
          <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/50">Time</span>
          <span className={`font-heading text-2xl font-light tabular-nums ${timeRemaining <= 10 ? 'text-red-400' : 'text-[#FAF5EF]'}`}>
            {fmtTime(timeRemaining)}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/50">Score</span>
          <span className="font-heading text-2xl font-light text-[#D4B094]">{score}</span>
        </div>

        {/* Question timer */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors ${
          qTimeRemaining < 0 ? 'border-red-400/40 text-red-400' :
          qTimeRemaining <= 3 ? 'border-[#D4B094]/40 text-[#D4B094]' : 'border-white/10 text-[#FAF5EF]/50'
        }`}>
          <span className="font-heading text-lg tabular-nums">
            {qTimeRemaining < 0 ? `+${Math.abs(qTimeRemaining)}s` : `${qTimeRemaining}s`}
          </span>
        </div>

        {/* Skips */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#D4B094]/50">
            {skipsLeft > 0 ? `${skipsLeft} skips` : `+${timePenalty}s penalty`}
          </span>
        </div>
      </div>

      {/* Active operations */}
      <div className="relative z-10 px-6 sm:px-10 py-3 flex flex-wrap gap-2 border-b border-white/[0.04]">
        {selectedOps.map(op => (
          <span key={op} className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#D4B094]/60 border border-[#D4B094]/20 px-3 py-1 rounded-full">
            {OP_LABELS[op]}
          </span>
        ))}
      </div>

      {/* Question area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Operation + difficulty badge */}
        <div className="font-sans text-[10px] tracking-[0.35em] uppercase text-[#D4B094]/50 mb-8">
          {currentQ?.operation} · {difficulty}
        </div>

        {/* Equation */}
        {currentQ && (
          <div className="font-heading text-[clamp(3rem,14vw,9rem)] leading-none font-light tracking-[-0.02em] text-center mb-12 text-[#FAF5EF]">
            {currentQ.num1}{' '}
            <span className="text-[#D4B094]">{currentQ.symbol}</span>{' '}
            {currentQ.num2}{' '}
            <span className="text-[#FAF5EF]/30">=</span>{' '}
            <span className="text-[#D4B094]/50">?</span>
          </div>
        )}

        {/* Answer input */}
        <input
          type="number"
          value={userAnswer}
          onChange={e => setUserAnswer(e.target.value)}
          onKeyPress={handleKey}
          placeholder="—"
          autoFocus
          className="w-full max-w-xs bg-transparent border-0 border-b-2 border-[#FAF5EF]/20 pb-4 text-center font-heading text-[clamp(2rem,8vw,4rem)] font-light text-[#FAF5EF] placeholder-[#FAF5EF]/15 focus:outline-none focus:border-[#D4B094] transition-colors"
        />

        {/* Overtime warning */}
        {qTimeRemaining < 0 && (
          <p className="mt-6 font-sans text-xs text-red-400/80 text-center">
            {Math.abs(qTimeRemaining)}s over time · points reduced
          </p>
        )}
        {skipsLeft === 0 && timePenalty > 0 && (
          <p className="mt-3 font-sans text-xs text-[#D4B094]/60 text-center">
            No free skips · each skip adds +60s penalty
          </p>
        )}

        {/* Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <button
            onClick={submitAnswer}
            disabled={userAnswer === ''}
            className="flex-1 group/cta relative inline-flex items-center justify-center gap-3 rounded-full bg-[#FAF5EF] text-[#1A0507] px-8 py-4 font-sans text-sm font-medium tracking-wide transition-all duration-500 disabled:opacity-20 hover:bg-[#D4B094] hover:shadow-[0_12px_40px_-12px_rgba(212,176,148,0.4)]"
          >
            Submit
            <ArrowRight size={16} />
          </button>
          <button
            onClick={skipQuestion}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-4 font-sans text-sm tracking-wide transition-all duration-300 ${
              skipsLeft > 0
                ? 'border-[#D4B094]/30 text-[#D4B094]/60 hover:border-[#D4B094]/60 hover:text-[#D4B094]'
                : 'border-red-400/30 text-red-400/60 hover:border-red-400/60 hover:text-red-400'
            }`}
          >
            <SkipForward size={14} />
            {skipsLeft > 0 ? `Skip (${skipsLeft})` : 'Skip (+60s)'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Finished ─────────────────────────────────────────────────────────────────
  if (gameState === 'finished') return (
    <div className="min-h-screen bg-[#FAF5EF] text-[#1A0507] relative overflow-hidden">
      <LedgerOverlay />
      <WarmGlow />

      <div className="relative max-w-3xl mx-auto px-6 sm:px-10 pt-20 pb-28">
        <SectionMark chapter="Chapter End" title="Results" light />

        <h1 className="mt-10 font-heading text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.92] tracking-[-0.02em] font-light">
          Challenge{' '}
          <em className="font-extralight text-[#760F13]">complete.</em>
        </h1>

        {/* Score */}
        <div className="mt-12 relative rounded-2xl border border-[#D4B094]/40 bg-white/70 backdrop-blur-sm p-8 sm:p-12 overflow-hidden text-center">
          <CornerBrackets accent="#A86E58" />
          <span aria-hidden className="absolute -top-4 -right-2 font-heading italic text-[#D4B094]/18 text-[7rem] font-extralight leading-none pointer-events-none select-none">∑</span>
          <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] mb-4">Final score</div>
          <div className="font-heading text-[clamp(4rem,14vw,8rem)] leading-none font-light tracking-[-0.03em] text-[#1A0507]">
            {score}
          </div>
          <p className="mt-4 font-heading italic text-[#760F13]/70 text-lg font-extralight">
            {score > 0 ? 'Exceptional performance.' : 'Keep practicing to reach new heights.'}
          </p>
        </div>

        {/* Stats */}
        <div className="mt-6 border-t border-[#D4B094]/30 pt-6 space-y-3">
          {[
            { label: 'Correct',    value: String(correct) },
            { label: 'Incorrect',  value: String(answered - correct) },
            { label: 'Skipped',    value: String(skipped) },
            { label: 'Accuracy',   value: `${accuracy}%` },
            { label: 'Operations', value: selectedOps.map(o => OP_LABELS[o]).join(' · ') },
            { label: 'Difficulty', value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1) },
            { label: 'Duration',   value: TIME_OPTIONS.find(t => t.value === timeLimit)?.label ?? '' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-4">
              <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#A86E58] w-28 shrink-0">{label}</span>
              <span className="font-heading text-lg font-light text-[#1A0507]">{value}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={startGame}
            className="group/cta relative inline-flex items-center gap-3 rounded-full bg-[#1A0507] text-[#FAF5EF] px-9 py-4 font-sans text-sm font-medium tracking-wide transition-all duration-500 hover:bg-[#760F13] hover:shadow-[0_12px_40px_-12px_rgba(90,11,15,0.5)]"
          >
            <RotateCcw size={15} />
            <span className="relative overflow-hidden">
              <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:-translate-y-full">Play again</span>
              <span className="absolute inset-0 translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/cta:translate-y-0">Play again</span>
            </span>
          </button>
          <button
            onClick={() => { fetchLeaderboard(); setGameState('leaderboard'); }}
            className="group inline-flex items-center gap-3 font-sans text-sm text-[#A86E58] hover:text-[#1A0507] transition-colors"
          >
            <span className="w-6 h-px bg-current transition-all duration-300 group-hover:w-10" />
            View leaderboard
          </button>
        </div>
      </div>
    </div>
  );

  return null;
};

// ─── Shared primitives ────────────────────────────────────────────────────────

function GrainOverlay() {
  return (
    <div
      className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
      style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.9'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")" }}
    />
  );
}

function LedgerOverlay() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, #1A0507 39px, #1A0507 40px)' }} />
    </>
  );
}

function WarmGlow() {
  return (
    <div aria-hidden className="absolute inset-0 opacity-60 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(212,176,148,0.22), transparent 60%)' }} />
  );
}

function CursorSpotlight() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ background: 'radial-gradient(600px circle at 30% 40%, rgba(212,176,148,0.07), transparent 50%)' }}
    />
  );
}

function SectionMark({ chapter, title, light }: { chapter: string; title: string; light?: boolean }) {
  return (
    <div className={`font-sans text-[11px] tracking-[0.3em] uppercase flex items-center gap-3 ${light ? 'text-[#A86E58]' : 'text-[#D4B094]/60'}`}>
      <span className={`w-8 h-px ${light ? 'bg-[#A86E58]' : 'bg-[#D4B094]/60'}`} />
      {chapter} / {title}
    </div>
  );
}

function CornerBrackets({ accent }: { accent: string }) {
  return (
    <>
      <span className="absolute top-5 left-5 w-4 h-px" style={{ backgroundColor: `${accent}80` }} />
      <span className="absolute top-5 left-5 w-px h-4" style={{ backgroundColor: `${accent}80` }} />
      <span className="absolute bottom-5 right-5 w-4 h-px" style={{ backgroundColor: `${accent}80` }} />
      <span className="absolute bottom-5 right-5 w-px h-4 -translate-y-4" style={{ backgroundColor: `${accent}80` }} />
    </>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

const MentalMathPage = () => <MentalMathApp />;

export default MentalMathPage;
