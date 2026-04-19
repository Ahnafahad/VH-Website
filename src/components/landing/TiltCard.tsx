'use client';

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  depth?: number;
}

export function TiltCard({
  children,
  className,
  maxTilt = 10,
  depth = 30,
}: TiltCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xSpring = useSpring(x, { stiffness: 150, damping: 15 });
  const ySpring = useSpring(y, { stiffness: 150, damping: 15 });

  const rotateX = useTransform(ySpring, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(xSpring, [-0.5, 0.5], [-maxTilt, maxTilt]);
  const lightX = useTransform(xSpring, [-0.5, 0.5], [0, 100]);
  const lightY = useTransform(ySpring, [-0.5, 0.5], [0, 100]);

  const lightBackground = useMotionTemplate`radial-gradient(circle at ${lightX}% ${lightY}%, rgba(250,245,239,0.6), transparent 50%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width - 0.5;
    const my = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(mx);
    y.set(my);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      className={cn('relative', className)}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        transformPerspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ transform: `translateZ(${depth}px)`, transformStyle: 'preserve-3d' }}>
        {children}
      </div>
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60 mix-blend-soft-light"
        style={{ background: lightBackground }}
      />
    </motion.div>
  );
}
