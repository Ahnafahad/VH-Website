'use client';

import React from 'react';
import {
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
import { msToHuman, fmtNum, fmtPct } from './formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  totals: {
    totalUsers:           number;
    activeUsers7d:        number;
    totalSessions:        number;
    anonSessions:         number;
    authSessions:         number;
    avgSessionDurationMs: number;
    totalPageviews:       number;
    totalRegistrations:   number;
    freeSignups:          number;
  };
  dauWau:      { date: string; dau: number }[];
  topModules:  { module: string; events: number; avgTimeMs: number }[];
}

interface OverviewPanelProps {
  data: OverviewData | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OverviewPanel({ data }: OverviewPanelProps) {
  if (!data) return null;
  const { totals, dauWau, topModules } = data;

  const hasDau     = dauWau && dauWau.length > 0;
  const hasModules = topModules && topModules.length > 0;

  const moduleItems = (topModules ?? []).map(m => ({
    label: m.module,
    value: m.events,
    sub:   msToHuman(m.avgTimeMs),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* KPI row */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap:                 '12px',
        }}
      >
        <StatCard label="Total Users"      value={fmtNum(totals.totalUsers)}           />
        <StatCard label="Active (7d)"      value={fmtNum(totals.activeUsers7d)}        accent />
        <StatCard label="Total Sessions"   value={fmtNum(totals.totalSessions)}        />
        <StatCard label="Avg Session Time" value={msToHuman(totals.avgSessionDurationMs)} />
        <StatCard label="Total Pageviews"  value={fmtNum(totals.totalPageviews)}       />
        <StatCard label="Registrations"    value={fmtNum(totals.totalRegistrations)}   />
        <StatCard
          label="Free Signups"
          value={fmtNum(totals.freeSignups)}
          sub={`${fmtPct(totals.totalRegistrations > 0 ? (totals.freeSignups / totals.totalRegistrations) * 100 : 0)} of registrations`}
        />
        <StatCard
          label="Anon Sessions"
          value={fmtNum(totals.anonSessions)}
          sub={`Auth: ${fmtNum(totals.authSessions)}`}
        />
      </div>

      {/* DAU line chart */}
      <ChartCard
        title="Daily Active Users"
        sub="Unique users per day"
        empty={!hasDau}
        emptyNote="No clickstream data yet — this populates as visitors browse the site."
        minHeight={220}
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dauWau} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
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
                background:   '#FFFFFF',
                border:       '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize:     '12px',
              }}
            />
            <Line
              type="monotone"
              dataKey="dau"
              name="DAU"
              stroke="#D62B38"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#D62B38' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Top modules */}
      <ChartCard
        title="Top Modules by Activity"
        sub="Events triggered per module"
        empty={!hasModules}
        emptyNote="No module activity data yet."
      >
        <BarList items={moduleItems} valueFormat={v => fmtNum(v) + ' events'} />
      </ChartCard>
    </div>
  );
}
