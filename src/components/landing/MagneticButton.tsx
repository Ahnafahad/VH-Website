'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  strength?: number;
  as?: 'button' | 'div';
}

export function MagneticButton({
  children,
  className,
  onClick,
  strength = 0.35,
  as = 'button',
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xSpring = useSpring(x, { stiffness: 180, damping: 18, mass: 0.5 });
  const ySpring = useSpring(y, { stiffness: 180, damping: 18, mass: 0.5 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - rect.width / 2;
    const my = e.clientY - rect.top - rect.height / 2;
    x.set(mx * strength);
    y.set(my * strength);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  const Component = as === 'div' ? motion.div : motion.button;

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ x: xSpring, y: ySpring }}
      className="inline-block"
    >
      <Component onClick={onClick} className={cn('relative', className)}>
        {children}
      </Component>
    </motion.div>
  );
}
