'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Timer, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizConfig {
  questionCount:    10 | 15 | 20;
  timed:            boolean;
  secondsPerQuestion: 15 | 30 | 45 | 60;
}

interface Props {
  onStart: (config: QuizConfig) => void;
  onCancel?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lx-quiz-config';

const QUESTION_COUNTS: (10 | 15 | 20)[] = [10, 15, 20];
const TIMER_OPTIONS:   (15 | 30 | 45 | 60)[] = [15, 30, 45, 60];

function timerLabel(s: 15 | 30 | 45 | 60): string {
  return s === 60 ? '1m' : `${s}s`;
}

function loadConfig(): QuizConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<QuizConfig>;
      return {
        questionCount:      [10, 15, 20].includes(parsed.questionCount as number)
          ? (parsed.questionCount as 10 | 15 | 20) : 10,
        timed:              typeof parsed.timed === 'boolean' ? parsed.timed : false,
        secondsPerQuestion: [15, 30, 45, 60].includes(parsed.secondsPerQuestion as number)
          ? (parsed.secondsPerQuestion as 15 | 30 | 45 | 60) : 30,
      };
    }
  } catch { /* ignore */ }
  return { questionCount: 10, timed: false, secondsPerQuestion: 30 };
}

// ─── CSS tokens ───────────────────────────────────────────────────────────────
const C = {
  base:      'var(--color-lx-base)',
  surface:   'var(--color-lx-surface)',
  elevated:  'var(--color-lx-elevated)',
  border:    'var(--color-lx-border)',
  red:       'var(--color-lx-accent-red)',
  gold:      'var(--color-lx-accent-gold)',
  textPrim:  'var(--color-lx-text-primary)',
  textSec:   'var(--color-lx-text-secondary)',
  textMuted: 'var(--color-lx-text-muted)',
} as const;

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";

// ─── Animation variants ───────────────────────────────────────────────────────

const backdrop: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.22 } },
  exit:   { opacity: 0, transition: { duration: 0.18 } },
};

const sheet: Variants = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0,  transition: { type: 'spring' as const, stiffness: 320, damping: 28, delay: 0.04 } },
  exit:   { opacity: 0, y: 28, transition: { duration: 0.18 } },
};

const timerSection: Variants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  show:   { opacity: 1, height: 'auto', marginTop: 24, transition: { type: 'spring' as const, stiffness: 360, damping: 32 } },
  exit:   { opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.2 } },
};

// ─── Pill selector ────────────────────────────────────────────────────────────

function PillSelector<T extends number>({
  options,
  selected,
  onSelect,
  labelFn,
  layoutId,
}: {
  options:  T[];
  selected: T;
  onSelect: (v: T) => void;
  labelFn?: (v: T) => string;
  layoutId: string;
}) {
  return (
    <div style={{
      display: 'flex', gap: 8,
      background: 'var(--color-lx-elevated)',
      borderRadius: 14,
      padding: 4,
    }}>
      {options.map(opt => {
        const active = opt === selected;
        return (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            style={{
              position: 'relative',
              flex: 1,
              padding: '0.55rem 0.25rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 10,
              outline: 'none',
            }}
          >
            {active && (
              <motion.div
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 10,
                  background: C.red,
                  boxShadow: '0 2px 12px rgba(230,57,70,0.28)',
                }}
              />
            )}
            <span style={{
              position: 'relative',
              fontFamily: SANS,
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: active ? '#fff' : C.textSec,
              transition: 'color 0.18s',
              letterSpacing: '0.01em',
            }}>
              {labelFn ? labelFn(opt) : String(opt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function AnimatedToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        width: 48, height: 28,
        borderRadius: 14,
        background: on ? C.red : 'var(--color-lx-elevated)',
        border: `1.5px solid ${on ? C.red : C.border}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.22s, border-color 0.22s',
        flexShrink: 0,
        boxShadow: on ? '0 2px 10px rgba(230,57,70,0.28)' : 'none',
      }}
    >
      <motion.div
        animate={{ x: on ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute',
          top: 2, left: 0,
          width: 20, height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}
      />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuizConfigSheet({ onStart, onCancel }: Props) {
  const [config, setConfig] = useState<QuizConfig>(() => loadConfig());

  // Persist to localStorage whenever config changes
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
  }, [config]);

  const handleStart = () => onStart(config);

  return (
    <motion.div
      variants={backdrop}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end',
        padding: '0 0 env(safe-area-inset-bottom)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel?.(); }}
    >
      <motion.div
        variants={sheet}
        initial="hidden"
        animate="show"
        exit="exit"
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          background: C.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          border: `1px solid ${C.border}`,
          borderBottom: 'none',
          padding: `1.5rem 1.5rem calc(80px + env(safe-area-inset-bottom, 0px))`,
          display: 'flex', flexDirection: 'column', gap: 0,
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: C.border,
          margin: '0 auto 1.25rem',
          flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{
            fontFamily: SERIF,
            fontSize: '1.75rem',
            fontWeight: 700,
            fontStyle: 'italic',
            color: C.textPrim,
            lineHeight: 1,
          }}>
            Configure Quiz
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                background: C.elevated, border: `1px solid ${C.border}`,
                borderRadius: 10, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: C.textSec,
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* ── Section: Questions ────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{
            fontFamily: SANS, fontSize: '0.75rem', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: C.textMuted, marginBottom: 10,
          }}>
            Questions
          </p>
          <PillSelector<10 | 15 | 20>
            options={QUESTION_COUNTS}
            selected={config.questionCount}
            onSelect={v => setConfig(c => ({ ...c, questionCount: v }))}
            layoutId="quiz-config-qcount"
          />
        </div>

        {/* ── Section: Timer ────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Timer size={15} style={{ color: C.textSec }} />
              <p style={{
                fontFamily: SANS, fontSize: '0.75rem', fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: C.textMuted,
              }}>
                Timed Mode
              </p>
            </div>
            <AnimatedToggle
              on={config.timed}
              onToggle={() => setConfig(c => ({ ...c, timed: !c.timed }))}
            />
          </div>

          {/* Per-question timer — revealed when timed on */}
          <AnimatePresence>
            {config.timed && (
              <motion.div
                key="timer-options"
                variants={timerSection}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ overflow: 'hidden' }}
              >
                <p style={{
                  fontFamily: SANS, fontSize: '0.75rem', fontWeight: 600,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: C.textMuted, marginBottom: 10,
                }}>
                  Per Question
                </p>
                <PillSelector<15 | 30 | 45 | 60>
                  options={TIMER_OPTIONS}
                  selected={config.secondsPerQuestion}
                  onSelect={v => setConfig(c => ({ ...c, secondsPerQuestion: v }))}
                  labelFn={timerLabel}
                  layoutId="quiz-config-timer"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={handleStart}
          style={{
            marginTop: 32,
            width: '100%',
            padding: '0.9375rem',
            background: C.red,
            border: 'none',
            borderRadius: 16,
            cursor: 'pointer',
            fontFamily: SANS,
            fontSize: '0.9375rem',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '0.02em',
            boxShadow: '0 4px 20px rgba(230,57,70,0.35)',
          }}
        >
          Start Quiz · {config.questionCount} questions
          {config.timed ? ` · ${timerLabel(config.secondsPerQuestion)}/Q` : ''}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
