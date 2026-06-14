'use client';

import React from 'react';

interface ChartCardProps {
  title:      string;
  sub?:       string;
  children:   React.ReactNode;
  empty?:     boolean;
  emptyNote?: string;
  minHeight?: number;
}

export default function ChartCard({
  title,
  sub,
  children,
  empty,
  emptyNote,
  minHeight = 200,
}: ChartCardProps) {
  return (
    <div
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #E5E7EB',
        borderRadius: '10px',
        padding:      '20px',
        display:      'flex',
        flexDirection:'column',
        gap:          '12px',
      }}
    >
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{title}</div>
        {sub && <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{sub}</div>}
      </div>
      {empty ? (
        <div
          style={{
            minHeight:      `${minHeight}px`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          '#9CA3AF',
            fontSize:       '13px',
            textAlign:      'center',
            padding:        '16px',
            background:     '#FAFAFA',
            borderRadius:   '8px',
            border:         '1px dashed #E5E7EB',
          }}
        >
          {emptyNote ?? 'No data available yet.'}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
