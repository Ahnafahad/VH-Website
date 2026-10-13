import React from 'react';
import { INFO, MUTED } from './tokens';

/**
 * Tiny line chart for a handful of values. Higher value = higher on the line.
 * Needs two or more values; otherwise shows a dash. Pure SVG, no client JS.
 */
export function Sparkline({ values, width = 64, height = 20, label, color = INFO }: {
  values:  number[];
  width?:  number;
  height?: number;
  /** read out by screen readers, e.g. "Last marks: 68, 61, 52" */
  label:   string;
  color?:  string;
}) {
  if (values.length < 2) {
    return <span role="img" aria-label={label} style={{ color: MUTED, fontSize: 12 }}>{'—'}</span>;
  }
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];
  return (
    <svg role="img" aria-label={label} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', flexShrink: 0 }}>
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}
