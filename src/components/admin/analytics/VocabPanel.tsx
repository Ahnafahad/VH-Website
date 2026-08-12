'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import StatCard  from './StatCard';
import ChartCard from './ChartCard';
import BarList   from './BarList';
import { fmtNum, fmtPct } from './formatters';
import {
  BORDER, INFO, INK_SOFT, MUTED, OK, RED, RED_HOVER, R_MD, R_PILL, R_SM,
  SURFACE, SURFACE_ALT, T_BASE, T_SM, T_XS, WARN,
} from '../lms/lms-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VocabData {
  funnel: {
    studied: number;
    quizzed: number;
    passed:  number;
  };
  hardestWords: {
    word:        string;
    definition:  string;
    attempts:    number;
    accuracy:    number;
    missedCount: number;
  }[];
  confusionPairs: {
    wordA:  string;
    wordB:  string;
    count:  number;
  }[];
  masteryDistribution: {
    level: number;
    count: number;
  }[];
  questionTypeAccuracy: {
    type:     string | null;
    accuracy: number;
    count:    number;
  }[];
  featureUsage: {
    feature: string;
    count:   number;
  }[];
  topStudiedWords: {
    word:     string;
    attempts: number;
  }[];
}

interface VocabPanelProps {
  data: VocabData | null;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const FUNNEL_COLORS = [RED, INFO, WARN];

// ─── Component ────────────────────────────────────────────────────────────────

export default function VocabPanel({ data }: VocabPanelProps) {
  if (!data) return null;

  const { funnel, hardestWords, confusionPairs, masteryDistribution, questionTypeAccuracy, featureUsage, topStudiedWords } = data;

  const funnelSteps = [
    { label: 'Studied',  value: funnel.studied, color: FUNNEL_COLORS[0] },
    { label: 'Quizzed',  value: funnel.quizzed, color: FUNNEL_COLORS[1] },
    { label: 'Passed',   value: funnel.passed,  color: FUNNEL_COLORS[2] },
  ];

  const hardestItems = hardestWords.map(w => ({
    label: w.word,
    value: w.accuracy,
    sub:   `${fmtNum(w.attempts)} attempts`,
  }));

  const featureItems = featureUsage.map(f => ({
    label: f.feature,
    value: f.count,
  }));

  const topStudiedItems = topStudiedWords.map(w => ({
    label: w.word,
    value: w.attempts,
  }));

  const masteryData = [...masteryDistribution].sort((a, b) => a.level - b.level);
  const qtData = questionTypeAccuracy.map(q => ({
    ...q,
    type: q.type ?? 'unknown',
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Funnel: studied → quizzed → passed */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap:                 '12px',
        }}
      >
        {funnelSteps.map((step, i) => (
          <div key={step.label} style={{ position: 'relative' }}>
            <StatCard
              label={step.label}
              value={fmtNum(step.value)}
              sub={
                i > 0 && funnelSteps[i - 1].value > 0
                  ? `${fmtPct((step.value / funnelSteps[i - 1].value) * 100)} of ${funnelSteps[i - 1].label.toLowerCase()}`
                  : undefined
              }
              accent={i === 0}
            />
          </div>
        ))}
      </div>

      {/* Hardest words */}
      <ChartCard
        title="Hardest Words"
        sub="Sorted by lowest accuracy (min 3 attempts)"
        empty={hardestWords.length === 0}
        emptyNote="No word attempt data yet."
      >
        <BarList
          items={hardestItems}
          valueFormat={v => fmtPct(v)}
          accent={RED_HOVER}
          limit={15}
        />
      </ChartCard>

      {/* Confusion pairs */}
      <ChartCard
        title="Confusion Pairs"
        sub="Words most often confused with each other"
        empty={confusionPairs.length === 0}
        emptyNote="No confusion pair data yet."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {confusionPairs.slice(0, 15).map((pair, i) => (
            <div
              key={i}
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                padding:        '8px 10px',
                background:     SURFACE_ALT,
                borderRadius:   R_SM,
                border:         `1px solid ${BORDER}`,
              }}
            >
              <span style={{ fontSize: T_BASE, color: INK_SOFT }}>
                <strong style={{ color: INK_SOFT }}>{pair.wordA}</strong>
                <span style={{ color: MUTED, margin: '0 6px' }}>↔</span>
                <strong style={{ color: INK_SOFT }}>{pair.wordB}</strong>
              </span>
              <span
                style={{
                  fontSize:   T_SM,
                  fontWeight: 600,
                  color:      RED,
                  background: `${RED}0F`,
                  padding:    '2px 8px',
                  borderRadius: R_PILL,
                }}
              >
                {fmtNum(pair.count)}×
              </span>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Mastery distribution + Question type accuracy */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <ChartCard
          title="Mastery Distribution"
          sub="Word records by mastery level"
          empty={masteryDistribution.length === 0}
          emptyNote="No mastery data yet."
          minHeight={220}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={masteryData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_ALT} />
              <XAxis
                dataKey="level"
                tick={{ fontSize: T_XS, fill: MUTED }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Level', position: 'insideBottom', offset: -2, fontSize: 10, fill: MUTED }}
              />
              <YAxis
                tick={{ fontSize: T_XS, fill: MUTED }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: SURFACE, border: `1px solid ${BORDER}`,
                  borderRadius: R_MD, fontSize: T_SM,
                }}
              />
              <Bar dataKey="count" name="Words" fill={RED} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Question Type Accuracy"
          sub="Correct answer rate by question format"
          empty={questionTypeAccuracy.length === 0}
          emptyNote="No quiz answer data yet."
          minHeight={220}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={qtData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={SURFACE_ALT} />
              <XAxis
                dataKey="type"
                tick={{ fontSize: T_XS, fill: MUTED }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: T_XS, fill: MUTED }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: SURFACE, border: `1px solid ${BORDER}`,
                  borderRadius: R_MD, fontSize: T_SM,
                }}
                formatter={(v: number) => [`${v}%`, 'Accuracy']}
              />
              <Bar dataKey="accuracy" name="Accuracy %" fill={INFO} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Feature usage + Top studied words */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <ChartCard
          title="Feature Usage"
          sub="Sessions per feature"
          empty={featureUsage.length === 0}
          emptyNote="No feature usage data yet."
        >
          <BarList items={featureItems} valueFormat={v => fmtNum(v) + ' sessions'} accent={MUTED} />
        </ChartCard>

        <ChartCard
          title="Top Studied Words"
          sub="Most-attempted words"
          empty={topStudiedWords.length === 0}
          emptyNote="No study data yet."
        >
          <BarList items={topStudiedItems} valueFormat={v => fmtNum(v) + ' attempts'} accent={OK} limit={15} />
        </ChartCard>
      </div>
    </div>
  );
}
