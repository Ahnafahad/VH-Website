'use client';

import React from 'react';

interface StatCardProps {
  label:   string;
  value:   string | number;
  sub?:    string;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #E5E7EB',
        borderRadius: '10px',
        padding:      '16px 20px',
        display:      'flex',
        flexDirection:'column',
        gap:          '4px',
        minWidth:     0,
      }}
    >
      <span
        style={{
          fontSize:     '12px',
          fontWeight:   500,
          color:        '#6B7280',
          textTransform:'uppercase',
          letterSpacing:'0.05em',
          whiteSpace:   'nowrap',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize:   '24px',
          fontWeight: 700,
          color:      accent ? '#D62B38' : '#0F172A',
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{sub}</span>
      )}
    </div>
  );
}
