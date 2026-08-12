'use client';

import React from 'react';
import {
  BORDER, INK_SOFT, MUTED, R_LG, R_MD, SHADOW_SM, SURFACE, SURFACE_ALT,
  T_BASE, T_MD, T_SM,
} from '../lms/lms-shared';

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
        background:   SURFACE,
        border:       `1px solid ${BORDER}`,
        borderRadius: R_LG,
        boxShadow:    SHADOW_SM,
        padding:      '20px',
        display:      'flex',
        flexDirection:'column',
        gap:          '12px',
      }}
    >
      <div>
        <div style={{ fontSize: T_MD, fontWeight: 600, color: INK_SOFT }}>{title}</div>
        {sub && <div style={{ fontSize: T_SM, color: MUTED, marginTop: '2px' }}>{sub}</div>}
      </div>
      {empty ? (
        <div
          style={{
            minHeight:      `${minHeight}px`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          MUTED,
            fontSize:       T_BASE,
            textAlign:      'center',
            padding:        '16px',
            background:     SURFACE_ALT,
            borderRadius:   R_MD,
            border:         `1px dashed ${BORDER}`,
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
