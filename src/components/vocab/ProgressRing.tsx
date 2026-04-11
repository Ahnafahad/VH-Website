'use client';

import { motion } from 'framer-motion';
import { useEffect, useId, useState } from 'react';

interface Props {
  percentage:  number;   // 0–100
  size:        number;
  strokeWidth: number;
  label?:      string;
}

export default function ProgressRing({ percentage, size, strokeWidth, label }: Props) {
  const uid           = useId().replace(/:/g, '');
  const radius        = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const target = circumference - (percentage / 100) * circumference;
    const t = setTimeout(() => setOffset(target), 50);
    return () => clearTimeout(t);
  }, [percentage, circumference]);

  const gradId   = `lx-grad-${uid}`;
  const glowId   = `lx-glow-${uid}`;
  const fontSize = size > 100 ? '2rem' : '1.4rem';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          {/* Red → gold gradient along arc */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="var(--color-lx-accent-red)"  />
            <stop offset="100%" stopColor="var(--color-lx-accent-gold)" />
          </linearGradient>

          {/* Soft glow filter */}
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke="var(--color-lx-elevated)"
        />

        {/* Gradient arc with glow */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={`url(#${gradId})`}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          filter={`url(#${glowId})`}
        />
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize,
            fontWeight: 700,
            lineHeight: 1,
            color:      'var(--color-lx-text-primary)',
          }}
        >
          {percentage}%
        </span>
        {label && (
          <span
            style={{
              fontFamily:    "'Sora', sans-serif",
              fontSize:      '0.6rem',
              color:         'var(--color-lx-text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
