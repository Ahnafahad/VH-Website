'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface HorizonLineProps {
  className?: string;
  color?: string;
  strokeWidth?: number;
  variant?: 'straight' | 'wave' | 'arc';
  delay?: number;
}

/**
 * Persistent brand motif: a single horizon line that draws itself on enter.
 * Variants let it morph across sections (rule, edge, baseline, divider).
 */
export function HorizonLine({
  className,
  color = '#D4B094',
  strokeWidth = 1.5,
  variant = 'straight',
  delay = 0,
}: HorizonLineProps) {
  const d =
    variant === 'wave'
      ? 'M0 40 Q 250 20, 500 40 T 1000 40'
      : variant === 'arc'
      ? 'M0 60 Q 500 0, 1000 60'
      : 'M0 40 L 1000 40';

  return (
    <svg
      className={cn('w-full h-20 overflow-visible pointer-events-none', className)}
      viewBox="0 0 1000 80"
      preserveAspectRatio="none"
      aria-hidden
    >
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: 1.6, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
