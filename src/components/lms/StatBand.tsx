'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import type { DashboardClassPulse, DashboardResults, DashboardGames } from '@/lib/lms/dashboard-data';

interface Props {
  classPulse: DashboardClassPulse;
  results: DashboardResults;
  games: DashboardGames;
}

function useCountUp(target: number | null, duration = 600) {
  const ref = useRef<HTMLSpanElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (target === null || prefersReduced) {
      if (ref.current) ref.current.textContent = target === null ? '—' : formatNum(target);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.round(eased * target);
      el.textContent = formatNum(value);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, prefersReduced]);

  return ref;
}

function formatNum(n: number): string {
  return n.toLocaleString('en-US');
}

interface StatCellProps {
  value: number | null;
  display?: string; // override rendered value (e.g. "92%", "#4 / 31")
  label: string;
  secondary?: string; // smaller suffix after main value
}

function StatCell({ value, display, label, secondary }: StatCellProps) {
  const countRef = useCountUp(display ? null : value);

  return (
    <div className="flex flex-col items-start justify-end gap-1 px-6 py-5">
      <div className="flex items-baseline gap-1">
        {display ? (
          <span
            className="font-heading font-medium text-5xl sm:text-6xl leading-none text-[#FAF5EF]"
            style={{ letterSpacing: '-0.02em' }}
          >
            {display === '—' ? (
              <span style={{ color: 'rgba(250,245,239,0.40)' }}>—</span>
            ) : (
              display
            )}
          </span>
        ) : value === null ? (
          <span
            className="font-heading font-medium text-5xl sm:text-6xl leading-none"
            style={{ color: 'rgba(250,245,239,0.40)', letterSpacing: '-0.02em' }}
          >
            —
          </span>
        ) : (
          <span
            ref={countRef}
            className="font-heading font-medium text-5xl sm:text-6xl leading-none text-[#FAF5EF]"
            style={{ letterSpacing: '-0.02em' }}
          >
            {formatNum(value)}
          </span>
        )}
        {secondary && (
          <span
            className="font-heading font-medium text-2xl sm:text-3xl leading-none"
            style={{ color: 'rgba(250,245,239,0.40)', letterSpacing: '-0.01em' }}
          >
            {secondary}
          </span>
        )}
      </div>
      <span
        className="text-xs lowercase"
        style={{ color: 'rgba(250,245,239,0.40)' }}
      >
        {label}
      </span>
    </div>
  );
}

export default function StatBand({ classPulse, results, games }: Props) {
  const latestResult = results.latest;
  const rankDisplay =
    latestResult
      ? `#${latestResult.rank}`
      : null;
  const rankSecondary =
    latestResult
      ? ` / ${latestResult.totalStudents}`
      : undefined;

  const attendanceDisplay =
    classPulse.attendanceRate !== null
      ? `${classPulse.attendanceRate}%`
      : null;

  const streakValue = games.vocab?.streakDays ?? 0;
  const vocabPoints = games.vocab?.totalPoints ?? null;

  return (
    <div
      className="w-full"
      style={{
        borderTop: '1px solid rgba(212,176,148,0.16)',
        borderBottom: '1px solid rgba(212,176,148,0.16)',
      }}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {/* Attendance */}
        <div style={{ borderRight: '1px solid rgba(212,176,148,0.16)' }}>
          <StatCell
            value={null}
            display={attendanceDisplay ?? '—'}
            label="attendance"
          />
        </div>

        {/* Last rank — right hairline only on lg (it's the outer edge on mobile) */}
        <div className="lg:[border-right:1px_solid_rgba(212,176,148,0.16)]">
          {latestResult ? (
            <div className="flex flex-col items-start justify-end gap-1 px-6 py-5">
              <div className="flex items-baseline gap-1">
                <span
                  className="font-heading font-medium text-5xl sm:text-6xl leading-none text-[#FAF5EF]"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {rankDisplay}
                </span>
                <span
                  className="font-heading font-medium text-2xl sm:text-3xl leading-none"
                  style={{ color: 'rgba(250,245,239,0.40)', letterSpacing: '-0.01em' }}
                >
                  {rankSecondary}
                </span>
              </div>
              <span className="text-xs lowercase" style={{ color: 'rgba(250,245,239,0.40)' }}>
                last test rank
              </span>
            </div>
          ) : (
            <StatCell value={null} display="—" label="last test rank" />
          )}
        </div>

        {/* Streak — on mobile this is row 2 col 1 */}
        <div
          className="border-t lg:border-t-0"
          style={{
            borderTop: '1px solid rgba(212,176,148,0.16)',
            borderRight: '1px solid rgba(212,176,148,0.16)',
          }}
        >
          <StatCell value={streakValue} label="day streak" />
        </div>

        {/* Lexicore points */}
        <div
          className="border-t lg:border-t-0"
          style={{ borderTop: '1px solid rgba(212,176,148,0.16)' }}
        >
          <StatCell value={vocabPoints} label="lexicore points" />
        </div>
      </div>
    </div>
  );
}
