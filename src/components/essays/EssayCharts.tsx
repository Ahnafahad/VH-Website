'use client';

/**
 * Essay charts: score-distribution histogram (with an optional "you are
 * here" marker) and the series-over-series trend line.
 */

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EssayHistogramBin } from '@/lib/essays/types';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function ScoreHistogram({
  bins,
  highlight,
  tone = 'dark',
  height = 200,
}: {
  bins: EssayHistogramBin[];
  highlight?: number | null;
  tone?: 'dark' | 'light';
  height?: number;
}) {
  const dark = tone === 'dark';
  const data = bins.map(b => ({
    label: b.to - b.from <= 1 ? fmt(b.from) : `${fmt(b.from)}–${fmt(b.to)}`,
    count: b.count,
    mine: highlight !== null && highlight !== undefined && highlight >= b.from && (highlight < b.to || (b === bins[bins.length - 1] && highlight <= b.to)),
  }));
  const axis = dark ? '#B7A99A' : '#6B7280';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid vertical={false} stroke={dark ? '#3A2F29' : '#E5E7EB'} />
        <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
          contentStyle={{ background: dark ? '#2A221E' : '#FFFFFF', border: `1px solid ${dark ? '#3A2F29' : '#E5E7EB'}`, borderRadius: 8, color: dark ? '#F3ECE2' : '#111827', fontSize: 12 }}
          formatter={(v) => [`${v} student${v === 1 ? '' : 's'}`, 'Scored']}
          labelFormatter={(l) => `Marks ${l}`}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.mine ? (dark ? '#E4C169' : '#7C3AED') : dark ? '#9A1B20' : '#C4B5FD'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface TrendPoint {
  label: string;
  mine: number | null;
  classAvg: number | null;
}

export function TrendChart({ points, tone = 'dark', height = 240 }: { points: TrendPoint[]; tone?: 'dark' | 'light'; height?: number }) {
  const dark = tone === 'dark';
  const axis = dark ? '#B7A99A' : '#6B7280';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke={dark ? '#3A2F29' : '#E5E7EB'} />
        <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
        <Tooltip
          contentStyle={{ background: dark ? '#2A221E' : '#FFFFFF', border: `1px solid ${dark ? '#3A2F29' : '#E5E7EB'}`, borderRadius: 8, color: dark ? '#F3ECE2' : '#111827', fontSize: 12 }}
          formatter={(v) => (v === null || v === undefined ? '—' : `${v}%`)}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: axis }} />
        <Line type="monotone" dataKey="mine" name="You" stroke={dark ? '#E4C169' : '#7C3AED'} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
        <Line type="monotone" dataKey="classAvg" name="Class average" stroke={dark ? '#B7A99A' : '#9CA3AF'} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

const SECTION_COLORS = ['#E4C169', '#4CB882', '#6CA0DC', '#D4625A', '#B98BE0', '#E4A93C'];

export function SectionTrendChart({ rows, sectionNames, tone = 'dark', height = 220 }: { rows: Record<string, number | string | null>[]; sectionNames: string[]; tone?: 'dark' | 'light'; height?: number }) {
  const dark = tone === 'dark';
  const axis = dark ? '#B7A99A' : '#6B7280';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke={dark ? '#3A2F29' : '#E5E7EB'} />
        <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
        <Tooltip
          contentStyle={{ background: dark ? '#2A221E' : '#FFFFFF', border: `1px solid ${dark ? '#3A2F29' : '#E5E7EB'}`, borderRadius: 8, color: dark ? '#F3ECE2' : '#111827', fontSize: 12 }}
          formatter={(v) => (v === null || v === undefined ? '—' : `${v}%`)}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: axis }} />
        {sectionNames.map((name, i) => (
          <Line key={name} type="monotone" dataKey={name} stroke={SECTION_COLORS[i % SECTION_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
