'use client';

import React from 'react';
import { SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OP_LABELS } from '@/lib/math/constants';
import type { MathOperation } from '@/lib/db/schema';
import type { GameMode, Question } from './types';
import { Keypad } from './Keypad';
import { FeedbackToggles } from './FeedbackToggles';
import type { FeedbackEvent } from '@/lib/math/use-math-feedback';

export interface PlayingScreenProps {
  currentQ:          Question | null;
  userAnswer:        string;
  setUserAnswer:     (v: string) => void;
  onSubmit:          () => void;
  onSkip:            () => void;
  timeRemaining:     number;
  score:             number;
  qTimeRemaining:    number;
  skipsLeft:         number;
  timePenalty:       number;
  selectedOps:       MathOperation[];
  difficulty:        GameMode;
  soundEnabled:      boolean;
  hapticsEnabled:    boolean;
  onToggleSound:     (v: boolean) => void;
  onToggleHaptics:   (v: boolean) => void;
  onFeedback:        (event: FeedbackEvent) => void;
  feedbackFlash:     'correct' | 'incorrect' | null;
}

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function PlayingScreen(props: PlayingScreenProps) {
  const {
    currentQ, userAnswer, setUserAnswer, onSubmit, onSkip,
    timeRemaining, score, qTimeRemaining, skipsLeft, timePenalty,
    selectedOps, difficulty,
    soundEnabled, hapticsEnabled, onToggleSound, onToggleHaptics,
    onFeedback, feedbackFlash,
  } = props;

  const overTime     = qTimeRemaining < 0;
  const criticalGame = timeRemaining <= 10;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Top HUD */}
      <div className="relative z-10 border-b border-[var(--color-math-border)] px-6 sm:px-10 py-4 flex flex-wrap items-center justify-between gap-4">
        <div
          className="flex items-center gap-3"
          role="timer"
          aria-label={`Session time remaining: ${fmtTime(timeRemaining)}`}
        >
          <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-ink-faint)]">Time</span>
          <span
            className={`math-digit text-2xl font-light ${
              criticalGame ? 'text-[var(--color-math-danger)]' : 'text-[var(--color-math-ink)]'
            }`}
          >
            {fmtTime(timeRemaining)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-ink-faint)]">Score</span>
          <motion.span
            key={score}
            initial={{ y: -8, opacity: 0.4 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className="math-digit text-2xl font-light text-[var(--color-math-accent-gold)]"
          >
            {score}
          </motion.span>
        </div>

        <div
          role="timer"
          aria-label={
            overTime
              ? `Question over time by ${Math.abs(qTimeRemaining)} seconds`
              : `Question time remaining: ${qTimeRemaining} seconds`
          }
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 transition-colors duration-300 ${
            overTime
              ? 'border-[var(--color-math-danger)]/50 text-[var(--color-math-danger)]'
              : qTimeRemaining <= 3
                ? 'border-[var(--color-math-accent-gold)]/60 text-[var(--color-math-accent-gold)] math-anim-pulse-gold'
                : 'border-[var(--color-math-border)] text-[var(--color-math-ink-muted)]'
          }`}
        >
          <span className="math-digit text-lg">
            {overTime ? `+${Math.abs(qTimeRemaining)}s` : `${qTimeRemaining}s`}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-ink-faint)]">
            {skipsLeft > 0 ? `${skipsLeft} skips` : `+${timePenalty}s penalty`}
          </span>
          <FeedbackToggles
            sound={soundEnabled}
            haptics={hapticsEnabled}
            onToggleSound={onToggleSound}
            onToggleHaptics={onToggleHaptics}
            compact
          />
        </div>
      </div>

      {/* Operation chips */}
      <div className="relative z-10 flex flex-wrap gap-2 border-b border-[var(--color-math-border)]/50 px-6 sm:px-10 py-3">
        {selectedOps.map((op) => (
          <span
            key={op}
            className="rounded-full border border-[var(--color-math-accent-gold)]/25 px-3 py-1 font-sans text-[10px] tracking-[0.2em] uppercase text-[var(--color-math-accent-gold)]/70"
          >
            {OP_LABELS[op]}
          </span>
        ))}
      </div>

      {/* SR-only assertive feedback — announces correct/incorrect/over-time */}
      <div className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {feedbackFlash === 'correct' && 'Correct.'}
        {feedbackFlash === 'incorrect' && 'Incorrect.'}
        {overTime && 'Question past time. Points reduced.'}
      </div>

      {/* Equation + answer + keypad */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-8 sm:py-12 gap-8">
        <div className="font-sans text-[10px] tracking-[0.35em] uppercase text-[var(--color-math-ink-faint)]">
          {currentQ?.operation} · {difficulty}
        </div>

        <div className="relative">
          <AnimatePresence mode="wait">
            {currentQ && (
              <motion.div
                key={`${currentQ.num1}-${currentQ.symbol}-${currentQ.num2}`}
                initial={{ y: 14, opacity: 0, filter: 'blur(6px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: -10, opacity: 0, filter: 'blur(6px)' }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                role="math"
                aria-label={`${currentQ.num1} ${currentQ.operation} ${currentQ.num2} equals what`}
                className={[
                  'math-digit text-center font-light leading-none tracking-[-0.02em] text-[clamp(2.5rem,12vw,8rem)] text-[var(--color-math-ink)]',
                  feedbackFlash === 'correct'   ? 'math-anim-pulse-gold text-[var(--color-math-accent-gold)]' : '',
                  feedbackFlash === 'incorrect' ? 'math-anim-shake text-[var(--color-math-danger)]' : '',
                ].join(' ')}
              >
                {currentQ.num1}
                <span className="mx-3 sm:mx-5 font-normal text-[var(--color-math-accent-gold)]">{currentQ.symbol}</span>
                {currentQ.num2}
                <span className="mx-3 sm:mx-5 text-[var(--color-math-ink-faint)]">=</span>
                <span className="text-[var(--color-math-accent-gold)]/40">?</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Answer display — editable on desktop via keyboard mirror, read-only visual on touch */}
        <div
          className={[
            'math-digit relative min-h-[4.5rem] w-full max-w-xs border-b-2 pb-3 text-center font-light text-[clamp(2rem,7vw,3.5rem)] transition-colors',
            userAnswer ? 'border-[var(--color-math-accent-gold)] text-[var(--color-math-ink)]' : 'border-[var(--color-math-border)] text-[var(--color-math-ink-faint)]',
          ].join(' ')}
          role="status"
          aria-live="polite"
          aria-label={userAnswer ? `Current answer: ${userAnswer}` : 'No answer entered'}
        >
          {userAnswer || '—'}
        </div>

        <div role="status" aria-live="polite" className="min-h-[1.5rem] text-center">
          {overTime && (
            <p className="font-sans text-xs text-[var(--color-math-danger)]">
              {Math.abs(qTimeRemaining)}s over time · points reduced
            </p>
          )}
          {skipsLeft === 0 && timePenalty > 0 && !overTime && (
            <p className="font-sans text-xs text-[var(--color-math-ink-muted)]">
              No free skips · each skip adds +60s penalty
            </p>
          )}
        </div>

        <Keypad
          value={userAnswer}
          onChange={setUserAnswer}
          onSubmit={onSubmit}
          onFeedback={onFeedback}
        />

        <div className="flex w-full max-w-[360px] items-center justify-center">
          <motion.button
            type="button"
            onClick={onSkip}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className={[
              'inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 font-sans text-xs tracking-[0.2em] uppercase transition-colors duration-300',
              skipsLeft > 0
                ? 'border-[var(--color-math-accent-gold)]/30 text-[var(--color-math-accent-gold)]/70 hover:border-[var(--color-math-accent-gold)]/60 hover:text-[var(--color-math-accent-gold)]'
                : 'border-[var(--color-math-danger)]/40 text-[var(--color-math-danger)]/70 hover:border-[var(--color-math-danger)]/70 hover:text-[var(--color-math-danger)]',
            ].join(' ')}
          >
            <SkipForward size={12} />
            {skipsLeft > 0 ? `Skip · ${skipsLeft} left` : 'Skip · +60s'}
          </motion.button>
        </div>

        <div className="sm:hidden">
          <FeedbackToggles
            sound={soundEnabled}
            haptics={hapticsEnabled}
            onToggleSound={onToggleSound}
            onToggleHaptics={onToggleHaptics}
          />
        </div>
      </div>
    </div>
  );
}
