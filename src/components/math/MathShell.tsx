'use client';

import React from 'react';
import { Particles } from '@/components/ui/particles';
import { GridPattern } from '@/components/ui/grid-pattern';
import { cn } from '@/lib/utils';

interface MathShellProps {
  children:  React.ReactNode;
  className?: string;
  // tone lets specific screens skew the vignette
  tone?:     'deep' | 'brass' | 'violet';
}

const VIGNETTE: Record<NonNullable<MathShellProps['tone']>, string> = {
  deep:   'radial-gradient(ellipse 120% 80% at 50% -10%, rgba(107, 95, 212, 0.18) 0%, rgba(10, 11, 26, 0) 55%), radial-gradient(ellipse 80% 60% at 50% 110%, rgba(212, 168, 75, 0.10) 0%, rgba(10, 11, 26, 0) 55%)',
  brass:  'radial-gradient(ellipse 100% 70% at 50% -15%, rgba(212, 168, 75, 0.22) 0%, rgba(10, 11, 26, 0) 58%), radial-gradient(ellipse 60% 50% at 85% 110%, rgba(107, 95, 212, 0.12) 0%, rgba(10, 11, 26, 0) 55%)',
  violet: 'radial-gradient(ellipse 110% 80% at 30% 0%, rgba(107, 95, 212, 0.28) 0%, rgba(10, 11, 26, 0) 60%), radial-gradient(ellipse 100% 70% at 80% 100%, rgba(212, 168, 75, 0.12) 0%, rgba(10, 11, 26, 0) 55%)',
};

export function MathShell({ children, className, tone = 'deep' }: MathShellProps) {
  return (
    <div className={cn('math-theme relative min-h-screen overflow-hidden', className)}>
      {/* Vignette — two-layer radial gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: VIGNETTE[tone] }}
      />

      {/* Fine indigo grid — masked to fade out at edges */}
      <GridPattern
        width={48}
        height={48}
        strokeDasharray="2 4"
        className={cn(
          'pointer-events-none absolute inset-0 z-0 h-full w-full',
          'text-[#D4A84B]/12',
          '[mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black,transparent)]',
        )}
      />

      {/* Starfield of brass motes */}
      <Particles
        quantity={40}
        color="#D4A84B"
        size={0.5}
        staticity={60}
        ease={40}
        className="pointer-events-none absolute inset-0 z-0"
      />

      {/* Foreground */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
