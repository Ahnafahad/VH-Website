'use client';

import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { ResultsPayload } from '@/lib/tests/types';
import { BUCKET_LABELS } from '@/lib/tests/types';

type Me = NonNullable<ResultsPayload['me']>;
type Test = ResultsPayload['test'];
type ClassStats = ResultsPayload['classStats'];

interface Props {
  me: Me | null;
  test: Test;
  classStats: ClassStats;
}

// ─── Rank medallion ───────────────────────────────────────────────────────────

function RankMedallion({ rank, total }: { rank: number; total: number }) {
  const isTop3 = rank <= 3;
  const color = rank === 1
    ? 'var(--color-exam-gold-bright)'
    : rank === 2
      ? '#C0C0C0'
      : rank === 3
        ? '#CD7F32'
        : 'var(--color-exam-ink-muted)';

  const medalVariants: Variants = {
    hidden:  { scale: 0, rotate: -20 },
    visible: { scale: 1, rotate: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 12, delay: 0.4 } },
  };

  return (
    <motion.div variants={medalVariants} className="flex flex-col items-center">
      <div
        className="relative w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          border: `2px solid ${color}`,
          background: isTop3
            ? `radial-gradient(circle at 40% 35%, ${color}25, transparent 70%)`
            : 'transparent',
          boxShadow: isTop3 ? `0 0 18px ${color}40` : 'none',
        }}
      >
        <span
          className="font-bold leading-none"
          style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: rank >= 100 ? '18px' : rank >= 10 ? '22px' : '28px',
            color,
          }}
        >
          #{rank}
        </span>
      </div>
      <span className="mt-1.5 text-[var(--color-exam-ink-faint)] text-xs">of {total}</span>
    </motion.div>
  );
}

// ─── Percentile arc ───────────────────────────────────────────────────────────

function PercentileArc({ percentile }: { percentile: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (percentile / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--color-exam-border)" strokeWidth="3" />
        <motion.circle
          cx="30" cy="30" r={r}
          fill="none"
          stroke="var(--color-exam-gold)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ type: 'spring' as const, stiffness: 50, damping: 18, delay: 0.5 }}
          transform="rotate(-90 30 30)"
        />
        <text
          x="30" y="34"
          textAnchor="middle"
          fill="var(--color-exam-ink)"
          fontSize="11"
          fontWeight="600"
        >
          {percentile}%
        </text>
      </svg>
      <span className="text-[var(--color-exam-ink-faint)] text-xs">Percentile</span>
    </div>
  );
}

// ─── Mode chip ───────────────────────────────────────────────────────────────

function ModeChip({ mode }: { mode: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-wide"
      style={{
        background: mode === 'online'
          ? 'color-mix(in srgb, var(--color-exam-maroon) 20%, transparent)'
          : 'color-mix(in srgb, var(--color-exam-gold) 15%, transparent)',
        border: `1px solid ${mode === 'online' ? 'var(--color-exam-maroon-bright)' : 'var(--color-exam-gold)'}40`,
        color: mode === 'online' ? 'var(--color-exam-maroon-bright)' : 'var(--color-exam-gold)',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: mode === 'online' ? 'var(--color-exam-maroon-bright)' : 'var(--color-exam-gold)' }}
      />
      {mode === 'online' ? 'Online' : 'Offline Entry'}
    </span>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

const scoreVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1, scale: 1,
    transition: { type: 'spring' as const, stiffness: 80, damping: 14, delay: 0.15 },
  },
};

export default function ScorecardHero({ me, test, classStats }: Props) {
  const bucketLabel = BUCKET_LABELS[test.bucket] ?? test.bucket.toUpperCase();

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--color-exam-surface) 0%, var(--color-exam-elevated) 100%)',
        border: '1px solid var(--color-exam-border)',
        boxShadow: '0 0 40px var(--color-exam-glow-gold)',
      }}
    >
      {/* Gold glow top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--color-exam-gold), transparent)' }}
      />

      {/* Background watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        aria-hidden
      >
        <span
          style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: 'clamp(80px, 20vw, 160px)',
            color: 'var(--color-exam-gold)',
            opacity: 0.04,
            lineHeight: 1,
          }}
        >
          VH
        </span>
      </div>

      <div className="relative px-6 py-8 sm:px-10 sm:py-12">
        {/* Top row: test label + mode chip */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="text-[var(--color-exam-ink-muted)] text-sm">
            {bucketLabel} — {test.title}
          </span>
          {me && <ModeChip mode={me.mode} />}
        </div>

        {me ? (
          <>
            {/* Score + stats row */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
              {/* Big serif score */}
              <motion.div variants={scoreVariants} className="text-center sm:text-left">
                <div
                  style={{
                    fontFamily: 'Cormorant Garamond, Georgia, serif',
                    fontSize: 'clamp(52px, 12vw, 88px)',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: 'var(--color-exam-ink)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {me.totalScore % 1 === 0
                    ? me.totalScore
                    : me.totalScore.toFixed(2)}
                </div>
                <div className="text-[var(--color-exam-ink-muted)] text-sm mt-1">
                  out of {test.totalMarks}
                </div>
                <div
                  className="text-[var(--color-exam-gold)] font-semibold mt-2"
                  style={{ fontSize: 'clamp(18px, 4vw, 28px)' }}
                >
                  {me.percentage.toFixed(1)}%
                </div>
              </motion.div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-28 bg-[var(--color-exam-border)] self-center" />

              {/* Right cluster: rank + percentile */}
              <div className="flex items-center gap-8 sm:gap-10">
                <RankMedallion rank={me.rank} total={classStats.totalStudents} />
                <PercentileArc percentile={me.percentile} />
              </div>
            </div>

            {/* Quick tally row */}
            <div className="mt-8 grid grid-cols-3 divide-x divide-[var(--color-exam-border)] border border-[var(--color-exam-border)] rounded-xl overflow-hidden">
              {[
                { label: 'Correct',     value: me.totalCorrect,     color: 'var(--color-exam-success)' },
                { label: 'Wrong',       value: me.totalWrong,       color: 'var(--color-exam-danger)'  },
                { label: 'Unattempted', value: me.totalUnattempted, color: 'var(--color-exam-ink-faint)' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex flex-col items-center py-4 gap-1 bg-[var(--color-exam-surface)]"
                >
                  <span className="text-2xl font-bold" style={{ color }}>{value}</span>
                  <span className="text-[var(--color-exam-ink-faint)] text-xs">{label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* No attempt — show neutral placeholder */
          <div className="text-center py-6">
            <p
              className="text-[var(--color-exam-ink-faint)]"
              style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '22px' }}
            >
              No submission on record
            </p>
            <p className="text-[var(--color-exam-ink-muted)] text-sm mt-2">
              {test.title} — {test.totalQuestions} questions, {test.totalMarks} marks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
