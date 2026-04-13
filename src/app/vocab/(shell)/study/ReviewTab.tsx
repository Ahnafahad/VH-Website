'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronDown, BookOpen, Zap } from 'lucide-react';
import type { ReviewData, ReviewWord } from '@/lib/vocab/review-data';

// ─── Design tokens ────────────────────────────────────────────────────────────

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";

const C = {
  surface:   'var(--color-lx-surface)',
  elevated:  'var(--color-lx-elevated)',
  border:    'var(--color-lx-border)',
  red:       'var(--color-lx-accent-red)',
  gold:      'var(--color-lx-accent-gold)',
  textPrim:  'var(--color-lx-text-primary)',
  textSec:   'var(--color-lx-text-secondary)',
  textMuted: 'var(--color-lx-text-muted)',
} as const;

const LEVEL_BG: Record<string, string> = {
  new:      'rgba(180,180,180,0.12)',
  learning: 'rgba(244,168,40,0.15)',
  familiar: 'rgba(56,189,248,0.15)',
  strong:   'rgba(46,204,113,0.15)',
  mastered: 'rgba(230,57,70,0.15)',
};
const LEVEL_TEXT: Record<string, string> = {
  new:      'rgba(160,160,160,0.9)',
  learning: 'var(--color-lx-accent-gold)',
  familiar: '#38bdf8',
  strong:   'var(--color-lx-success)',
  mastered: 'var(--color-lx-accent-red)',
};

// ─── Row animation variant ─────────────────────────────────────────────────────

const rowVariant: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.025, type: 'spring' as const, stiffness: 360, damping: 28 },
  }),
};

// ─── ReviewWordRow ─────────────────────────────────────────────────────────────

type RowVariant = 'due' | 'weak';

function ReviewWordRow({
  w, index, variant,
}: {
  w: ReviewWord;
  index: number;
  variant: RowVariant;
}) {
  const [expanded, setExpanded] = useState(false);

  const metaLabel = variant === 'due'
    ? (w.daysOverdue === 0 ? 'Due today' : `${w.daysOverdue}d overdue`)
    : `${Math.round(w.accuracyRate * 100)}% accuracy`;

  const metaColor = variant === 'due' ? C.gold : C.red;
  const metaBg    = variant === 'due'
    ? 'rgba(244,168,40,0.1)'
    : 'rgba(230,57,70,0.1)';

  return (
    <motion.div
      custom={index}
      variants={rowVariant}
      initial="hidden"
      animate="show"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          padding: '0.8rem 1rem', gap: '0.6rem',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Mastery badge */}
        <span style={{
          fontFamily: SANS, fontSize: '0.58rem', fontWeight: 700,
          letterSpacing: '0.07em', textTransform: 'uppercase',
          padding: '0.18rem 0.45rem', borderRadius: 7, flexShrink: 0,
          background: LEVEL_BG[w.masteryLevel] ?? LEVEL_BG.new,
          color:      LEVEL_TEXT[w.masteryLevel] ?? LEVEL_TEXT.new,
        }}>
          {w.masteryLevel}
        </span>

        {/* Word + POS */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: SERIF, fontSize: '1rem', fontWeight: 600,
            fontStyle: 'italic', color: C.textPrim, lineHeight: 1.2,
          }}>
            {w.word}
          </p>
          <p style={{ fontFamily: SANS, fontSize: '0.65rem', color: C.red, fontStyle: 'italic', marginTop: 1 }}>
            {w.partOfSpeech}
          </p>
        </div>

        {/* Meta tag (overdue / accuracy) */}
        <span style={{
          fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '0.2rem 0.5rem', borderRadius: 8, flexShrink: 0,
          background: metaBg, color: metaColor,
        }}>
          {metaLabel}
        </span>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{ flexShrink: 0 }}
        >
          <ChevronDown size={13} color={C.textMuted} />
        </motion.div>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 1rem 1rem',
              display: 'flex', flexDirection: 'column', gap: '0.4rem',
            }}>
              <p style={{
                fontFamily: SERIF, fontSize: '0.9375rem',
                color: C.textSec, lineHeight: 1.65,
              }}>
                {w.definition}
              </p>
              {w.exampleSentence && (
                <p style={{
                  fontFamily: SERIF, fontSize: '0.875rem', fontStyle: 'italic',
                  color: C.textMuted, lineHeight: 1.6,
                  borderLeft: `2px solid ${C.border}`, paddingLeft: '0.75rem',
                }}>
                  &ldquo;{w.exampleSentence}&rdquo;
                </p>
              )}
              {/* Extra stats row */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: SANS, fontSize: '0.6rem', color: C.textMuted }}>
                  {w.totalAttempts} attempt{w.totalAttempts !== 1 ? 's' : ''}
                </span>
                {w.consecutiveWrong > 0 && (
                  <span style={{ fontFamily: SANS, fontSize: '0.6rem', color: C.red }}>
                    {w.consecutiveWrong} wrong in a row
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionDivider({
  label, count, accent,
}: {
  label: string; count: number; accent: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      margin: '0.25rem 0 0.75rem',
    }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{
        fontFamily: SANS, fontSize: '0.625rem', fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: accent, whiteSpace: 'nowrap',
      }}>
        {label} · {count}
      </span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

// ─── CTA row ──────────────────────────────────────────────────────────────────

function CtaRow({
  wordIds, count,
}: {
  wordIds: number[]; count: number;
}) {
  const router = useRouter();
  const ids = wordIds.join(',');

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: '0.5rem' }}>
      {/* Study — outlined */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => router.push(`/vocab/study/review?wordIds=${ids}`)}
        style={{
          flex: 1, padding: '0.75rem 0.5rem',
          background: 'transparent',
          border: `1px solid ${C.border}`,
          borderRadius: 13, cursor: 'pointer',
          fontFamily: SANS, fontSize: '0.8125rem', fontWeight: 600,
          color: C.textSec,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
        }}
      >
        <BookOpen size={13} />
        Study {count}
      </motion.button>

      {/* Quiz — solid red */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => router.push(`/vocab/practice/quiz?wordIds=${ids}`)}
        style={{
          flex: 1, padding: '0.75rem 0.5rem',
          background: C.red,
          border: 'none',
          borderRadius: 13, cursor: 'pointer',
          fontFamily: SANS, fontSize: '0.8125rem', fontWeight: 600,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          boxShadow: '0 3px 14px rgba(230,57,70,0.25)',
        }}
      >
        <Zap size={13} />
        Quiz {count}
      </motion.button>
    </div>
  );
}

// ─── ReviewSection ────────────────────────────────────────────────────────────

function ReviewSection({
  label, words, variant, accent, emptyMessage,
}: {
  label:        string;
  words:        ReviewWord[];
  variant:      RowVariant;
  accent:       string;
  emptyMessage: string;
}) {
  if (words.length === 0) {
    return (
      <>
        <SectionDivider label={label} count={0} accent={accent} />
        <p style={{
          fontFamily: SERIF, fontSize: '0.9rem', fontStyle: 'italic',
          color: C.textMuted, textAlign: 'center', padding: '0.5rem 0 1rem',
        }}>
          {emptyMessage}
        </p>
      </>
    );
  }

  const wordIds = words.map(w => w.wordId);

  return (
    <>
      <SectionDivider label={label} count={words.length} accent={accent} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {words.map((w, i) => (
          <ReviewWordRow key={w.wordId} w={w} index={i} variant={variant} />
        ))}
      </div>
      <CtaRow wordIds={wordIds} count={words.length} />
    </>
  );
}

// ─── ReviewTab ────────────────────────────────────────────────────────────────

interface Props {
  reviewData: ReviewData;
}

export default function ReviewTab({ reviewData }: Props) {
  const { dueWords, weakWords } = reviewData;
  const bothEmpty = dueWords.length === 0 && weakWords.length === 0;

  // Both empty — full editorial empty state
  if (bothEmpty) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '3rem 1rem',
          gap: '0.75rem',
        }}
      >
        {/* Decorative ring */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '0.5rem',
          background: 'rgba(244,168,40,0.06)',
        }}>
          <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>◇</span>
        </div>
        <h3 style={{
          fontFamily: SERIF, fontSize: '1.5rem', fontWeight: 700, fontStyle: 'italic',
          color: C.textPrim, textAlign: 'center', lineHeight: 1.2,
        }}>
          All words reviewed
        </h3>
        <p style={{
          fontFamily: SANS, fontSize: '0.8rem', color: C.textMuted,
          textAlign: 'center', lineHeight: 1.6, maxWidth: 260,
        }}>
          Come back tomorrow — your spaced repetition queue will be ready.
        </p>
      </motion.div>
    );
  }

  const totalCount = dueWords.length + weakWords.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {/* Summary bar */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 0.875rem',
          background: 'rgba(244,168,40,0.06)',
          border: '1px solid rgba(244,168,40,0.15)',
          borderRadius: 12,
          marginBottom: '0.5rem',
        }}
      >
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: C.gold, flexShrink: 0,
          boxShadow: `0 0 6px ${C.gold}`,
        }} />
        <span style={{
          fontFamily: SANS, fontSize: '0.75rem', fontWeight: 500,
          color: C.textSec,
        }}>
          {dueWords.length > 0 && (
            <span>
              <span style={{ color: C.gold, fontWeight: 700 }}>{dueWords.length}</span>
              {' '}due today
            </span>
          )}
          {dueWords.length > 0 && weakWords.length > 0 && (
            <span style={{ color: C.textMuted }}> · </span>
          )}
          {weakWords.length > 0 && (
            <span>
              <span style={{ color: C.red, fontWeight: 700 }}>{weakWords.length}</span>
              {' '}struggling
            </span>
          )}
        </span>
      </motion.div>

      {/* Due for Review section */}
      <ReviewSection
        label="Due for Review"
        words={dueWords}
        variant="due"
        accent={C.gold}
        emptyMessage="No words due for review right now."
      />

      {/* Spacer between sections */}
      {dueWords.length > 0 && weakWords.length > 0 && (
        <div style={{ height: '0.75rem' }} />
      )}

      {/* Struggling section */}
      <ReviewSection
        label="Struggling"
        words={weakWords}
        variant="weak"
        accent={C.red}
        emptyMessage="No struggling words detected yet."
      />
    </div>
  );
}
