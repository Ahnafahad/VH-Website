'use client';

import React from 'react';
import { INK_SOFT, MUTED, RED, SURFACE_ALT, T_BASE, T_XS } from '../lms/lms-shared';

interface BarListItem {
  label:  string;
  value:  number;
  sub?:   string;
}

interface BarListProps {
  items:        BarListItem[];
  max?:         number;
  valueFormat?: (v: number) => string;
  accent?:      string;
  limit?:       number;
}

export default function BarList({
  items,
  max,
  valueFormat,
  accent = RED,
  limit = 10,
}: BarListProps) {
  const displayed = items.slice(0, limit);
  const maxVal    = max ?? Math.max(...displayed.map(i => i.value), 1);

  if (displayed.length === 0) {
    return (
      <div style={{ color: MUTED, fontSize: T_BASE, padding: '8px 0' }}>
        No data yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {displayed.map((item, idx) => {
        const pct = Math.max((item.value / maxVal) * 100, 2);
        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'baseline',
                gap:            '8px',
              }}
            >
              <span
                style={{
                  fontSize:     T_BASE,
                  color:        INK_SOFT,
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  maxWidth:     '65%',
                }}
                title={item.label}
              >
                {item.label}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {item.sub && (
                  <span style={{ fontSize: T_XS, color: MUTED }}>{item.sub}</span>
                )}
                <span style={{ fontSize: T_BASE, fontWeight: 600, color: INK_SOFT }}>
                  {valueFormat ? valueFormat(item.value) : item.value.toLocaleString()}
                </span>
              </span>
            </div>
            <div
              style={{
                height:       '4px',
                background:   SURFACE_ALT,
                borderRadius: '2px',
                overflow:     'hidden',
              }}
            >
              <div
                style={{
                  width:        `${pct}%`,
                  height:       '100%',
                  background:   accent,
                  borderRadius: '2px',
                  opacity:      0.75,
                  transition:   'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
