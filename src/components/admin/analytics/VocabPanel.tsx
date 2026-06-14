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

const FUNNEL_COLORS = ['#D62B38', '#F87171', '#FBBF24'];

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
          accent="#F87171"
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
                background:     '#FAFAFA',
                borderRadius:   '6px',
                border:         '1px solid #E5E7EB',
              }}
            >
              <span style={{ fontSize: '13px', color: '#374151' }}>
                <strong style={{ color: '#111827' }}>{pair.wordA}</strong>
                <span style={{ color: '#9CA3AF', margin: '0 6px' }}>↔</span>
                <strong style={{ color: '#111827' }}>{pair.wordB}</strong>
              </span>
              <span
                style={{
                  fontSize:   '12px',
                  fontWeight: 600,
                  color:      '#D62B38',
                  background: 'rgba(214,43,56,0.06)',
                  padding:    '2px 8px',
                  borderRadius: '12px',
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
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="level"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Level', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#9CA3AF' }}
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
              <Bar dataKey="count" name="Words" fill="#D62B38" radius={[3, 3, 0, 0]} maxBarSize={40} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="type"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF', border: '1px solid #E5E7EB',
                  borderRadius: '8px', fontSize: '12px',
                }}
                formatter={(v: number) => [`${v}%`, 'Accuracy']}
              />
              <Bar dataKey="accuracy" name="Accuracy %" fill="#60A5FA" radius={[3, 3, 0, 0]} maxBarSize={40} />
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
          <BarList items={featureItems} valueFormat={v => fmtNum(v) + ' sessions'} accent="#A78BFA" />
        </ChartCard>

        <ChartCard
          title="Top Studied Words"
          sub="Most-attempted words"
          empty={topStudiedWords.length === 0}
          emptyNote="No study data yet."
        >
          <BarList items={topStudiedItems} valueFormat={v => fmtNum(v) + ' attempts'} accent="#34D399" limit={15} />
        </ChartCard>
      </div>
    </div>
  );
}
