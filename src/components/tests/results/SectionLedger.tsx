'use client';

import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { SectionScore } from '@/lib/tests/types';

interface Props {
  sections: SectionScore[];
}

const rowVariants: Variants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 90, damping: 16 } },
};

// ─── Percentage bar ───────────────────────────────────────────────────────────

function PctBar({ pct, passed }: { pct: number; passed: boolean | null }) {
  const color = passed === false
    ? 'var(--color-exam-danger)'
    : passed === true
      ? 'var(--color-exam-success)'
      : 'var(--color-exam-gold)';

  return (
    <div className="h-1.5 rounded-full bg-[var(--color-exam-border)] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ type: 'spring' as const, stiffness: 60, damping: 20, delay: 0.2 }}
      />
    </div>
  );
}

// ─── Pass/fail chip ───────────────────────────────────────────────────────────

function PassChip({ passed }: { passed: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: passed
          ? 'color-mix(in srgb, var(--color-exam-success) 15%, transparent)'
          : 'color-mix(in srgb, var(--color-exam-danger) 15%, transparent)',
        border: `1px solid ${passed ? 'var(--color-exam-success)' : 'var(--color-exam-danger)'}40`,
        color: passed ? 'var(--color-exam-success)' : 'var(--color-exam-danger)',
      }}
    >
      {passed ? '✓ Pass' : '✗ Below cut-off'}
    </span>
  );
}

// ─── Section row ─────────────────────────────────────────────────────────────

function SectionRow({ s }: { s: SectionScore }) {
  const pct = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;

  return (
    <motion.div
      variants={rowVariants}
      className="border-b border-[var(--color-exam-border)] last:border-0 py-4 px-5"
    >
      {/* Title + threshold chip row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[var(--color-exam-ink)] font-medium text-sm flex-1 min-w-0 truncate">
          {s.title}
        </span>
        {s.passed !== null && <PassChip passed={s.passed} />}
      </div>

      {/* Three columns: score / stats / percentage */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm mb-3">
        <div>
          <span className="text-[var(--color-exam-ink-faint)] text-xs block mb-0.5">Score</span>
          <span className="text-[var(--color-exam-ink)] font-semibold">
            {s.score % 1 === 0 ? s.score : s.score.toFixed(2)}
            <span className="text-[var(--color-exam-ink-faint)] font-normal"> / {s.maxScore}</span>
          </span>
        </div>
        <div>
          <span className="text-[var(--color-exam-ink-faint)] text-xs block mb-0.5">Correct</span>
          <span className="text-[var(--color-exam-success)] font-semibold">{s.correct}</span>
        </div>
        <div>
          <span className="text-[var(--color-exam-ink-faint)] text-xs block mb-0.5">Wrong</span>
          <span className="text-[var(--color-exam-danger)] font-semibold">{s.wrong}</span>
        </div>
        <div>
          <span className="text-[var(--color-exam-ink-faint)] text-xs block mb-0.5">Skipped</span>
          <span className="text-[var(--color-exam-ink-muted)] font-semibold">{s.unattempted}</span>
        </div>
      </div>

      {/* Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <PctBar pct={pct} passed={s.passed} />
        </div>
        <span
          className="text-xs font-medium shrink-0 w-10 text-right"
          style={{
            color: s.passed === false
              ? 'var(--color-exam-danger)'
              : s.passed === true
                ? 'var(--color-exam-success)'
                : 'var(--color-exam-ink-muted)',
          }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>

      {/* Threshold hint */}
      {s.thresholdPercent !== null && (
        <p className="mt-2 text-[var(--color-exam-ink-faint)] text-xs">
          Cut-off: {s.thresholdPercent}%
        </p>
      )}
    </motion.div>
  );
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

export default function SectionLedger({ sections }: Props) {
  return (
    <div>
      <h2
        className="text-[var(--color-exam-ink-faint)] text-xs tracking-[0.18em] uppercase mb-4"
      >
        Section Ledger
      </h2>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--color-exam-surface)',
          border: '1px solid var(--color-exam-border)',
        }}
      >
        {sections.map((s) => (
          <SectionRow key={s.sectionId} s={s} />
        ))}
      </div>
    </div>
  );
}
