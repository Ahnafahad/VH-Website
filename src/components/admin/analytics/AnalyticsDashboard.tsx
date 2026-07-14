'use client';

import React, { useState, useEffect, useCallback } from 'react';
import OverviewPanel  from './OverviewPanel';
import BehaviorPanel  from './BehaviorPanel';
import VocabPanel     from './VocabPanel';
import LexicorePanel  from './LexicorePanel';
import MathPanel      from './MathPanel';
import FunnelPanel    from './FunnelPanel';
import LmsPanel       from './LmsPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'overview' | 'behavior' | 'lms' | 'vocab' | 'lexicore' | 'math' | 'funnel';
type Range   = '7d' | '30d' | '90d' | 'all';

interface Tab {
  id:      Section;
  label:   string;
}

const TABS: Tab[] = [
  { id: 'overview',  label: 'Overview'           },
  { id: 'behavior',  label: 'Behavior & Flow'    },
  { id: 'lms',       label: 'LMS'                },
  { id: 'lexicore',  label: 'LexiCore'           },
  { id: 'vocab',     label: 'Vocab (Words)'      },
  { id: 'math',      label: 'Mental Math'        },
  { id: 'funnel',    label: 'Engagement & Funnel'},
];

const RANGES: { value: Range; label: string }[] = [
  { value: '7d',  label: '7d'  },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
      {[180, 220, 160].map((h, i) => (
        <div
          key={i}
          style={{
            height:       `${h}px`,
            background:   '#F3F4F6',
            borderRadius: '10px',
            animation:    'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<Section>('overview');
  const [range,     setRange]     = useState<Range>('7d');
  const [data,      setData]      = useState<Record<string, unknown> | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchData = useCallback(async (section: Section, r: Range) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?section=${section}&range=${r}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as Record<string, unknown>;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(activeTab, range);
  }, [activeTab, range, fetchData]);

  function handleTabChange(tab: Section) {
    setActiveTab(tab);
    setData(null);
  }

  function handleRangeChange(r: Range) {
    setRange(r);
    setData(null);
  }

  // ─── Render panel ──────────────────────────────────────────────────────────

  function renderPanel() {
    if (loading) return <Skeleton />;
    if (error) {
      return (
        <div
          style={{
            padding:      '24px',
            background:   'rgba(214,43,56,0.04)',
            border:       '1px solid rgba(214,43,56,0.2)',
            borderRadius: '10px',
            color:        '#D62B38',
            fontSize:     '14px',
          }}
        >
          <strong>Error loading data:</strong> {error}
        </div>
      );
    }
    if (!data) return null;

    const d = data as any;
    switch (activeTab) {
      case 'overview':  return <OverviewPanel data={d} />;
      case 'behavior':  return <BehaviorPanel data={d} />;
      case 'lms':       return <LmsPanel      data={d} />;
      case 'vocab':     return <VocabPanel    data={d} />;
      case 'lexicore':  return <LexicorePanel data={d} />;
      case 'math':      return <MathPanel     data={d} />;
      case 'funnel':    return <FunnelPanel   data={d} />;
    }
  }

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           '20px',
        padding:       'clamp(16px, 3vw, 32px)',
        minHeight:     '100dvh',
        background:    '#FAFAFA',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          gap:            '16px',
          flexWrap:       'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin:        0,
              fontSize:      '22px',
              fontWeight:    700,
              color:         '#0F172A',
              letterSpacing: '-0.025em',
            }}
          >
            Analytics
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
            Platform usage, engagement, and funnel metrics
          </p>
        </div>

        {/* Range segmented control */}
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            background:   '#F3F4F6',
            borderRadius: '8px',
            padding:      '3px',
            gap:          '2px',
          }}
          role="group"
          aria-label="Date range"
        >
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => handleRangeChange(r.value)}
              style={{
                padding:      '5px 14px',
                minHeight:    44,
                border:       'none',
                borderRadius: '6px',
                fontSize:     '13px',
                fontWeight:   range === r.value ? 600 : 400,
                color:        range === r.value ? '#0F172A' : '#6B7280',
                background:   range === r.value ? '#FFFFFF' : 'transparent',
                cursor:       'pointer',
                boxShadow:    range === r.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition:   'all 0.15s',
              }}
              aria-pressed={range === r.value}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '2px',
          borderBottom: '1px solid #E5E7EB',
          overflowX:    'auto',
        }}
        role="tablist"
        aria-label="Analytics sections"
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding:       '10px 16px',
              minHeight:     44,
              border:        'none',
              borderBottom:  activeTab === tab.id ? '2px solid #D62B38' : '2px solid transparent',
              background:    'transparent',
              fontSize:      '13px',
              fontWeight:    activeTab === tab.id ? 600 : 400,
              color:         activeTab === tab.id ? '#D62B38' : '#6B7280',
              cursor:        'pointer',
              whiteSpace:    'nowrap',
              marginBottom:  '-1px',
              transition:    'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Panel ───────────────────────────────────────────────────────────── */}
      <div role="tabpanel">
        {renderPanel()}
      </div>
    </div>
  );
}
