'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface TimerArcProps {
  deadlineMs: number;           // epoch ms from server
  onExpire: () => void;
}

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

  useEffect(() => {
    expiredRef.current = false;
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

  return (
    <motion.span
      animate={
        isRed
          ? { opacity: [1, 0.5, 1] }
          : isGold
          ? { opacity: [1, 0.7, 1] }
          : { opacity: 1 }
      }
      transition={
        isRed || isGold
          ? { repeat: Infinity, duration: isRed ? 0.8 : 1.5, ease: 'easeInOut' }
          : {}
      }
      className={`font-mono text-sm font-semibold tabular-nums ${colorClass}`}
    >
      {formatTime(remaining)}
    </motion.span>
  );
}
