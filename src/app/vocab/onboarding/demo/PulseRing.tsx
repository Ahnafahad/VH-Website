'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface PulseRingProps {
  active: boolean;
  shape?: string;       // border-radius value, e.g. '0.75rem', '9999px'
  color?: string;       // CSS color, defaults to accent-red
}

export default function PulseRing({
  active,
  shape = '0.75rem',
  color = 'var(--color-lx-accent-red)',
}: PulseRingProps) {
  return (
    <AnimatePresence>
      {active && (
        <>
          {/* Inner ring */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              inset: -4,
              borderRadius: shape,
              border: `1.5px solid ${color}`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{
              opacity: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
              scale: { duration: 0.3 },
            }}
          />
          {/* Outer ring */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              inset: -8,
              borderRadius: shape,
              border: `1px solid ${color}`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.4, 0.1] }}
            exit={{ opacity: 0, scale: 1.15 }}
            transition={{
              opacity: { duration: 2.0, repeat: Infinity, ease: 'easeInOut', delay: 0.4 },
              scale: { duration: 0.3 },
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}
