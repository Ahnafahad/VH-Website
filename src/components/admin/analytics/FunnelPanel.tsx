'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import ChartCard from './ChartCard';
import BarList   from './BarList';
import { fmtNum } from './formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelData {
  acquisition: {
    stage: string;
    count: number;
  }[];
  registrationsByStatus: {
    status: string;
    count:  number;
  }[];
  registrationsByMode: {
    mode:  string;
    count: number;
  }[];
  upgradeInterest: {
    option: string;
    count:  number;
  }[];
  accessRequests: {
    status: string;
    count:  number;
  }[];
  signupsOverTime: {
    date:  string;
    count: number;
  }[];
}

interface FunnelPanelProps {
  data: FunnelData | null;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#D62B38', '#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function FunnelPanel({ data }: FunnelPanelProps) {
  if (!data) return null;

  const {
    acquisition,
    registrationsByStatus,
    registrationsByMode,
    upgradeInterest,
    accessRequests,
    signupsOverTime,
  } = data;

  // Acquisition funnel as stepped BarList
  const maxAcq = Math.max(...acquisition.map(s => s.count), 1);
  const acquisitionItems = acquisition.map(s => ({
    label: s.stage,
    value: s.count,
  }));

  const regStatusPieData  = registrationsByStatus.map(r => ({ name: r.status,  value: r.count }));
  const regModeItems      = registrationsByMode.map(r => ({ label: r.mode,   value: r.count }));
  const upgradeItems      = upgradeInterest.map(u => ({ label: u.option, value: u.count }));
  const accessItems       = accessRequests.map(a => ({ label: a.status, value: a.count }));

  const hasSignups = signupsOverTime.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Acquisition funnel */}
      <ChartCard
        title="Acquisition Funnel"
        sub="Visitors → Sign-ups → Onboarded → Active → Engaged"
        empty={acquisition.length === 0}
        emptyNote="No acquisition data yet."
      >
        {/* Stepped funnel: each bar narrower than the previous */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {acquisition.map((step, i) => {
            const pct = maxAcq > 0 ? (step.count / maxAcq) * 100 : 0;
            const prevCount = i > 0 ? acquisition[i - 1].count : null;
            const dropPct = prevCount && prevCount > 0
              ? Math.round((1 - step.count / prevCount) * 100)
              : null;
            return (
              <div key={step.stage}>
                <div
                  style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'baseline',
                    marginBottom:   '3px',
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                    {step.stage}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {dropPct !== null && (
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                        −{dropPct}% drop
                      </span>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                      {fmtNum(step.count)}
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    height: '10px',
                    background: '#F3F4F6',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width:        `${Math.max(pct, 1)}%`,
                      height:       '100%',
                      background:   PIE_COLORS[i % PIE_COLORS.length],
                      borderRadius: '4px',
                      opacity:      0.8,
                      transition:   'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>

      {/* Signups over time */}
      <ChartCard
        title="Signups Over Time"
        sub="New user registrations per day"
        empty={!hasSignups}
        emptyNote="No signup data in this range."
        minHeight={220}
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={signupsOverTime} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
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
              dataKey="count"
              name="Signups"
              stroke="#D62B38"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#D62B38' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Registrations by status pie + by mode list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <ChartCard
          title="Registrations by Status"
          empty={registrationsByStatus.length === 0}
          emptyNote="No registration data yet."
          minHeight={220}
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={regStatusPieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {regStatusPieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF', border: '1px solid #E5E7EB',
                  borderRadius: '8px', fontSize: '12px',
                }}
              />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Registrations by Mode"
          sub="Program mode breakdown"
          empty={registrationsByMode.length === 0}
          emptyNote="No registration mode data yet."
        >
          <BarList items={regModeItems} valueFormat={v => fmtNum(v)} accent="#60A5FA" />
        </ChartCard>
      </div>

      {/* Upgrade interest + Access requests */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <ChartCard
          title="Upgrade Interest"
          sub="Selected upgrade options"
          empty={upgradeInterest.length === 0}
          emptyNote="No upgrade requests yet."
        >
          <BarList items={upgradeItems} valueFormat={v => fmtNum(v)} accent="#A78BFA" />
        </ChartCard>

        <ChartCard
          title="Access Requests"
          sub="By status"
          empty={accessRequests.length === 0}
          emptyNote="No access requests yet."
        >
          <BarList items={accessItems} valueFormat={v => fmtNum(v)} accent="#34D399" />
        </ChartCard>
      </div>
    </div>
  );
}
