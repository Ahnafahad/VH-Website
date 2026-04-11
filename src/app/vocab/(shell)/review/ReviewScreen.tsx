'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CheckCircle2, HelpCircle, XCircle, Zap, ArrowLeft } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Rating = 'got_it' | 'unsure' | 'missed_it';

interface ReviewWord {
  wordId:          number;
  word:            string;
  definition:      string;
  exampleSentence: string;
  partOfSpeech:    string;
  masteryLevel:    string;
  masteryScore:    number;
}

interface Props {
  words:     ReviewWord[];
  dueCount:  number;
}

// ─── CSS tokens ───────────────────────────────────────────────────────────────

const C = {
  base:     'var(--color-lx-base)',
  surface:  'var(--color-lx-surface)',
  elevated: 'var(--color-lx-elevated)',
  border:   'var(--color-lx-border)',
  red:      'var(--color-lx-accent-red)',
  gold:     'var(--color-lx-accent-gold)',
  success:  'var(--color-lx-success)',
  warning:  'var(--color-lx-warning)',
  textPrim: 'var(--color-lx-text-primary)',
  textSec:  'var(--color-lx-text-secondary)',
  textMuted:'var(--color-lx-text-muted)',
} as const;

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";

// ─── Mastery level badge ──────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  new:      'rgba(180,180,180,0.2)',
  learning: 'rgba(244,168,40,0.2)',
  familiar: 'rgba(56,189,248,0.2)',
  strong:   'rgba(46,204,113,0.2)',
  mastered: 'rgba(230,57,70,0.2)',
};
const LEVEL_TEXT: Record<string, string> = {
  new:      'rgba(180,180,180,0.9)',
  learning: 'var(--color-lx-accent-gold)',
  familiar: 'rgb(56,189,248)',
  strong:   'var(--color-lx-success)',
  mastered: 'var(--color-lx-accent-red)',
};

// ─── Completion screen ────────────────────────────────────────────────────────

function ReviewComplete({
  total, gotCount, missedCount, onDone,
}: { total: number; gotCount: number; missedCount: number; onDone: () => void }) {
  const router = useRouter();

  const completedCard: Variants = {
    hidden: { opacity: 0, y: 20 },
    show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        minHeight: 'calc(100dvh - 72px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1.5rem', gap: '1.5rem', textAlign: 'center',
      }}
    >
      {/* Zap icon */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 20, delay: 0.08 }}
        style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(244,168,40,0.12)',
          border: '1.5px solid rgba(244,168,40,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Zap size={32} color={C.gold} fill={C.gold} />
      </motion.div>

      <div>
        <motion.h2
          variants={completedCard} initial="hidden" animate="show"
          style={{ fontFamily: SERIF, fontSize: '2.4rem', fontWeight: 700, fontStyle: 'italic', color: C.textPrim, lineHeight: 1 }}
        >
          Caught up!
        </motion.h2>
        <motion.p
          variants={completedCard} initial="hidden" animate="show"
          style={{ fontFamily: SANS, fontSize: '0.875rem', color: C.textSec, marginTop: '0.5rem' }}
        >
          {total} word{total !== 1 ? 's' : ''} reviewed
        </motion.p>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, type: 'spring', stiffness: 300, damping: 26 }}
        style={{
          display: 'flex', gap: 12, width: '100%', maxWidth: 340,
        }}
      >
        <div style={{
          flex: 1, padding: '1rem', borderRadius: 14,
          background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.2)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontFamily: SERIF, fontSize: '2rem', fontWeight: 700, color: C.success }}>{gotCount}</span>
          <span style={{ fontFamily: SANS, fontSize: '0.7rem', color: C.textMuted, letterSpacing: '0.06em' }}>KNOWN</span>
        </div>
        <div style={{
          flex: 1, padding: '1rem', borderRadius: 14,
          background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.18)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontFamily: SERIF, fontSize: '2rem', fontWeight: 700, color: C.red }}>{missedCount}</span>
          <span style={{ fontFamily: SANS, fontSize: '0.7rem', color: C.textMuted, letterSpacing: '0.06em' }}>MISSED</span>
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 320, damping: 26 }}
        whileTap={{ scale: 0.97 }}
        onClick={onDone}
        style={{
          width: '100%', maxWidth: 340, padding: '1rem',
          background: C.red, color: '#fff', border: 'none', borderRadius: 16,
          fontFamily: SANS, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(230,57,70,0.3)',
        }}
      >
        Back to Home
      </motion.button>

      <button
        onClick={() => router.push('/vocab/study')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: SANS, fontSize: '0.875rem', color: C.textSec,
        }}
      >
        Continue studying →
      </button>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoReviews({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        minHeight: 'calc(100dvh - 72px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1.5rem', gap: '1.25rem', textAlign: 'center',
      }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'rgba(46,204,113,0.12)', border: '1.5px solid rgba(46,204,113,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CheckCircle2 size={28} color={C.success} />
      </div>
      <div>
        <h2 style={{ fontFamily: SERIF, fontSize: '2rem', fontWeight: 700, fontStyle: 'italic', color: C.textPrim }}>
          All caught up
        </h2>
        <p style={{ fontFamily: SANS, fontSize: '0.875rem', color: C.textSec, marginTop: '0.4rem' }}>
          No words due for review right now.
        </p>
      </div>
      <button
        onClick={onBack}
        style={{
          fontFamily: SANS, fontSize: '0.875rem', color: C.red,
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        ← Go back
      </button>
    </motion.div>
  );
}

// ─── Main ReviewScreen ────────────────────────────────────────────────────────

export default function ReviewScreen({ words, dueCount }: Props) {
  const router        = useRouter();
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped]   = useState(false);
  const [ratings, setRatings]   = useState<Record<number, Rating>>({});
  const [done, setDone]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection]   = useState(1);

  const current  = words[idx];
  const progress = ((idx) / words.length) * 100;

  const gotCount    = Object.values(ratings).filter(r => r === 'got_it').length;
  const missedCount = Object.values(ratings).filter(r => r === 'missed_it').length;

  const handleRate = useCallback(async (rating: Rating) => {
    if (submitting) return;
    setSubmitting(true);
    setRatings(r => ({ ...r, [current.wordId]: rating }));

    try {
      await fetch('/api/vocab/practice/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: current.wordId, rating }),
      });
    } catch { /* non-fatal */ }

    setSubmitting(false);

    if (idx === words.length - 1) {
      setDone(true);
    } else {
      setDirection(1);
      setIdx(i => i + 1);
      setFlipped(false);
    }
  }, [current, idx, words.length, submitting]);

  if (words.length === 0) return <NoReviews onBack={() => router.back()} />;

  if (done) {
    return (
      <ReviewComplete
        total={words.length}
        gotCount={gotCount}
        missedCount={missedCount}
        onDone={() => router.push('/vocab/home')}
      />
    );
  }

  return (
    <div style={{
      minHeight: 'calc(100dvh - 72px)',
      display: 'flex', flexDirection: 'column',
      padding: '1rem 1.25rem 1.5rem',
      maxWidth: 680,
      marginLeft: 'auto', marginRight: 'auto',
      width: '100%',
    }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <ArrowLeft size={16} />
          <span style={{ fontFamily: SANS, fontSize: '0.8125rem' }}>Review</span>
        </button>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: SANS, fontSize: '0.75rem', color: C.textMuted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            SRS Review
          </p>
          <p style={{ fontFamily: SANS, fontSize: '0.875rem', fontWeight: 600, color: C.textPrim }}>
            {idx + 1} <span style={{ color: C.textMuted, fontWeight: 400 }}>/ {words.length}</span>
          </p>
        </div>

        <div style={{ width: 56 }} /> {/* spacer */}
      </div>

      {/* ── Progress bar ────────────────────────────────────────────── */}
      <div style={{ height: 3, background: C.elevated, borderRadius: 4, marginBottom: '1.25rem', overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 4, background: C.gold, boxShadow: '0 0 6px rgba(244,168,40,0.5)' }}
        />
      </div>

      {/* ── Flashcard ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.wordId}
          initial={{ opacity: 0, x: direction * 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -direction * 22 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
        >
          {/* Front: word + POS + level */}
          <div
            onClick={() => setFlipped(f => !f)}
            style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: '1.75rem 1.5rem',
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              minHeight: 140,
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
            }}
          >
            {/* ambient glow */}
            <div aria-hidden style={{
              position: 'absolute', top: '-40%', right: '-10%',
              width: '60%', height: '120%',
              background: 'radial-gradient(circle, rgba(244,168,40,0.07) 0%, transparent 70%)',
              filter: 'blur(20px)',
              pointerEvents: 'none',
            }} />

            {/* Level badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: SANS, fontSize: '0.65rem', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '0.2rem 0.6rem', borderRadius: 20,
                background: LEVEL_COLORS[current.masteryLevel] ?? 'rgba(180,180,180,0.15)',
                color: LEVEL_TEXT[current.masteryLevel] ?? C.textMuted,
              }}>
                {current.masteryLevel}
              </span>
              <span style={{ fontFamily: SANS, fontSize: '0.7rem', color: C.textMuted, fontStyle: 'italic' }}>
                {current.partOfSpeech}
              </span>
            </div>

            {/* Word */}
            <h2 style={{
              fontFamily: SERIF,
              fontSize: 'clamp(2rem, 7vw, 2.8rem)',
              fontWeight: 700,
              color: C.textPrim,
              lineHeight: 1,
              position: 'relative',
            }}>
              {current.word}
            </h2>

            {/* Tap hint */}
            {!flipped && (
              <p style={{ fontFamily: SANS, fontSize: '0.7rem', color: C.textMuted, marginTop: 'auto' }}>
                Tap to reveal definition
              </p>
            )}
          </div>

          {/* Back: definition + example */}
          <AnimatePresence>
            {flipped && (
              <motion.div
                key="back"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 16, padding: '1.25rem 1.5rem',
                  display: 'flex', flexDirection: 'column', gap: '0.75rem',
                }}
              >
                <p style={{ fontFamily: SERIF, fontSize: '1.1rem', color: C.textPrim, lineHeight: 1.6 }}>
                  {current.definition}
                </p>
                {current.exampleSentence && (
                  <p style={{
                    fontFamily: SERIF, fontSize: '0.9375rem', fontStyle: 'italic',
                    color: C.textSec, lineHeight: 1.65,
                    borderLeft: `2px solid ${C.border}`,
                    paddingLeft: '0.75rem',
                  }}>
                    &ldquo;{current.exampleSentence}&rdquo;
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* ── Rating buttons ──────────────────────────────────────────── */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            key="rating-btns"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            style={{ display: 'flex', gap: 10, marginTop: '1rem' }}
          >
            {/* Missed it */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => handleRate('missed_it')}
              disabled={submitting}
              style={{
                flex: 1, padding: '0.875rem 0.5rem',
                background: 'rgba(230,57,70,0.08)',
                border: '1.5px solid rgba(230,57,70,0.25)',
                borderRadius: 14, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <XCircle size={20} color={C.red} />
              <span style={{ fontFamily: SANS, fontSize: '0.7rem', fontWeight: 600, color: C.red, letterSpacing: '0.04em' }}>
                Missed
              </span>
            </motion.button>

            {/* Unsure */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => handleRate('unsure')}
              disabled={submitting}
              style={{
                flex: 1, padding: '0.875rem 0.5rem',
                background: 'rgba(244,168,40,0.08)',
                border: '1.5px solid rgba(244,168,40,0.25)',
                borderRadius: 14, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <HelpCircle size={20} color={C.gold} />
              <span style={{ fontFamily: SANS, fontSize: '0.7rem', fontWeight: 600, color: C.gold, letterSpacing: '0.04em' }}>
                Unsure
              </span>
            </motion.button>

            {/* Got it */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => handleRate('got_it')}
              disabled={submitting}
              style={{
                flex: 1.4, padding: '0.875rem 0.5rem',
                background: 'rgba(46,204,113,0.08)',
                border: '1.5px solid rgba(46,204,113,0.25)',
                borderRadius: 14, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <CheckCircle2 size={20} color={C.success} />
              <span style={{ fontFamily: SANS, fontSize: '0.7rem', fontWeight: 600, color: C.success, letterSpacing: '0.04em' }}>
                Got it
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
