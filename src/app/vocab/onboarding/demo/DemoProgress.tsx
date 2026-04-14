'use client';

import { motion } from 'framer-motion';

interface Props {
  total: number;
  current: number;
}

export default function DemoProgress({ total, current }: Props) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width:      i === current ? 18 : 6,
            background: i === current
              ? 'var(--color-lx-accent-red)'
              : i < current
              ? 'var(--color-lx-text-muted)'
              : 'var(--color-lx-border)',
          }}
          transition={{ duration: 0.25, ease: [0.25, 0, 0, 1] }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}
