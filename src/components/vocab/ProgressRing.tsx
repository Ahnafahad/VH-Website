'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';
import AnimatedNumber from '@/components/vocab/AnimatedNumber';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';

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
  const offset        = circumference - (percentage / 100) * circumference;

  const shouldReduceMotion = useReducedMotion();
  const fb                 = useVocabFeedback();

  // Guard: fire levelUp feedback only on first 0→100 transition, not every render.
  const prevPercentageRef = useRef<number | null>(null);
  const celebrationFiredRef = useRef(false);

  useEffect(() => {
    const prev = prevPercentageRef.current;
    if (percentage === 100 && prev !== null && prev < 100 && !celebrationFiredRef.current) {
      celebrationFiredRef.current = true;
      fb.play('levelUp');
    }
    if (percentage < 100) {
      celebrationFiredRef.current = false;
    }
    prevPercentageRef.current = percentage;
  }, [percentage, fb]);

  const gradId   = `lx-grad-${uid}`;
  const glowId   = `lx-glow-${uid}`;
  const fontSize = size > 100 ? '2rem' : '1.4rem';
  const is100    = percentage >= 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* 100% celebration: gold pulse ring expanding outward — gated by reduced-motion */}
      {is100 && !shouldReduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            borderRadius: '50%',
            border: '2px solid rgba(255, 197, 66, 0.6)',
          }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      )}

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

        {/* Gradient arc with glow — Framer initial/animate handles mount animation cleanly */}
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
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.9, ease: 'easeOut' }
          }
          filter={!shouldReduceMotion ? `url(#${glowId})` : undefined}
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
          {/* AnimatedNumber spring-counts in sync with the ring */}
          <AnimatedNumber value={percentage} />%
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
