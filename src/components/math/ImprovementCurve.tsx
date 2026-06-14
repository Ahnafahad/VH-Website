'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { DashboardCurvePoint } from './dashboard-types';

export interface ImprovementCurveProps {
  curve: DashboardCurvePoint[];
}

const VIEW_W = 720;
const VIEW_H = 240;
const PAD_L  = 44;
const PAD_R  = 24;
const PAD_T  = 20;
const PAD_B  = 32;

function xAt(i: number, n: number): number {
  if (n <= 1) return (VIEW_W - PAD_L - PAD_R) / 2 + PAD_L;
  return PAD_L + (i / (n - 1)) * (VIEW_W - PAD_L - PAD_R);
}

function yAccuracy(v: number): number {
  // v is 0–100 → map to plot band
  const t = v / 100;
  return PAD_T + (1 - t) * (VIEW_H - PAD_T - PAD_B);
}

function yScore(v: number, maxScore: number): number {
  const safeMax = Math.max(1, maxScore);
  const t = v / safeMax;
  return PAD_T + (1 - t) * (VIEW_H - PAD_T - PAD_B);
}

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

export function ImprovementCurve({ curve }: ImprovementCurveProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const maxScore = useMemo(() => {
    return curve.reduce((m, p) => Math.max(m, p.score), 0);
  }, [curve]);

  if (curve.length === 0) {
    return (
      <section className="relative rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-8 math-card-shadow">
        <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-2">
          Figure II
        </div>
        <h3 className="font-heading text-2xl font-light text-[var(--color-math-ink)] mb-6">
          Arc of improvement
        </h3>
        <p className="font-sans text-sm text-[var(--color-math-ink-muted)]">
          No sessions yet. Your first finished game lights up this chart.
        </p>
      </section>
    );
  }

  const n = curve.length;

  const accPath = curve.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i, n).toFixed(1)} ${yAccuracy(p.accuracy).toFixed(1)}`).join(' ');
  const scrPath = curve.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i, n).toFixed(1)} ${yScore(p.score, maxScore).toFixed(1)}`).join(' ');

  // Mouse handler — map x coord to nearest session index.
  const onMove = (evt: React.PointerEvent<SVGSVGElement>) => {
    const svg = evt.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xPx = evt.clientX - rect.left;
    const xView = (xPx / rect.width) * VIEW_W;
    const plotRange = VIEW_W - PAD_L - PAD_R;
    const rel = (xView - PAD_L) / plotRange;
    const idx = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
    setHoverIdx(idx);
  };

  const hovered = hoverIdx != null ? curve[hoverIdx] : null;

  return (
    <section
      className="relative rounded-2xl border border-[var(--color-math-border)] bg-[var(--color-math-surface)]/80 backdrop-blur-sm p-6 sm:p-8 math-card-shadow overflow-hidden"
      aria-labelledby="curve-title"
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-sans text-[10px] tracking-[0.3em] uppercase text-[var(--color-math-accent-gold)] mb-2">
            Figure II
          </div>
          <h3 id="curve-title" className="font-heading text-2xl sm:text-3xl font-light text-[var(--color-math-ink)] tracking-[-0.01em]">
            Arc of improvement
          </h3>
        </div>
        <div className="flex items-center gap-4 font-sans text-xs text-[var(--color-math-ink-muted)]">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 bg-[var(--color-math-accent-gold)]" /> Accuracy
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 bg-[var(--color-math-accent-violet)]" /> Score
          </span>
        </div>
      </header>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-auto"
          role="img"
          aria-label={`Improvement across ${n} recent sessions`}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverIdx(null)}
        >
          {/* Hairline horizontal grid (0, 50, 100) */}
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line
                x1={PAD_L} x2={VIEW_W - PAD_R}
                y1={yAccuracy(v)} y2={yAccuracy(v)}
                stroke="var(--color-math-border)"
                strokeWidth={0.5}
                strokeDasharray={v === 0 ? '0' : '2,4'}
              />
              <text
                x={PAD_L - 8} y={yAccuracy(v) + 3}
                textAnchor="end"
                className="math-digit"
                fontSize={10}
                fill="var(--color-math-ink-faint)"
              >
                {v}
              </text>
            </g>
          ))}

          {/* Score line (violet) */}
          <motion.path
            d={scrPath}
            fill="none"
            stroke="var(--color-math-accent-violet)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Accuracy line (gold) */}
          <motion.path
            d={accPath}
            fill="none"
            stroke="var(--color-math-accent-gold)"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Dots */}
          {curve.map((p, i) => {
            const cx = xAt(i, n);
            const cyAcc = yAccuracy(p.accuracy);
            const cySc  = yScore(p.score, maxScore);
            const active = hoverIdx === i;
            return (
              <g key={p.sessionId}>
                <circle
                  cx={cx} cy={cySc}
                  r={active ? 4 : 2.5}
                  fill="var(--color-math-accent-violet)"
                  stroke="var(--color-math-base)"
                  strokeWidth={1}
                />
                <circle
                  cx={cx} cy={cyAcc}
                  r={active ? 5 : 3}
                  fill="var(--color-math-accent-gold)"
                  stroke="var(--color-math-base)"
                  strokeWidth={1}
                />
                {active && (
                  <line
                    x1={cx} x2={cx}
                    y1={PAD_T} y2={VIEW_H - PAD_B}
                    stroke="var(--color-math-accent-gold)"
                    strokeOpacity={0.3}
                    strokeWidth={0.5}
                    strokeDasharray="2,3"
                  />
                )}
              </g>
            );
          })}

          {/* X-axis: first/last date */}
          <text
            x={PAD_L} y={VIEW_H - 10}
            className="math-digit"
            fontSize={9}
            fill="var(--color-math-ink-faint)"
          >
            {shortDate(curve[0].finishedAt)}
          </text>
          {n > 1 && (
            <text
              x={VIEW_W - PAD_R} y={VIEW_H - 10}
              textAnchor="end"
              className="math-digit"
              fontSize={9}
              fill="var(--color-math-ink-faint)"
            >
              {shortDate(curve[n - 1].finishedAt)}
            </text>
          )}
        </svg>

        {/* Tooltip */}
        <div role="status" aria-live="polite" className="mt-4 min-h-[2.5rem] border-t border-[var(--color-math-border)] pt-4">
          <AnimatePresence mode="wait">
            {hovered ? (
              <motion.div
                key={hovered.sessionId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
                className="flex flex-wrap items-baseline gap-5 font-sans text-xs text-[var(--color-math-ink-muted)]"
              >
                <span className="font-heading text-sm text-[var(--color-math-ink)]">
                  {shortDate(hovered.finishedAt)}
                </span>
                <span>
                  Score{' '}
                  <span className="math-digit text-[var(--color-math-accent-violet)]">
                    {hovered.score}
                  </span>
                </span>
                <span>
                  Accuracy{' '}
                  <span className="math-digit text-[var(--color-math-accent-gold)]">
                    {hovered.accuracy}%
                  </span>
                </span>
              </motion.div>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-sans text-xs text-[var(--color-math-ink-faint)]"
              >
                Hover the chart for per-session detail.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
