'use client';

import { motion } from 'framer-motion';

interface Props {
  deadline: Date;
  wordsPerDay: number;
  onNext: () => void;
}

const TOTAL_WORDS = 100;
const REVIEWS_PER_WORD = 3;

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(d: Date): number {
  return Math.max(1, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

const spring = { type: 'spring' as const, stiffness: 320, damping: 26 };

export default function StepProjection({ deadline, wordsPerDay, onNext }: Props) {
  const days       = daysUntil(deadline);
  const totalSess  = Math.ceil((TOTAL_WORDS * REVIEWS_PER_WORD) / Math.max(1, wordsPerDay));
  const pct        = Math.min(100, Math.round((totalSess / days) * 100));

  // How many days of the bar to fill — proportionally to totalSess vs days
  const barFill = Math.min(1, totalSess / days);

  const stats = [
    { label: 'Days away',      value: days.toString(),                         color: 'var(--color-lx-accent-red)' },
    { label: 'Words / day',    value: `~${wordsPerDay}`,                        color: 'var(--color-lx-accent-gold)' },
    { label: 'Done before day', value: `Day ${Math.min(totalSess, days)}`,      color: 'var(--color-lx-success)' },
  ];

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <p
          style={{
            fontFamily:    "'Sora', sans-serif",
            fontSize:      '0.65rem',
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color:         'var(--color-lx-text-muted)',
          }}
        >
          Your Plan
        </p>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   '1.95rem',
            fontWeight: 700,
            fontStyle:  'italic',
            lineHeight: 1.1,
            color:      'var(--color-lx-text-primary)',
            margin:     0,
          }}
        >
          100 words, mastered<br />
          <span style={{ color: 'var(--color-lx-accent-red)' }}>before exam day.</span>
        </h2>
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '0.82rem',
            color:      'var(--color-lx-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          Target: <strong style={{ color: 'var(--color-lx-text-primary)' }}>{formatDate(deadline)}</strong>
        </p>
      </div>

      {/* Stat trio */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, ...spring }}
            className="flex flex-col items-center gap-1 rounded-xl py-3 px-2 text-center"
            style={{
              background: 'var(--color-lx-surface)',
              border:     '1px solid var(--color-lx-border)',
            }}
          >
            <span
              style={{
                fontFamily:   "'Cormorant Garamond', Georgia, serif",
                fontSize:     'clamp(1.05rem, 4.2vw, 1.55rem)',
                fontWeight:   700,
                lineHeight:   1,
                color:        s.color,
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                maxWidth:     '100%',
              }}
            >
              {s.value}
            </span>
            <span
              style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   '0.55rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color:      'var(--color-lx-text-muted)',
              }}
            >
              {s.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Timeline bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, ...spring }}
        className="flex flex-col gap-2 rounded-xl p-4"
        style={{
          background: 'var(--color-lx-surface)',
          border:     '1px solid var(--color-lx-border)',
        }}
      >
        <div className="flex items-center justify-between">
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize:   '0.65rem',
              fontWeight: 600,
              color:      'var(--color-lx-text-muted)',
            }}
          >
            Today
          </span>
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize:   '0.65rem',
              fontWeight: 600,
              color:      'var(--color-lx-text-muted)',
            }}
          >
            {formatDate(deadline)}
          </span>
        </div>

        {/* Progress track */}
        <div
          className="relative h-2.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--color-lx-elevated)' }}
        >
          {/* All-reviews-done marker */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: barFill }}
            transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background:      'linear-gradient(90deg, var(--color-lx-study) 0%, var(--color-lx-success) 100%)',
              transformOrigin: 'left',
            }}
          />
        </div>

        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '0.72rem',
            color:      'var(--color-lx-text-secondary)',
            lineHeight: 1.4,
          }}
        >
          At ~{wordsPerDay} words/day you&apos;ll review all 100 words{' '}
          <strong style={{ color: 'var(--color-lx-success)' }}>
            {pct < 100 ? `${pct}%` : '100%'}
          </strong>{' '}
          before your exam. Stick to your daily sessions.
        </p>
      </motion.div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, ...spring }}
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        className="w-full rounded-[10px] py-4 text-lg font-semibold text-white"
        style={{
          background: 'linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)',
          fontFamily: "'Sora', sans-serif",
          boxShadow:  '0 4px 20px rgba(230,57,70,0.35)',
        }}
      >
        See how it works →
      </motion.button>
    </div>
  );
}
