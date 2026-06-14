'use client';

import React from 'react';

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
  accent = '#D62B38',
  limit = 10,
}: BarListProps) {
  const displayed = items.slice(0, limit);
  const maxVal    = max ?? Math.max(...displayed.map(i => i.value), 1);

  if (displayed.length === 0) {
    return (
      <div style={{ color: '#9CA3AF', fontSize: '13px', padding: '8px 0' }}>
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
                  fontSize:     '13px',
                  color:        '#374151',
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
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{item.sub}</span>
                )}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                  {valueFormat ? valueFormat(item.value) : item.value.toLocaleString()}
                </span>
              </span>
            </div>
            <div
              style={{
                height:       '4px',
                background:   '#F3F4F6',
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
