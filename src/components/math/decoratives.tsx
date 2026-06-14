'use client';

import React from 'react';

/**
 * Section "ledger" mark — small caps chapter label with a gold rule.
 * Used in setup / results / leaderboard headers.
 */
export function SectionMark({ chapter, title }: { chapter: string; title: string }) {
  return (
    <div className="font-sans text-[11px] tracking-[0.3em] uppercase flex items-center gap-3 text-[var(--color-math-accent-gold)]/70">
      <span className="w-8 h-px bg-[var(--color-math-accent-gold)]/70" />
      {chapter} / {title}
    </div>
  );
}

/** Four-corner editorial brackets drawn with absolute spans inside a relative container. */
export function CornerBrackets({ accent = 'var(--color-math-accent-gold)' }: { accent?: string }) {
  const tone = `color-mix(in oklab, ${accent} 65%, transparent)`;
  return (
    <>
      <span className="absolute top-4 left-4 w-4 h-px" style={{ backgroundColor: tone }} />
      <span className="absolute top-4 left-4 w-px h-4" style={{ backgroundColor: tone }} />
      <span className="absolute top-4 right-4 w-4 h-px" style={{ backgroundColor: tone }} />
      <span className="absolute top-4 right-4 w-px h-4" style={{ backgroundColor: tone }} />
      <span className="absolute bottom-4 left-4 w-4 h-px" style={{ backgroundColor: tone }} />
      <span className="absolute bottom-4 left-4 w-px h-4 -translate-y-4" style={{ backgroundColor: tone }} />
      <span className="absolute bottom-4 right-4 w-4 h-px" style={{ backgroundColor: tone }} />
      <span className="absolute bottom-4 right-4 w-px h-4 -translate-y-4" style={{ backgroundColor: tone }} />
    </>
  );
}

/** Ornamental giant marginal numeral (watermark-style). */
export function MarginalNumeral({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="absolute -top-6 -right-3 font-heading italic font-extralight leading-none pointer-events-none select-none text-[7rem] text-[var(--color-math-accent-gold)]/15"
    >
      {children}
    </span>
  );
}

/** A thin "ticker" style divider used between groups. */
export function TickerRule() {
  return (
    <div aria-hidden className="relative h-px w-full">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-math-accent-gold)]/30 to-transparent" />
    </div>
  );
}

export const RANK_LABEL = (i: number) =>
  i === 0 ? '01' : i === 1 ? '02' : i === 2 ? '03' : String(i + 1).padStart(2, '0');

/** Soft gold halo for celebration states — stack under content with negative z. */
export function GoldHalo({ intensity = 0.22 }: { intensity?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(ellipse 60% 40% at 50% 50%, rgba(212, 168, 75, ${intensity}), transparent 60%)`,
      }}
    />
  );
}
