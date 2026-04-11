'use client';

import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export default function AnimatedNumber({ value }: { value: number }) {
  const spring   = useSpring(0, { stiffness: 100, damping: 20 });
  const display  = useTransform(spring, v => Math.round(v).toLocaleString());

  useEffect(() => { spring.set(value); }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}
