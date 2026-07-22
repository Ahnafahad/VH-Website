'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { QuizConfig } from '@/components/vocab/QuizConfigSheet';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { useSafeNavigate } from '@/hooks/useSafeNavigate';
import {
  MoveRight,
  Gem, RefreshCcwDot, ChevronDown, Share2,
} from 'lucide-react';
import { useBadgeQueue } from '@/lib/vocab/badges/queue';
import { consumePrefetch } from '@/lib/vocab/quiz-prefetch';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import Celebration from '@/components/vocab/Celebration';
import AnimatedNumber from '@/components/vocab/AnimatedNumber';
import { trackFeature } from '@/lib/analytics/tracker';
import { RETENTION_EVENTS, trackRetention } from '@/lib/vocab/retention-events';
import { shareLexiCore } from '@/lib/vocab/native-share';
import { LexiArtwork, LexiIcon } from '@/components/vocab/LexiAsset';

// ─── Inline SVG micro-icons (no generic defaults) ────────────────────────────
function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  );
}
function IconConfirm() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5h10M9 4l4.5 4.5L9 13" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type QuizPhase    = 'generating' | 'error' | 'quiz' | 'summary';
type AnswerPhase  = 'idle' | 'selected' | 'revealed';

interface QuizOption {
  letter:  'A' | 'B' | 'C' | 'D' | 'E';
  wordId:  number;
  word:    string;
}

type QuizQuestionType =
  | 'fill_blank' | 'analogy' | 'correct_usage'
  | 'synonym' | 'antonym'
  | 'type_word' | 'type_cloze';

interface QuizQuestion {
  id:            string;
  type:          QuizQuestionType;
  questionText:  string;
  options:       QuizOption[];
  /** 'choice' (MCQ, default) or 'typed' (student types the answer). */
  inputMode?:    'choice' | 'typed';
  /** 'word' (options are pool words) or 'string' (syn/ant — answer by letter). */
  optionKind?:   'word' | 'string';
  /** Typed questions only. */
  typedHint?:    { firstLetter: string; length: number };
  // Withheld by the server for typed questions (revealed by the answer API):
  correctLetter?: string;
  correctWordId?: number;
  explanation?:   string;
}

interface AnswerResult {
  isCorrect:      boolean;
  correctLetter:  string;
  correctWordId:  number;
  explanation:    string;
  /** Typed questions only — the expected word, revealed after answering. */
  correctWord?:   string;
  pointsEarned:   number;
  masteryDelta:   number;
  newMasteryLevel: string;
}

interface SummaryQuestion extends QuizQuestion {
  userAnswer?: {
    selectedWordId: number | null;
    selectedWord:   string | null;
    isCorrect:      boolean;
    pointsEarned:   number;
  } | null;
}

interface EarnedBadge {
  id:          string;
  name:        string;
  description: string;
  category:    'short_term' | 'mid_term' | 'long_term' | 'ultimate';
}

interface SummaryData {
  sessionId:      number;
  sessionType:    string;
  correctAnswers: number;
  totalQuestions: number;
  scorePct:       number;
  passed:         boolean;
  passThreshold:  number;
  bonusPoints:    number;
  questions:      SummaryQuestion[];
  earnedBadges?:  EarnedBadge[];
}

// ─── Hint word type (from the user's chosen set) ─────────────────────────────

interface HintWord { word: string; pos: string | null; definition: string; }

// ─── CSS tokens ───────────────────────────────────────────────────────────────
const C = {
  base:       'var(--color-lx-base)',
  surface:    'var(--color-lx-surface)',
  elevated:   'var(--color-lx-elevated)',
  border:     'var(--color-lx-border)',
  red:        'var(--color-lx-accent-red)',
  gold:       'var(--color-lx-accent-gold)',
  success:    'var(--color-lx-success)',
  warning:    'var(--color-lx-warning)',
  textPrim:   'var(--color-lx-text-primary)',
  textSec:    'var(--color-lx-text-secondary)',
  textMuted:  'var(--color-lx-text-muted)',
} as const;

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";

// ─── Loading screen with cycling vocabulary hints ─────────────────────────────

function QuizLoading({ words }: { words: HintWord[] }) {
  const hasWords     = words.length > 0;
  const reduceMotion = useReducedMotion();
  const [hintIdx, setHintIdx]   = useState(0);
  const [showing, setShowing]   = useState(true);

  // Randomise start index once words are available
  useEffect(() => {
    if (words.length > 0) setHintIdx(Math.floor(Math.random() * words.length));
  }, [words.length]);

  useEffect(() => {
    if (!hasWords) return;
    const id = setInterval(() => {
      setShowing(false);
      setTimeout(() => {
        setHintIdx(i => (i + 1) % words.length);
        setShowing(true);
      }, 320);
    }, 4800);
    return () => clearInterval(id);
  }, [hasWords, words.length]);

  const hint = words[hintIdx];

  return (
    <div style={{
      minHeight: 'calc(100dvh - 72px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 1.5rem', gap: '2rem',
      maxWidth: 680,
      marginLeft: 'auto',
      marginRight: 'auto',
      width: '100%',
    }}>
      {/* Spinning gradient border container */}
      <div style={{ position: 'relative', width: '100%', padding: 2, borderRadius: 20 }}>
        <motion.div
          animate={reduceMotion ? {} : { rotate: 360 }}
          transition={reduceMotion ? {} : { repeat: Infinity, duration: 2.5, ease: 'linear' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 20,
            background: 'conic-gradient(from 0deg, #E63946 0%, transparent 35%, transparent 65%, #E63946 100%)',
          }}
        />
        <div style={{
          position: 'relative', borderRadius: 18,
          background: C.surface,
          padding: '2rem 1.5rem',
          display: 'flex', flexDirection: 'column', gap: '0.875rem',
          alignItems: 'center',
        }}>
          <p style={{ fontFamily: SANS, fontSize: '0.8125rem', color: C.textSec, marginBottom: '0.25rem', letterSpacing: '0.04em' }}>
            Generating your quiz…
          </p>
          {/* ── Vocabulary hint — shown while generating ── */}
          {hasWords && hint && (
            <div style={{ position: 'relative', minHeight: 88, width: '100%', marginTop: '0.25rem' }}>
              <AnimatePresence mode="wait">
                {showing && (
                  <motion.div
                    key={hintIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.32, ease: 'easeOut' }}
                    style={{
                      width: '100%',
                      display: 'flex', flexDirection: 'column', gap: '0.35rem',
                      padding: '0.875rem 1rem',
                      background: C.elevated,
                      border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${C.red}`,
                      borderRadius: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{
                        fontFamily: SERIF,
                        fontSize: 'clamp(1.25rem, 5vw, 1.5rem)',
                        fontWeight: 700,
                        fontStyle: 'italic',
                        color: C.textPrim,
                        lineHeight: 1.1,
                      }}>
                        {hint.word}
                      </span>
                      <span style={{
                        fontFamily: SANS,
                        fontSize: '0.65rem',
                        color: C.red,
                        fontStyle: 'italic',
                        letterSpacing: '0.04em',
                      }}>
                        {hint.pos}
                      </span>
                    </div>
                    <p style={{
                      fontFamily: SERIF,
                      fontSize: '0.9rem',
                      color: C.textSec,
                      lineHeight: 1.55,
                      margin: 0,
                    }}>
                      {hint.definition}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <p style={{ fontFamily: SANS, fontSize: '0.75rem', color: C.textMuted, letterSpacing: '0.06em' }}>
        Powered by AI
      </p>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function QuizError({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      minHeight: 'calc(100dvh - 72px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.5rem', gap: '1.25rem', textAlign: 'center',
    }}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        style={{
          background: 'rgba(230,57,70,0.08)',
          border: '1px solid rgba(230,57,70,0.25)',
          borderRadius: 16, padding: '2rem 1.5rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
        }}
      >
        <LexiArtwork path="states/server-error.webp" width={112} height={112} />
        <p style={{ fontFamily: SERIF, fontSize: '1.4rem', fontWeight: 700, color: C.textPrim }}>
          Quiz unavailable
        </p>
        <p style={{ fontFamily: SANS, fontSize: '0.875rem', color: C.textSec, lineHeight: 1.5 }}>
          Something went wrong generating the quiz.<br />Please try again in a few minutes.
        </p>
      </motion.div>
      <button
        onClick={onBack}
        style={{ fontFamily: SANS, fontSize: '0.875rem', color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
      >
        ← Go back
      </button>
    </div>
  );
}

// ─── Option card ──────────────────────────────────────────────────────────────

interface OptionCardProps {
  opt:            QuizOption;
  phase:          AnswerPhase;
  selectedLetter: string | null;
  result:         AnswerResult | null;
  index:          number;
  onSelect:       (opt: QuizOption) => void;
}

function OptionCard({ opt, phase, selectedLetter, result, index, onSelect }: OptionCardProps) {
  const isSelected = selectedLetter === opt.letter;
  const isRevealed = phase === 'revealed';
  const isCorrect  = result?.correctLetter === opt.letter;
  const isWrong    = isRevealed && isSelected && !isCorrect;
  const isDimmed   = (phase === 'selected' && !isSelected) ||
                     (isRevealed && !isCorrect && !isSelected);

  // Derive visual state
  let border:  string = `1.5px solid ${C.border}`;
  let bg:      string = C.surface;
  let shadow:  string = 'none';
  let lBg:     string = C.elevated;
  let lColor:  string = C.textSec;
  let wColor:  string = C.textPrim;

  if (phase === 'selected' && isSelected) {
    border  = '1.5px solid rgba(230,57,70,0.85)';
    bg      = 'rgba(230,57,70,0.07)';
    shadow  = '0 0 0 3px rgba(230,57,70,0.12), 0 4px 20px rgba(230,57,70,0.1)';
    lBg     = C.red;
    lColor  = '#fff';
  } else if (isRevealed) {
    if (isCorrect) {
      border  = `1.5px solid ${C.success}`;
      bg      = 'rgba(46,204,113,0.08)';
      shadow  = '0 0 0 2px rgba(46,204,113,0.15)';
      lBg     = C.success;
      lColor  = '#fff';
      wColor  = C.success;
    } else if (isWrong) {
      border  = `1.5px solid ${C.red}`;
      bg      = 'rgba(230,57,70,0.07)';
      lBg     = C.red;
      lColor  = '#fff';
      wColor  = C.red;
    }
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: isDimmed ? 0.35 : 1, y: 0, scale: isRevealed && isCorrect ? [1, 1.025, 1] : 1 }}
      transition={{
        opacity: { delay: index * 0.055, type: 'spring', stiffness: 400, damping: 30 },
        y:       { delay: index * 0.055, type: 'spring', stiffness: 400, damping: 30 },
        scale:   isRevealed && isCorrect ? { duration: 0.4, times: [0, 0.5, 1] } : {},
      }}
      whileTap={phase !== 'revealed' ? { scale: 0.975 } : {}}
      onClick={() => phase !== 'revealed' && onSelect(opt)}
      aria-keyshortcuts={`${index + 1}`}
      aria-pressed={isSelected}
      disabled={phase === 'revealed'}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.875rem 1rem',
        background: bg,
        border,
        borderRadius: 14,
        boxShadow: shadow,
        cursor: phase === 'idle' ? 'pointer' : 'default',
        width: '100%', textAlign: 'left',
        transition: 'background 0.22s, border-color 0.22s, box-shadow 0.22s',
      }}
    >
      {/* Letter badge */}
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: lBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.22s',
      }}>
        <span style={{ fontFamily: SANS, fontSize: '0.75rem', fontWeight: 700, color: lColor }}>
          {opt.letter}
        </span>
      </div>

      {/* Word */}
      <span style={{
        fontFamily: SERIF,
        fontSize: 'clamp(1rem, 3.5vw, 1.1rem)',
        fontWeight: 600,
        color: wColor,
        lineHeight: 1.25,
        flex: 1,
        transition: 'color 0.22s',
        textTransform: 'capitalize',
      }}>
        {opt.word}
      </span>

      {/* Reveal icon — purpose-built quiz stamps */}
      {isRevealed && isCorrect && (
        <LexiIcon path="quiz/correct.svg" size={20} color={C.success} label="Correct" style={{ flexShrink: 0 }} />
      )}
      {isRevealed && isWrong && (
        <LexiIcon path="quiz/incorrect.svg" size={20} color={C.red} label="Incorrect" style={{ flexShrink: 0 }} />
      )}
    </motion.button>
  );
}

// ─── Quiz Summary ─────────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 54;

function QuizSummary({ summary, onContinue }: { summary: SummaryData; onContinue: () => void }) {
  const { scorePct, passed, passThreshold, correctAnswers, totalQuestions, bonusPoints, questions } = summary;
  const { navigate } = useSafeNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ringColor = passed ? C.success : scorePct >= 40 ? C.warning : C.red;
  const wrongOnly = questions.filter(q => q.userAnswer && !q.userAnswer.isCorrect);

  const summaryCard: Variants = {
    hidden: { opacity: 0, y: 20 },
    show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        minHeight: 'calc(100dvh - 72px)',
        overflowY: 'auto',
        padding: '1.5rem 1.25rem 2rem',
        display: 'flex', flexDirection: 'column', gap: '1.25rem',
      }}
    >
      {/* Score ring hero */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.05 }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.75rem', paddingTop: '0.5rem',
        }}
      >
        {/* Ring */}
        <div style={{ position: 'relative', width: 140, height: 140 }}>
          {/* summary-ring.svg: decorative orbital backdrop, always present */}
          <LexiIcon
            path="quiz/summary-ring.svg"
            size={140}
            color={ringColor}
            style={{ position: 'absolute', inset: 0, opacity: 0.12, flexShrink: 0 }}
          />
          {/* perfect-score for 100%, otherwise pass/try-again watermark */}
          {scorePct === 100 ? (
            <LexiIcon
              path="quiz/perfect-score.svg"
              size={52}
              color={C.gold}
              label="Perfect score"
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 3, marginTop: -22 }}
            />
          ) : (
            <LexiIcon
              path={passed ? 'quiz/pass.svg' : 'quiz/try-again.svg'}
              size={140}
              color={ringColor}
              style={{ position: 'absolute', inset: 0, opacity: 0.28, flexShrink: 0 }}
            />
          )}
          <svg width={140} height={140} style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
            <circle cx={70} cy={70} r={54} fill="none" strokeWidth={9} stroke={C.elevated} />
            <motion.circle
              cx={70} cy={70} r={54}
              fill="none" strokeWidth={9}
              stroke={ringColor}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - scorePct / 100) }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
              style={{ filter: `drop-shadow(0 0 6px ${ringColor}60)` }}
            />
          </svg>
          {/* Score label — hidden behind perfect-score icon when 100% */}
          {scorePct !== 100 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              zIndex: 2,
            }}>
              <span style={{ fontFamily: SERIF, fontSize: '2.1rem', fontWeight: 700, lineHeight: 1, color: C.textPrim }}>
                <AnimatedNumber value={scorePct} />%
              </span>
              <span style={{ fontFamily: SANS, fontSize: '0.65rem', color: C.textMuted, marginTop: 2, letterSpacing: '0.06em' }}>
                SCORE
              </span>
            </div>
          )}
        </div>

        {/* Premium celebration — passed quizzes only */}
        {passed && <Celebration active intensity="full" anchor={{ x: 0.5, y: 0.32 }} />}

        {/* Verdict */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: '2rem', fontWeight: 700, fontStyle: 'italic', color: passed ? C.success : C.textPrim, lineHeight: 1.1 }}>
            {passed ? 'Passed!' : 'Keep going!'}
          </h2>
          <p style={{ fontFamily: SANS, fontSize: '0.8125rem', color: C.textSec, marginTop: '0.3rem' }}>
            {correctAnswers} of {totalQuestions} correct · pass threshold {passThreshold}%
          </p>
        </div>

        {/* Bonus points pill */}
        {bonusPoints > 0 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 380, damping: 22 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.4rem 0.875rem',
              background: 'rgba(244,168,40,0.12)',
              border: '1px solid rgba(244,168,40,0.3)',
              borderRadius: 20,
            }}
          >
            <LexiIcon path="quiz/points-earned.svg" size={14} color={C.gold} />
            <span style={{ fontFamily: SANS, fontSize: '0.8125rem', fontWeight: 600, color: C.gold }}>
              +{bonusPoints} bonus points
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* CTA buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}
      >
        <button
          onClick={onContinue}
          style={{
            width: '100%', padding: '1rem',
            background: C.red, color: '#fff',
            border: 'none', borderRadius: 16,
            fontFamily: SANS, fontSize: '0.9375rem', fontWeight: 600,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          Continue <MoveRight size={17} />
        </button>

        {wrongOnly.length > 0 && (
          <button
            onClick={() => navigate('/vocab/practice')}
            style={{
              width: '100%', padding: '0.875rem',
              background: 'transparent',
              border: `1.5px solid rgba(230,57,70,0.35)`,
              borderRadius: 16,
              fontFamily: SANS, fontSize: '0.875rem', fontWeight: 500,
              color: C.red, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <RefreshCcwDot size={15} /> Review {wrongOnly.length} weak word{wrongOnly.length !== 1 ? 's' : ''}
          </button>
        )}

        <button
          onClick={() => void shareLexiCore({
            title: 'My LexiCore session',
            text: `I recalled ${correctAnswers} of ${totalQuestions} words in LexiCore today.`,
            path: '/vocab',
          })}
          style={{
            width: '100%', minHeight: 44, padding: '0.75rem',
            background: 'transparent', border: 'none',
            fontFamily: SANS, fontSize: '0.8125rem', fontWeight: 500,
            color: C.textSec, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <Share2 size={15} /> Share this milestone
        </button>
      </motion.div>

      {/* Question review list */}
      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <p style={{ fontFamily: SANS, fontSize: '0.75rem', color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Review <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· tap any row to see breakdown</span>
          </p>

          <motion.div variants={{ show: { transition: { staggerChildren: 0.045, delayChildren: 0.4 } } }} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {questions.map((q) => {
              const ua         = q.userAnswer;
              const correct    = ua?.isCorrect ?? false;
              const answered   = ua !== null && ua !== undefined;
              const isExpanded = expandedId === q.id;

              // Derive which letter the user selected
              const userLetter = ua?.selectedWordId != null
                ? q.options.find(o => o.wordId === ua.selectedWordId)?.letter ?? null
                : null;

              return (
                <motion.div
                  key={q.id}
                  variants={summaryCard}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${correct ? C.success : answered ? C.red : C.border}`,
                    background: C.surface,
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                >
                  {/* Question header */}
                  <div style={{ padding: '0.875rem 1rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                    <div style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: 6,
                      background: correct ? 'rgba(46,204,113,0.15)' : 'rgba(230,57,70,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 2,
                    }}>
                      {correct
                        ? <LexiIcon path="quiz/correct.svg" size={13} color={C.success} />
                        : <LexiIcon path="quiz/incorrect.svg" size={13} color={C.red} />
                      }
                    </div>
                    <p style={{ fontFamily: SERIF, fontSize: '0.9375rem', lineHeight: 1.5, color: C.textPrim, flex: 1 }}>
                      {q.questionText}
                    </p>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
                      style={{ flexShrink: 0, marginTop: 3 }}
                    >
                      <ChevronDown size={15} color={C.textMuted} />
                    </motion.div>
                  </div>

                  {/* Expandable explanation panel */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring' as const, stiffness: 380, damping: 32 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          borderTop: `1px solid ${C.border}`,
                          padding: '0.875rem 1rem 1rem',
                          display: 'flex', flexDirection: 'column', gap: '0.875rem',
                        }}>
                          {/* Explanation */}
                          {q.explanation && (
                            <div style={{
                              background: correct ? 'rgba(46,204,113,0.06)' : 'rgba(230,57,70,0.06)',
                              borderLeft: `2px solid ${correct ? C.success : C.red}`,
                              borderRadius: '0 8px 8px 0',
                              padding: '0.625rem 0.75rem',
                            }}>
                              <p style={{ fontFamily: SANS, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: correct ? C.success : C.red, marginBottom: '0.3rem' }}>
                                Explanation
                              </p>
                              <p style={{ fontFamily: SERIF, fontSize: '0.9rem', fontStyle: 'italic', color: C.textSec, lineHeight: 1.6, margin: 0 }}>
                                {q.explanation}
                              </p>
                            </div>
                          )}

                          {/* All options breakdown */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <p style={{ fontFamily: SANS, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textMuted, marginBottom: '0.25rem' }}>
                              Options
                            </p>
                            {q.options.map(opt => {
                              const isCorrectOpt = opt.letter === q.correctLetter;
                              const isUserPick   = opt.letter === userLetter;
                              const isWrongPick  = isUserPick && !isCorrectOpt;

                              return (
                                <div
                                  key={opt.letter}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.45rem 0.625rem',
                                    borderRadius: 8,
                                    background: isCorrectOpt
                                      ? 'rgba(46,204,113,0.1)'
                                      : isWrongPick
                                        ? 'rgba(230,57,70,0.08)'
                                        : 'transparent',
                                    border: isCorrectOpt
                                      ? '1px solid rgba(46,204,113,0.25)'
                                      : isWrongPick
                                        ? '1px solid rgba(230,57,70,0.2)'
                                        : '1px solid transparent',
                                  }}
                                >
                                  <span style={{
                                    fontFamily: SANS, fontSize: '0.7rem', fontWeight: 700,
                                    width: 18, textAlign: 'center',
                                    color: isCorrectOpt ? C.success : isWrongPick ? C.red : C.textMuted,
                                  }}>
                                    {opt.letter}
                                  </span>
                                  {isCorrectOpt
                                    ? <LexiIcon path="quiz/correct.svg" size={12} color={C.success} style={{ flexShrink: 0 }} />
                                    : <LexiIcon path="quiz/incorrect.svg" size={12} color={isWrongPick ? C.red : C.textMuted} style={{ flexShrink: 0, opacity: isWrongPick ? 1 : 0.4 }} />
                                  }
                                  <span style={{
                                    fontFamily: SERIF, fontSize: '0.9rem',
                                    color: isCorrectOpt ? C.success : isWrongPick ? C.red : C.textSec,
                                    fontWeight: isCorrectOpt ? 600 : 400,
                                    flex: 1,
                                  }}>
                                    {opt.word}
                                  </span>
                                  {isCorrectOpt && (
                                    <span style={{ fontFamily: SANS, fontSize: '0.65rem', fontWeight: 600, color: C.success, letterSpacing: '0.05em' }}>
                                      CORRECT
                                    </span>
                                  )}
                                  {isWrongPick && (
                                    <span style={{ fontFamily: SANS, fontSize: '0.65rem', fontWeight: 600, color: C.red, letterSpacing: '0.05em' }}>
                                      YOUR ANSWER
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Timer bar ────────────────────────────────────────────────────────────────

function TimerBar({ secondsLeft, totalSeconds }: { secondsLeft: number; totalSeconds: number }) {
  const pct = secondsLeft / totalSeconds;
  const isUrgent = pct <= 0.3;
  const color = pct > 0.6
    ? 'var(--color-lx-success)'
    : pct > 0.3
      ? 'var(--color-lx-warning)'
      : 'var(--color-lx-accent-red)';

  return (
    <div style={{ marginBottom: '0.625rem' }}>
      {/* Timer icon chip + seconds display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '0.3rem' }}>
        <LexiIcon
          path={isUrgent ? 'quiz/timer-urgent.svg' : 'quiz/timer.svg'}
          size={13}
          color={color}
        />
        <span style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: '0.6875rem', fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
          transition: 'color 0.4s',
        }}>
          {secondsLeft}s
        </span>
      </div>
      <div style={{
        height: 4, borderRadius: 2,
        background: 'var(--color-lx-elevated)',
        overflow: 'hidden',
      }}>
        <motion.div
          animate={{ scaleX: pct, originX: 0 }}
          transition={{ duration: 0.25, ease: 'linear' }}
          style={{
            height: '100%',
            width: '100%',
            borderRadius: 2,
            background: color,
            transformOrigin: 'left center',
            transition: `background 0.4s`,
            boxShadow: `0 0 6px ${color}60`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Main QuizScreen ──────────────────────────────────────────────────────────

interface Props {
  themeId?:        number;
  themeIds?:       number[];
  letterWordIds?:  number[];
  sessionType:     'study' | 'practice' | 'letter' | 'exam';
  quizConfig?:     QuizConfig;
  /** Pre-loaded hint words (pass from parent if already available, e.g. letter mode) */
  hintWords?:      HintWord[];
}

export default function QuizScreen({ themeId, themeIds, letterWordIds, sessionType, quizConfig, hintWords: hintWordsProp }: Props) {
  const { navigate } = useSafeNavigate();
  // Known exit target per session type — router.back() can't be watchdogged
  // (unknown destination), so exit/error routes go to the launching hub.
  const exitHref     = sessionType === 'practice' || sessionType === 'exam' ? '/vocab/practice' : '/vocab/study';
  const { push }     = useBadgeQueue();
  const fb           = useVocabFeedback();
  const reduceMotion = useReducedMotion();
  const recoveryKey = useMemo(() => {
    const scope = themeId ?? themeIds?.join('-') ?? letterWordIds?.join('-') ?? 'global';
    return `lx-quiz-recovery:${sessionType}:${scope}`;
  }, [sessionType, themeId, themeIds, letterWordIds]);

  // Hint words for loading screen
  const [hintWords, setHintWords] = useState<HintWord[]>(hintWordsProp ?? []);

  // Orchestration state
  const [phase,       setPhase]       = useState<QuizPhase>('generating');
  const [sessionId,   setSessionId]   = useState<number | null>(null);
  const [questions,   setQuestions]   = useState<QuizQuestion[]>([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [answerPhase, setAnswerPhase] = useState<AnswerPhase>('idle');
  const [selectedId,     setSelectedId]     = useState<number | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [typedValue,     setTypedValue]     = useState('');
  const [result,      setResult]      = useState<AnswerResult | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [summary,     setSummary]     = useState<SummaryData | null>(null);
  const [totalEarned, setTotalEarned] = useState(0);
  const [direction,   setDirection]   = useState(1);

  // Timer state
  const timedMode  = quizConfig?.timed ?? false;
  const secsPerQ   = quizConfig?.secondsPerQuestion ?? 30;
  const [timeLeft, setTimeLeft] = useState<number>(secsPerQ);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  // Advance-after-reveal timeout refs — cleared on unmount to prevent stale callbacks
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timedAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear advance timers on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (timedAdvanceRef.current) clearTimeout(timedAdvanceRef.current);
    };
  }, []);

  // Generate on mount — also fetch word hints in parallel if not pre-supplied
  useEffect(() => {
    // ── Parallel word-hint fetch (fast, pure DB) ───────────────────────────
    try {
      const raw = localStorage.getItem(recoveryKey);
      if (raw) {
        const cached = JSON.parse(raw) as { version?: number; savedAt?: number; sessionId?: number; questions?: QuizQuestion[]; currentIdx?: number; totalEarned?: number };
        const fresh = typeof cached.savedAt === 'number' && Date.now() - cached.savedAt < 6 * 60 * 60 * 1000;
        if (cached.version === 1 && fresh && typeof cached.sessionId === 'number' && cached.questions?.length) {
          setSessionId(cached.sessionId);
          setQuestions(cached.questions);
          setCurrentIdx(Math.min(cached.currentIdx ?? 0, cached.questions.length - 1));
          setTotalEarned(cached.totalEarned ?? 0);
          setPhase('quiz');
          trackRetention(RETENTION_EVENTS.sessionRestored, { sessionType, sessionId: cached.sessionId, question: (cached.currentIdx ?? 0) + 1 });
          return;
        }
        localStorage.removeItem(recoveryKey);
      }
    } catch {
      localStorage.removeItem(recoveryKey);
    }

    if ((hintWordsProp ?? []).length === 0) {
      let previewUrl = '';
      if      (sessionType === 'letter'   && letterWordIds?.length) previewUrl = `/api/vocab/words/preview?wordIds=${letterWordIds.join(',')}`;
      else if (sessionType === 'study'    && themeId)               previewUrl = `/api/vocab/words/preview?themeId=${themeId}`;
      else if (sessionType === 'practice' && themeIds?.length)      previewUrl = `/api/vocab/words/preview?themeIds=${themeIds.join(',')}`;

      if (previewUrl) {
        fetch(previewUrl)
          .then(r => r.json())
          .then((d: { words?: HintWord[] }) => { if (d.words?.length) setHintWords(d.words); })
          .catch(() => {/* silently ignore — hints are non-critical */});
      }
    }

    // ── Main quiz generation (slow, Gemini AI) ─────────────────────────────
    // Track quiz start event
    if (sessionType === 'study') {
      trackFeature('quiz_start', 'vocab', { type: 'study' });
    } else if (sessionType === 'practice' || sessionType === 'letter') {
      trackFeature('quiz_start', 'vocab', { type: 'practice' });
    }

    (async () => {
      try {
        const body = sessionType === 'study'
          ? { type: 'study', themeId, questionCount: quizConfig?.questionCount ?? 10 }
          : sessionType === 'letter'
            ? { type: 'letter', wordIds: letterWordIds, questionCount: quizConfig?.questionCount ?? 10 }
            : sessionType === 'exam'
              ? { type: 'exam', questionCount: quizConfig?.questionCount ?? 15 }
              : { type: 'practice', themeIds, questionCount: quizConfig?.questionCount ?? 20 };

        const prefetched = consumePrefetch(body as Parameters<typeof consumePrefetch>[0]);
        let data: { sessionId: number; questions: QuizQuestion[] };
        if (prefetched) {
          data = await prefetched as { sessionId: number; questions: QuizQuestion[] };
        } else {
          const res = await fetch('/api/vocab/quiz/generate', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
            signal:  AbortSignal.timeout(45000),
          });
          if (!res.ok) throw new Error('generation failed');
          data = await res.json() as { sessionId: number; questions: QuizQuestion[] };
        }

        setSessionId(data.sessionId);
        setQuestions(data.questions);
        setPhase('quiz');
        trackRetention(RETENTION_EVENTS.learningSessionStarted, { sessionType, sessionId: data.sessionId, questions: data.questions.length });
      } catch {
        // Covers network errors, non-OK responses, and AbortError (45s timeout) —
        // all fall through to the same error phase with retry.
        setPhase('error');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'quiz' || !sessionId || questions.length === 0) return;
    localStorage.setItem(recoveryKey, JSON.stringify({
      version: 1, savedAt: Date.now(), sessionId, questions, currentIdx, totalEarned,
    }));
  }, [phase, sessionId, questions, currentIdx, totalEarned, recoveryKey]);

  useEffect(() => {
    if (phase === 'summary') {
      localStorage.removeItem(recoveryKey);
      trackRetention(RETENTION_EVENTS.learningSessionCompleted, { sessionType, sessionId, correct: summary?.correctAnswers ?? 0, total: summary?.totalQuestions ?? questions.length });
      if (sessionType === 'practice' || sessionType === 'letter') trackRetention(RETENTION_EVENTS.reviewCompleted, { sessionType, sessionId });
    }
  }, [phase, recoveryKey]);

  const current = questions[currentIdx];

  // Timer countdown — reset on question change
  useEffect(() => {
    if (!timedMode || phase !== 'quiz') return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(secsPerQ);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIdx, phase, timedMode, secsPerQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // When timer hits 0 and still idle/selected — force submit whatever the
  // student has (typed text, selection, or the first option) as the answer.
  useEffect(() => {
    if (!timedMode || timeLeft !== 0 || phase !== 'quiz' || answerPhase === 'revealed' || submitting) return;
    if (!sessionId || !current) return;

    const isTyped       = current.inputMode === 'typed';
    const isStringOpts  = current.optionKind === 'string';

    let answerBody: Record<string, unknown>;
    if (isTyped) {
      answerBody = { typedAnswer: typedValue };
    } else {
      const opt = (selectedLetter
        ? current.options.find(o => o.letter === selectedLetter)
        : current.options[0]) ?? null;
      if (!opt) return;
      setSelectedLetter(opt.letter);
      setSelectedId(opt.wordId);
      answerBody = isStringOpts
        ? { selectedLetter: opt.letter }
        : { selectedWordId: opt.wordId };
    }

    const runConfirm = async () => {
      setAnswerPhase('selected');
      setSubmitting(true);
      try {
        const res  = await fetch('/api/vocab/quiz/answer', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, questionId: current.id, ...answerBody }),
        });
        const data = await res.json() as AnswerResult;
        setResult(data);
        setAnswerPhase('revealed');
        fb.play(data.isCorrect ? 'correct' : 'incorrect');
        if (data.pointsEarned) setTotalEarned(p => p + data.pointsEarned);
        timedAdvanceRef.current = setTimeout(async () => {
          if (currentIdx === questions.length - 1) {
            try {
              const sumRes  = await fetch(`/api/vocab/quiz/summary/${sessionId}`);
              const sumData = await sumRes.json() as SummaryData;
              if (sumData.earnedBadges?.length) push(sumData.earnedBadges);
              setSummary(sumData);
              fb.play('complete');
              setPhase('summary');
            } catch { setPhase('error'); }
          } else {
            setDirection(1);
            setCurrentIdx(i => i + 1);
            setAnswerPhase('idle');
            setSelectedId(null);
            setSelectedLetter(null);
            setTypedValue('');
            setResult(null);
          }
          setSubmitting(false);
        }, 1400);
      } catch { setSubmitting(false); }
    };
    void runConfirm();
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared auto-advance after the reveal pause
  const advanceAfterReveal = useCallback((apiPromise: Promise<unknown> | null) => {
    const isLastQuestion = currentIdx === questions.length - 1;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(async () => {
      if (isLastQuestion) {
        // Wait for the last answer to be recorded before fetching summary
        try {
          if (apiPromise) await apiPromise;
          const sumRes  = await fetch(`/api/vocab/quiz/summary/${sessionId}`);
          const sumData = await sumRes.json() as SummaryData;
          if (sumData.earnedBadges?.length) push(sumData.earnedBadges);
          setSummary(sumData);
          fb.play('complete');
          setPhase('summary');
        } catch {
          setPhase('error');
        }
      } else {
        setDirection(1);
        setCurrentIdx(i => i + 1);
        setAnswerPhase('idle');
        setSelectedId(null);
        setSelectedLetter(null);
        setTypedValue('');
        setResult(null);
      }
      setSubmitting(false);
    }, 1400);
  }, [currentIdx, questions.length, sessionId, push, fb]);

  // Confirm answer (MCQ) — instant result from client data, API records in background
  const handleConfirm = useCallback(() => {
    if (!sessionId || !current || !selectedLetter || submitting || answerPhase !== 'selected') return;

    // Stop the timer immediately
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    setSubmitting(true);

    // Show correct/wrong instantly — no network wait
    const immediateResult: AnswerResult = {
      isCorrect:       selectedLetter === current.correctLetter,
      correctLetter:   current.correctLetter ?? '',
      correctWordId:   current.correctWordId ?? 0,
      explanation:     current.explanation ?? '',
      pointsEarned:    0,
      masteryDelta:    0,
      newMasteryLevel: '',
    };
    setResult(immediateResult);
    setAnswerPhase('revealed');
    fb.play(immediateResult.isCorrect ? 'correct' : 'incorrect');

    // Record answer in background; update points/mastery delta when it resolves
    const answerBody = current.optionKind === 'string'
      ? { selectedLetter }
      : { selectedWordId: selectedId };
    const apiPromise = fetch('/api/vocab/quiz/answer', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId, questionId: current.id, ...answerBody }),
    })
      .then(r => r.json() as Promise<AnswerResult>)
      .then(data => {
        if (data.pointsEarned) setTotalEarned(p => p + data.pointsEarned);
        setResult(prev => prev ? { ...prev, pointsEarned: data.pointsEarned, masteryDelta: data.masteryDelta, newMasteryLevel: data.newMasteryLevel } : prev);
        return data;
      })
      .catch(() => null);

    advanceAfterReveal(apiPromise);
  }, [sessionId, current, selectedId, selectedLetter, submitting, answerPhase, advanceAfterReveal, fb]);

  // Confirm answer (typed production recall) — the server holds the answer,
  // so the reveal waits for the API response.
  const handleTypedSubmit = useCallback(async () => {
    if (!sessionId || !current || submitting || answerPhase === 'revealed') return;
    if (typedValue.trim().length === 0) return;

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/vocab/quiz/answer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId, questionId: current.id, typedAnswer: typedValue }),
      });
      if (!res.ok) throw new Error('answer failed');
      const data = await res.json() as AnswerResult;
      setResult(data);
      setAnswerPhase('revealed');
      fb.play(data.isCorrect ? 'correct' : 'incorrect');
      if (data.pointsEarned) setTotalEarned(p => p + data.pointsEarned);
      advanceAfterReveal(null);
    } catch {
      // Network hiccup or dead connection — the answer was never recorded.
      // Surface it instead of silently reverting to "Submit Answer" with no
      // explanation, which reads to the student as the app just doing nothing.
      setSubmitError("Couldn't submit — check your connection and try again.");
      setSubmitting(false);
    }
  }, [sessionId, current, submitting, answerPhase, typedValue, advanceAfterReveal, fb]);

  useEffect(() => {
    if (phase !== 'quiz' || !current || current.inputMode === 'typed') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key >= '1' && event.key <= '4' && answerPhase !== 'revealed') {
        const option = current.options[Number(event.key) - 1];
        if (!option) return;
        event.preventDefault();
        setSelectedId(option.wordId);
        setSelectedLetter(option.letter);
        setAnswerPhase('selected');
        fb.play('select');
      } else if (event.key === 'Enter' && answerPhase === 'selected') {
        event.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, current, answerPhase, fb, handleConfirm]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'generating') return <QuizLoading words={hintWords} />;
  if (phase === 'error')      return <div className="lx-page-enter"><QuizError onBack={() => navigate(exitHref)} /></div>;
  if (phase === 'summary' && summary) {
    return <div className="lx-page-enter"><QuizSummary summary={summary} onContinue={() => navigate('/vocab/study')} /></div>;
  }
  if (!current) return null;

  const progress      = (currentIdx / questions.length) * 100;
  const typeLabel     = {
    fill_blank:    'Fill in the blank',
    analogy:       'Analogy',
    correct_usage: 'Correct usage',
    synonym:       'Synonym',
    antonym:       'Antonym',
    type_word:     'Type the word',
    type_cloze:    'Type the missing word',
  }[current.type];
  const isTypedQ      = current.inputMode === 'typed';

  return (
    <div style={{
      height: 'calc(100dvh - 72px)',
      display: 'flex', flexDirection: 'column',
      padding: '1rem 1.25rem 1.25rem',
      maxWidth: 680,
      marginLeft: 'auto',
      marginRight: 'auto',
      width: '100%',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => navigate(exitHref)}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            padding: 3,
          }}
          aria-label="Exit quiz"
        >
          <span style={{
            width: 38, height: 38, borderRadius: '50%',
            background: C.elevated,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.textSec,
          }}>
            <IconClose />
          </span>
        </motion.button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <p style={{ fontFamily: SANS, fontSize: '0.6875rem', color: C.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {typeLabel}
          </p>
          <p style={{ fontFamily: SANS, fontSize: '0.875rem', fontWeight: 600, color: C.textPrim }}>
            Q{currentIdx + 1} <span style={{ color: C.textMuted, fontWeight: 400 }}>/ {questions.length}</span>
          </p>
        </div>

        {/* Live points earned */}
        <motion.div
          key={totalEarned}
          initial={{ scale: totalEarned > 0 ? 1.25 : 1 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: C.elevated,
            border: '1px solid rgba(244,168,40,0.2)',
            borderRadius: 20, padding: '0.3rem 0.75rem',
          }}
        >
          <Gem size={11} color={C.gold} />
          <span style={{ fontFamily: SANS, fontSize: '0.75rem', fontWeight: 600, color: C.gold }}>
            +<AnimatedNumber value={totalEarned} />
          </span>
        </motion.div>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      <div style={{ height: 3, background: C.elevated, borderRadius: 4, marginBottom: timedMode ? '0.5rem' : '1.125rem', overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{
            height: '100%', borderRadius: 4,
            background: C.red,
            boxShadow: '0 0 6px rgba(230,57,70,0.5)',
          }}
        />
      </div>

      {/* ── Timer bar (timed mode only) — hidden once confirm is pressed ── */}
      {timedMode && answerPhase === 'idle' && (
        <TimerBar secondsLeft={timeLeft} totalSeconds={secsPerQ} />
      )}

      {/* ── Per-correct-answer subtle bloom (screen-level, not per-option) ── */}
      <Celebration
        active={answerPhase === 'revealed' && result?.isCorrect === true}
        intensity="subtle"
      />

      {/* ── Question + Options ──────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: direction * 36 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -direction * 28 }}
          transition={{ duration: 0.26, ease: 'easeOut' }}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
        >
          {/* Question text */}
          <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            padding: '1.25rem',
            position: 'relative', overflow: 'hidden',
            // Keep full height so long prompts never clip — the parent
            // column scrolls instead of this flex child shrinking (overflow
            // hidden here only clips the decorative rotating gradient).
            flexShrink: 0,
          }}>
            {/* Rotating radial gradient — premium depth effect */}
            <motion.div
              aria-hidden
              animate={reduceMotion ? {} : { rotate: 360 }}
              transition={reduceMotion ? {} : { repeat: Infinity, duration: 18, ease: 'linear' }}
              style={{
                position: 'absolute', top: '-60%', left: '-20%',
                width: '140%', height: '140%',
                backgroundImage: 'radial-gradient(at 60% 30%, rgba(230,57,70,0.07) 0%, transparent 55%), radial-gradient(at 20% 70%, rgba(244,168,40,0.04) 0%, transparent 50%)',
                pointerEvents: 'none',
              }}
            />
            <p style={{
              fontFamily: SERIF,
              fontSize: 'clamp(1.1rem, 4vw, 1.3rem)',
              lineHeight: 1.65,
              color: C.textPrim,
              fontWeight: 500,
              position: 'relative',
            }}>
              {current.questionText}
            </p>
          </div>

          {/* Options list (MCQ) or typed-answer input (production recall) */}
          {isTypedQ ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {current.typedHint && (
                <p style={{ fontFamily: SANS, fontSize: '0.75rem', color: C.textMuted, letterSpacing: '0.04em' }}>
                  Hint: starts with{' '}
                  <span style={{ color: C.gold, fontWeight: 700 }}>{current.typedHint.firstLetter}</span>
                  {' '}· {current.typedHint.length} letters
                </p>
              )}
              <input
                type="text"
                value={typedValue}
                onChange={(e) => { setTypedValue(e.target.value); if (submitError) setSubmitError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleTypedSubmit(); }}
                disabled={answerPhase === 'revealed' || submitting}
                placeholder="Type your answer…"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  width: '100%',
                  padding: '1rem 1.125rem',
                  background: C.surface,
                  border: answerPhase === 'revealed'
                    ? `1.5px solid ${result?.isCorrect ? C.success : C.red}`
                    : `1.5px solid ${C.border}`,
                  borderRadius: 14,
                  fontFamily: SERIF,
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  color: answerPhase === 'revealed'
                    ? (result?.isCorrect ? C.success : C.red)
                    : C.textPrim,
                  outline: 'none',
                  letterSpacing: '0.02em',
                }}
              />
              {/* Reveal: show the expected word when the typed answer was wrong */}
              {answerPhase === 'revealed' && result && !result.isCorrect && result.correctWord && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(46,204,113,0.07)',
                    border: '1px solid rgba(46,204,113,0.22)',
                    borderRadius: 12,
                  }}
                >
                  <span style={{ fontFamily: SANS, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.success }}>
                    Answer
                  </span>
                  <span style={{ fontFamily: SERIF, fontSize: '1.2rem', fontWeight: 700, fontStyle: 'italic', color: C.success, textTransform: 'capitalize' }}>
                    {result.correctWord}
                  </span>
                </motion.div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {current.options.map((opt, i) => (
                <OptionCard
                  key={opt.letter}
                  opt={opt}
                  phase={answerPhase}
                  selectedLetter={selectedLetter}
                  result={result}
                  index={i}
                  onSelect={(o) => {
                    setSelectedId(o.wordId);
                    setSelectedLetter(o.letter);
                    setAnswerPhase('selected');
                    fb.play('select');
                  }}
                />
              ))}
            </div>
          )}

          {/* Explanation reveal */}
          <AnimatePresence>
            {answerPhase === 'revealed' && result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                style={{
                  padding: '0.875rem 1rem',
                  background: result.isCorrect ? 'rgba(46,204,113,0.06)' : 'rgba(230,57,70,0.06)',
                  border: `1px solid ${result.isCorrect ? 'rgba(46,204,113,0.2)' : 'rgba(230,57,70,0.18)'}`,
                  borderRadius: 12,
                }}
              >
                <p style={{ fontFamily: SERIF, fontSize: '0.9375rem', fontStyle: 'italic', lineHeight: 1.6, color: C.textSec }}>
                  {result.explanation}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* ── Typed-answer submit button ───────────────────────────────────── */}
      {isTypedQ && answerPhase !== 'revealed' && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: typedValue.trim().length > 0 ? 1 : 0.45, y: 0 }}
          whileTap={typedValue.trim().length > 0 ? { scale: 0.975 } : {}}
          onClick={() => void handleTypedSubmit()}
          disabled={submitting || typedValue.trim().length === 0}
          style={{
            marginTop: '0.875rem',
            width: '100%', padding: '1rem',
            background: C.red,
            color: '#fff',
            border: 'none', borderRadius: 16,
            fontFamily: SANS, fontSize: '0.9375rem', fontWeight: 600,
            cursor: submitting || typedValue.trim().length === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 16px rgba(230,57,70,0.3)',
            flexShrink: 0,
          }}
        >
          {submitting ? 'Checking…' : 'Submit Answer'}
          {!submitting && <IconConfirm />}
        </motion.button>
      )}
      {isTypedQ && answerPhase !== 'revealed' && submitError && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          style={{
            marginTop: '0.5rem',
            fontFamily: SANS, fontSize: '0.8125rem', fontWeight: 500,
            color: C.red, textAlign: 'center',
          }}
        >
          {submitError}
        </motion.p>
      )}

      {/* ── Confirm button (springs up on selection) ─────────────────────── */}
      <AnimatePresence>
        {answerPhase === 'selected' && !isTypedQ && (
          <motion.button
            initial={{ y: 22, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            whileTap={{ scale: 0.975 }}
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              marginTop: '0.875rem',
              width: '100%', padding: '1rem',
              background: C.red,
              color: '#fff',
              border: 'none', borderRadius: 16,
              fontFamily: SANS, fontSize: '0.9375rem', fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.75 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(230,57,70,0.3)',
              flexShrink: 0,
            }}
          >
            {submitting ? 'Checking…' : 'Confirm'}
            {!submitting && <IconConfirm />}
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
