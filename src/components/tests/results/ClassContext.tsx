'use client';

import { motion } from 'framer-motion';
import type { ResultsPayload } from '@/lib/tests/types';

type ClassStats = ResultsPayload['classStats'];
type Test = ResultsPayload['test'];

interface Props {
  classStats: ClassStats;
  myScore: number | null;
  test: Test;
}

interface MarkerProps {
  pct: number;
  label: string;
  color: string;
  isMe?: boolean;
}

// ─── Distribution strip ───────────────────────────────────────────────────────

function DistributionStrip({ classStats, myScore, totalMarks }: {
  classStats: ClassStats;
  myScore: number | null;
  totalMarks: number;
}) {
  const { lowest, highest, averageScore, top5Average } = classStats;
  const range = Math.max(highest - lowest, 1);

  function pct(score: number): number {
    return Math.min(Math.max(((score - lowest) / range) * 100, 0), 100);
  }

  const markers: MarkerProps[] = [
    { pct: pct(averageScore), label: `Avg ${averageScore.toFixed(1)}`, color: 'var(--color-exam-gold)' },
    { pct: pct(top5Average), label: `Top-5 ${top5Average.toFixed(1)}`, color: 'var(--color-exam-gold-bright)' },
  ];
  if (myScore !== null) {
    markers.push({ pct: pct(myScore), label: `You ${myScore % 1 === 0 ? myScore : myScore.toFixed(2)}`, color: 'var(--color-exam-maroon-bright)', isMe: true });
  }

  return (
    <div className="mt-6 mb-2 px-2">
      <div className="relative h-3 rounded-full" style={{ background: 'var(--color-exam-elevated)' }}>
        {/* Gradient fill from lowest to highest */}
        <div
          className="absolute inset-0 rounded-full opacity-40"
          style={{ background: 'linear-gradient(90deg, var(--color-exam-ink-faint) 0%, var(--color-exam-gold) 100%)' }}
        />

        {/* Markers */}
        {markers.map((m) => (
          <div
            key={m.label}
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `${m.pct}%`, transform: `translateX(-50%) translateY(-50%)` }}
          >
            <motion.div
              className="relative"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring' as const, stiffness: 100, damping: 16, delay: 0.3 }}
            >
              {/* Pin */}
              <div
                className="w-3 h-3 rounded-full border-2"
                style={{
                  background: m.color,
                  borderColor: m.isMe ? 'var(--color-exam-ink)' : 'var(--color-exam-surface)',
                  boxShadow: m.isMe ? `0 0 8px ${m.color}` : 'none',
                }}
              />
              {/* Label below */}
              <div
                className="absolute top-5 left-1/2 -translate-x-1/2 text-nowrap text-xs font-medium"
                style={{ color: m.color }}
              >
                {m.label}
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between mt-9 text-xs text-[var(--color-exam-ink-faint)]">
        <span>Low {lowest % 1 === 0 ? lowest : lowest.toFixed(1)}</span>
        <span>High {highest % 1 === 0 ? highest : highest.toFixed(1)}</span>
      </div>

      <p className="mt-1 text-[var(--color-exam-ink-faint)] text-xs text-center">
        {classStats.totalStudents} students · {totalMarks} total marks
      </p>
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center py-3 px-4 rounded-lg"
      style={{ background: 'var(--color-exam-elevated)', border: '1px solid var(--color-exam-border)' }}
    >
      <span className="text-[var(--color-exam-ink)] font-semibold text-lg">{value}</span>
      <span className="text-[var(--color-exam-ink-faint)] text-xs mt-0.5">{label}</span>
    </div>
  );
}

// ─── ClassContext ─────────────────────────────────────────────────────────────

export default function ClassContext({ classStats, myScore, test }: Props) {
  return (
    <div>
      <h2 className="text-[var(--color-exam-ink-faint)] text-xs tracking-[0.18em] uppercase mb-4">
        Class Context
      </h2>
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--color-exam-surface)', border: '1px solid var(--color-exam-border)' }}
      >
        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatPill label="Class Avg"    value={classStats.averageScore.toFixed(1)} />
          <StatPill label="Top-5 Avg"   value={classStats.top5Average.toFixed(1)} />
          <StatPill label="Highest"      value={String(classStats.highest % 1 === 0 ? classStats.highest : classStats.highest.toFixed(2))} />
          <StatPill label="Students"     value={String(classStats.totalStudents)} />
        </div>

        {/* Distribution strip */}
        <DistributionStrip
          classStats={classStats}
          myScore={myScore}
          totalMarks={test.totalMarks}
        />
      </div>
    </div>
  );
}
