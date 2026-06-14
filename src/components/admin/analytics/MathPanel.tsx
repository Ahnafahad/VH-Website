'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import StatCard  from './StatCard';
import ChartCard from './ChartCard';
import BarList   from './BarList';
import { fmtNum, fmtPct, msToHuman } from './formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MathData {
  operationStats: {
    operation:     string;
    attempts:      number;
    accuracy:      number;
    avgResponseMs: number;
    skipRate:      number;
  }[];
  difficultyDistribution: {
    bucket: string;
    count:  number;
  }[];
  sessionsOverTime: {
    date:     string;
    sessions: number;
  }[];
  avgSkill: {
    addition:       number;
    subtraction:    number;
    multiplication: number;
    division:       number;
  };
  abandonmentRate: number;
}

interface MathPanelProps {
  data: MathData | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MathPanel({ data }: MathPanelProps) {
  if (!data) return null;

  const { operationStats, difficultyDistribution, sessionsOverTime, avgSkill, abandonmentRate } = data;

  // Avg skill as StatCards
  const skillCards = [
    { label: 'Avg Skill — Addition',       value: avgSkill.addition },
    { label: 'Avg Skill — Subtraction',    value: avgSkill.subtraction },
    { label: 'Avg Skill — Multiplication', value: avgSkill.multiplication },
    { label: 'Avg Skill — Division',       value: avgSkill.division },
  ];

  // Operation stats as BarList items (accuracy%)
  const opAccuracyItems = operationStats.map(op => ({
    label: op.operation,
    value: op.accuracy,
    sub:   `${msToHuman(op.avgResponseMs)} avg · skip ${fmtPct(op.skipRate)}`,
  }));

  const hasSessions = sessionsOverTime.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Avg skill + abandonment rate */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap:                 '12px',
        }}
      >
        {skillCards.map(card => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value.toFixed(1)}
            sub="avg skill score"
          />
        ))}
        <StatCard
          label="Abandonment Rate"
          value={fmtPct(abandonmentRate)}
          sub="sessions abandoned"
          accent={abandonmentRate > 30}
        />
      </div>

      {/* Operation accuracy */}
      <ChartCard
        title="Operation Stats"
        sub="Accuracy per operation (hover for response time and skip rate)"
        empty={operationStats.length === 0}
        emptyNote="No math question attempt data yet."
      >
        <BarList
          items={opAccuracyItems}
          valueFormat={v => fmtPct(v)}
          accent="#D62B38"
        />
      </ChartCard>

      {/* Sessions over time */}
      <ChartCard
        title="Sessions Over Time"
        sub="Math sessions started per day"
        empty={!hasSessions}
        emptyNote="No session data yet."
        minHeight={220}
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={sessionsOverTime} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                borderRadius: '8px', fontSize: '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="sessions"
              name="Sessions"
              stroke="#D62B38"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#D62B38' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Difficulty distribution */}
      <ChartCard
        title="Difficulty Distribution"
        sub="Attempts by difficulty bucket"
        empty={difficultyDistribution.length === 0}
        emptyNote="No difficulty data yet."
        minHeight={220}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={difficultyDistribution}
            margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Difficulty', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#9CA3AF' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                borderRadius: '8px', fontSize: '12px',
              }}
              formatter={(v: number) => [fmtNum(v), 'Attempts']}
            />
            <Bar dataKey="count" name="Attempts" fill="#FBBF24" radius={[3, 3, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
