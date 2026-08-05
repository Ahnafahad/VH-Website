'use client';

// ─── Shared "15 metrics" panel ──────────────────────────────────────────────
// Renders the 11 non-LexiCore metrics (student-metrics-pure.ts) + the 4
// LexiCore metrics (progress-types.ts LexicoreBreakdown). Used by BOTH the
// admin student-detail page and the student-facing mirror on their own
// dashboard — same computation, same component, no forked logic.

import React from 'react';
import StatCard from '@/components/admin/analytics/StatCard';
import ChartCard from '@/components/admin/analytics/ChartCard';
import { fmtNum, fmtPct } from '@/components/admin/analytics/formatters';
import type { StudentMetrics } from '@/lib/students/student-metrics-pure';
import type { LexicoreBreakdown } from '@/lib/students/progress-types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface Props {
  metrics: StudentMetrics;
  lexicore: LexicoreBreakdown;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function StudentMetricsPanel({ metrics, lexicore }: Props) {
  const hasTests = metrics.testsAttempted > 0;

  const marksData = metrics.marksTrend.map(p => ({
    date: formatShortDate(p.submittedAt),
    percentage: Math.round(p.percentage * 10) / 10,
  }));
  const rankData = metrics.rankTrend.map(p => ({
    date: formatShortDate(p.submittedAt),
    rank: p.rank,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Headline stats (7 of the 11 non-LexiCore metrics) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard label="Test Average" value={fmtPct(metrics.testAveragePercent, 0)} accent />
        <StatCard
          label="Latest Rank"
          value={metrics.latestRank != null ? `#${metrics.latestRank}` : '—'}
          sub={metrics.latestTotalStudents != null ? `of ${metrics.latestTotalStudents}` : undefined}
        />
        <StatCard
          label="Latest Percentile"
          value={metrics.latestPercentile != null ? `${Math.round(metrics.latestPercentile)}th` : '—'}
        />
        <StatCard
          label="Participation"
          value={fmtPct(metrics.participationRate, 0)}
          sub={`${metrics.testsAttempted} test${metrics.testsAttempted === 1 ? '' : 's'} taken`}
        />
        <StatCard label="Skipped Rate" value={fmtPct(metrics.skippedRate, 0)} />
        <StatCard
          label="Improvement"
          value={metrics.improvementDelta != null
            ? `${metrics.improvementDelta > 0 ? '+' : ''}${metrics.improvementDelta.toFixed(1)}%`
            : '—'}
          sub="latest vs first attempt"
        />
        <StatCard
          label="Consistency"
          value={metrics.consistency != null ? metrics.consistency.toFixed(1) : '—'}
          sub="variance — lower is steadier"
        />
        <StatCard label="Proctoring Flags" value={fmtNum(metrics.violationCount)} />
      </div>

      {hasTests ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <ChartCard title="Marks Trend" sub="Percentage per attempt, chronological" minHeight={180}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={marksData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="percentage" name="Score %" stroke="#D62B38" strokeWidth={2} dot={{ r: 3, fill: '#D62B38' }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Rank Trend" sub="Lower is better, chronological" minHeight={180}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={rankData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} reversed />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="rank" name="Rank" stroke="#0F172A" strokeWidth={2} dot={{ r: 3, fill: '#0F172A' }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {metrics.sectionAccuracy.length > 0 && (
            <ChartCard
              title="Section Accuracy vs Batch"
              sub="Weakest first — your accuracy vs the batch average, per section"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {metrics.sectionAccuracy.map(s => (
                  <div key={s.title} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: '#374151' }}>
                        {s.title}
                        {s.title === metrics.weakestSection && (
                          <span style={{ color: '#B91C1C', fontSize: 11, marginLeft: 6 }}>weakest</span>
                        )}
                        {s.title === metrics.strongestSection && metrics.sectionAccuracy.length > 1 && (
                          <span style={{ color: '#047857', fontSize: 11, marginLeft: 6 }}>strongest</span>
                        )}
                      </span>
                      <span style={{ color: '#6B7280' }}>
                        {Math.round(s.accuracyPercent)}%
                        {s.batchAvgAccuracyPercent != null && s.deltaVsBatch != null && (
                          <span style={{ color: s.deltaVsBatch >= 0 ? '#047857' : '#B91C1C', marginLeft: 6 }}>
                            ({s.deltaVsBatch >= 0 ? '+' : ''}{s.deltaVsBatch.toFixed(1)} vs batch {Math.round(s.batchAvgAccuracyPercent)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, s.accuracyPercent)}%`, height: '100%', background: '#D62B38', opacity: 0.75 }} />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
        </>
      ) : (
        <div style={{ background: '#FAFAFA', border: '1px dashed #E5E7EB', borderRadius: 10, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>No non-diagnostic test attempts yet.</p>
        </div>
      )}

      {/* LexiCore (the 4 LexiCore metrics) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard label="LexiCore Points" value={fmtNum(lexicore.totalPoints)} accent />
        <StatCard label="Words Mastered" value={fmtNum(lexicore.wordsMastered)} />
        <StatCard label="Quiz Accuracy" value={fmtPct(lexicore.quizAccuracy)} />
        <StatCard label="Streak" value={`${lexicore.streakDays}d`} />
      </div>
    </div>
  );
}
