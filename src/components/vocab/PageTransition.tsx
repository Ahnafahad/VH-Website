'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

// IMPORTANT: This wrapper intentionally uses ONLY opacity + filter (blur) animations.
// DO NOT add transform/x/y/scale here. A CSS transform on a wrapper creates a new
// CSS containing block, which breaks position:fixed descendants (BottomNav, rating
// bars, DailyDossier, etc.). Opacity and filter are composited without creating a
// containing block and are therefore safe.

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname           = usePathname();
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={
          shouldReduceMotion
            ? { opacity: 1 }
            : { opacity: 0, filter: 'blur(4px)' }
        }
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={
          shouldReduceMotion
            ? { opacity: 1 }
            : { opacity: 0, filter: 'blur(4px)' }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 0.25, ease: 'easeOut' }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
