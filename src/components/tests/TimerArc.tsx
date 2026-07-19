'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface TimerArcProps {
  deadlineMs: number;           // epoch ms from server
  onExpire: () => void;
}

const RING_SIZE = 40;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSecs = Math.ceil(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TimerArc({ deadlineMs, onExpire }: TimerArcProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadlineMs - Date.now()));
  const expiredRef = useRef(false);
  // Reference for the ring sweep: the window duration as seen on first render.
  const totalRef = useRef(remaining);

  useEffect(() => {
    expiredRef.current = false;
    totalRef.current = Math.max(1, deadlineMs - Date.now());
    const tick = () => {
      const rem = Math.max(0, deadlineMs - Date.now());
      setRemaining(rem);
      if (rem === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineMs, onExpire]);

  const isGold = remaining <= 5 * 60_000;
  const isRed  = remaining <= 60_000;

  const colorClass = isRed
    ? 'text-exam-danger'
    : isGold
    ? 'text-exam-gold'
    : 'text-exam-ink';
  const strokeVar = isRed
    ? 'var(--color-exam-danger)'
    : isGold
    ? 'var(--color-exam-gold)'
    : 'var(--color-exam-ink-muted)';

  const progress = Math.min(1, remaining / totalRef.current);
  const dashoffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <motion.div
      animate={
        isRed
          ? { opacity: [1, 0.55, 1] }
          : isGold
          ? { opacity: [1, 0.75, 1] }
          : { opacity: 1 }
      }
      transition={
        isRed || isGold
          ? { repeat: Infinity, duration: isRed ? 0.8 : 1.6, ease: 'easeInOut' }
          : {}
      }
      className="relative flex items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--color-exam-border)"
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={strokeVar}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashoffset}
          style={{ transition: 'stroke-dashoffset 900ms linear, stroke 300ms ease' }}
        />
      </svg>
      <span suppressHydrationWarning className={`absolute font-mono text-[10px] font-semibold tabular-nums ${colorClass}`}>
        {formatTime(remaining)}
      </span>
    </motion.div>
  );
}
