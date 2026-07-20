'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

// IMPORTANT: This wrapper intentionally uses ONLY opacity animations.
// DO NOT add transform/x/y/scale OR filter (even blur(0px)) here. Both transform
// and any non-none filter create a CSS containing block, which breaks
// position:fixed descendants (QuizConfigSheet, BottomNav, rating bars,
// DailyDossier, etc.) — framer-motion leaves the final inline value in place,
// so `filter: blur(0px)` permanently re-parented fixed children and rendered
// the quiz config sheet off-screen. Opacity alone is safe.

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname           = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const wrapperRef         = useRef<HTMLDivElement>(null);

  // If navigation happens while the tab is hidden, the entrance opacity
  // animation can never visually play and (per the framer-motion bug this
  // hook works around) may never resolve either. Skip it imperatively —
  // this runs client-side only, after hydration, so it can't cause a
  // hydration mismatch.
  useEffect(() => {
    if (document.hidden && wrapperRef.current) {
      wrapperRef.current.style.opacity = '1';
    }
  }, [pathname]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        ref={wrapperRef}
        initial={
          shouldReduceMotion
            ? { opacity: 1 }
            : { opacity: 0 }
        }
        animate={{ opacity: 1 }}
        exit={
          shouldReduceMotion
            ? { opacity: 1 }
            : { opacity: 0 }
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
