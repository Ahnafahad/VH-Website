'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ChartCard from './ChartCard';
import BarList   from './BarList';
import { msToHuman, fmtNum } from './formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BehaviorData {
  topPages:      { path: string; views: number; avgTimeMs: number; uniqueVisitors: number }[];
  entryPages:    { path: string; count: number }[];
  exitPages:     { path: string; count: number }[];
  deviceSplit:   { device: string; count: number }[];
  authVsAnon:    { auth: number; anon: number };
  referrers:     { referrer: string; count: number }[];
  timeByPath:    { path: string; avgTimeMs: number }[];
}

interface BehaviorPanelProps {
  data: BehaviorData | null;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const COLORS = ['#D62B38', '#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA'];

const EMPTY_NOTE = 'No clickstream data yet — this populates as visitors browse the site.';

// ─── Component ────────────────────────────────────────────────────────────────

export default function BehaviorPanel({ data }: BehaviorPanelProps) {
  if (!data) return null;

  const isEmpty = (arr: unknown[]) => !arr || arr.length === 0;

  const topPagesItems = (data.topPages ?? []).map(p => ({
    label: p.path,
    value: p.views,
    sub:   msToHuman(p.avgTimeMs),
  }));

  const entryItems = (data.entryPages ?? []).map(p => ({
    label: p.path,
    value: p.count,
  }));

  const exitItems = (data.exitPages ?? []).map(p => ({
    label: p.path,
    value: p.count,
  }));

  const referrerItems = (data.referrers ?? []).map(r => ({
    label: r.referrer || '(direct)',
    value: r.count,
  }));

  const deviceData  = (data.deviceSplit ?? []).map(d => ({ name: d.device, value: d.count }));
  const authAnon    = [
    { name: 'Authenticated', value: data.authVsAnon?.auth ?? 0 },
    { name: 'Anonymous',     value: data.authVsAnon?.anon ?? 0 },
  ];

  const allEmpty =
    isEmpty(data.topPages) &&
    isEmpty(data.deviceSplit) &&
    isEmpty(data.referrers);

  if (allEmpty) {
    return (
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      '240px',
          color:          '#9CA3AF',
          fontSize:       '14px',
          textAlign:      'center',
          padding:        '24px',
          background:     '#FAFAFA',
          borderRadius:   '10px',
          border:         '1px dashed #E5E7EB',
        }}
      >
        {EMPTY_NOTE}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Top pages */}
      <ChartCard
        title="Top Pages"
        sub="Views + avg time on page"
        empty={isEmpty(data.topPages)}
        emptyNote={EMPTY_NOTE}
      >
        <BarList items={topPagesItems} valueFormat={v => fmtNum(v) + ' views'} />
      </ChartCard>

      {/* Entry / Exit side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <ChartCard
          title="Entry Pages"
          sub="Where sessions start"
          empty={isEmpty(data.entryPages)}
          emptyNote={EMPTY_NOTE}
        >
          <BarList items={entryItems} valueFormat={v => fmtNum(v)} accent="#60A5FA" />
        </ChartCard>
        <ChartCard
          title="Exit Pages"
          sub="Where sessions end"
          empty={isEmpty(data.exitPages)}
          emptyNote={EMPTY_NOTE}
        >
          <BarList items={exitItems} valueFormat={v => fmtNum(v)} accent="#FBBF24" />
        </ChartCard>
      </div>

      {/* Device split + Auth vs Anon */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <ChartCard
          title="Device Split"
          empty={isEmpty(data.deviceSplit)}
          emptyNote={EMPTY_NOTE}
          minHeight={220}
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={deviceData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name} ${(((percent as number) ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {deviceData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background:   '#FFFFFF',
                  border:       '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize:     '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Auth vs Anonymous"
          empty={authAnon[0].value === 0 && authAnon[1].value === 0}
          emptyNote={EMPTY_NOTE}
          minHeight={220}
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={authAnon}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name} ${(((percent as number) ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                <Cell fill="#D62B38" />
                <Cell fill="#E5E7EB" />
              </Pie>
              <Tooltip
                contentStyle={{
                  background:   '#FFFFFF',
                  border:       '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize:     '12px',
                }}
              />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Referrers */}
      <ChartCard
        title="Referrers"
        sub="Traffic sources"
        empty={isEmpty(data.referrers)}
        emptyNote={EMPTY_NOTE}
      >
        <BarList items={referrerItems} valueFormat={v => fmtNum(v) + ' visits'} accent="#A78BFA" />
      </ChartCard>
    </div>
  );
}
