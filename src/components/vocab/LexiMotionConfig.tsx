'use client';

import { MotionConfig } from 'framer-motion';
import { useLexiAccessibility } from '@/hooks/useLexiAccessibility';

/** Makes LexiCore's Reduce Motion setting reach every framer-motion animation, portals included. */
export default function LexiMotionConfig({ children }: { children: React.ReactNode }) {
  const { reduceMotion } = useLexiAccessibility();
  return <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>;
}
