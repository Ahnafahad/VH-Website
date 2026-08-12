'use client';

import React from 'react';
import {
  BORDER, INK_SOFT, MUTED, RED, R_LG, SHADOW_SM, SURFACE, T_2XL, T_SM,
} from '../lms/lms-shared';

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
        background:   SURFACE,
        border:       `1px solid ${BORDER}`,
        borderRadius: R_LG,
        boxShadow:    SHADOW_SM,
        padding:      '16px 20px',
        display:      'flex',
        flexDirection:'column',
        gap:          '4px',
        minWidth:     0,
      }}
    >
      <span
        style={{
          fontSize:     T_SM,
          fontWeight:   500,
          color:        MUTED,
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
          fontSize:   T_2XL,
          fontWeight: 700,
          color:      accent ? RED : INK_SOFT,
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: T_SM, color: MUTED }}>{sub}</span>
      )}
    </div>
  );
}
