'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard } from 'lucide-react';
import DemoSlideLayout from '../DemoSlideLayout';
import PulseRing from '../PulseRing';
import DemoInstruction from '../DemoInstruction';

const ZONES = [
  { id: 'points',  label: 'Your total points',           x: 'left'   as const },
  { id: 'streak',  label: 'Days studied in a row',       x: 'center' as const },
  { id: 'session', label: 'Your next study session',     x: 'right'  as const },
] as const;

interface Props { onNext: () => void; stepLabel: string }

export default function SlideHome({ onNext, stepLabel }: Props) {
  const [tapped, setTapped] = useState<Set<string>>(new Set());
  const allTapped = tapped.size >= 3;

  const tap = useCallback((id: string) => {
    setTapped(prev => new Set(prev).add(id));
  }, []);

  return (
    <DemoSlideLayout
      icon={<LayoutDashboard size={22} />}
      label="Home Screen"
      title="Your Command Centre"
      description="Everything you need before your IBA/BUP exam — points, streak, and today's sessions — in one glance. Open this daily and you'll never fall behind."
      subtext="Students who check their dashboard daily score 23% higher on vocab-heavy exam sections."
      ctaLabel="Next"
      ctaDisabled={!allTapped}
      onCta={onNext}
      stepLabel={stepLabel}
    >
      {/* Mini home screen mockup */}
      <div className="flex w-full flex-col gap-3">
        {/* Top instruction bar */}
        <DemoInstruction
          activeText="Tap each highlighted zone"
          doneText="Your daily HQ — check it every morning"
          done={allTapped}
          progress={`${tapped.size} of 3 explored`}
        />

        {/* Stats row */}
        <div className="flex items-center justify-between gap-2">
          {/* Points badge */}
          <ZoneTap id="points" tapped={tapped} onTap={tap}>
            <div className="flex items-center gap-1.5">
              <div
                className="h-5 w-5 rounded-md"
                style={{ background: 'rgba(244,168,40,0.18)' }}
              />
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--color-lx-accent-gold)',
                }}
              >
                245 pts
              </span>
            </div>
          </ZoneTap>

          {/* Streak fire */}
          <ZoneTap id="streak" tapped={tapped} onTap={tap}>
            <div className="flex items-center gap-1.5">
              <div
                className="h-5 w-5 rounded-md"
                style={{ background: 'rgba(230,57,70,0.18)' }}
              />
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--color-lx-accent-red)',
                }}
              >
                7 days
              </span>
            </div>
          </ZoneTap>
        </div>

        {/* Session row */}
        <ZoneTap id="session" tapped={tapped} onTap={tap}>
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{
              background: 'var(--color-lx-elevated)',
              border: '1px solid var(--color-lx-border)',
            }}
          >
            <div
              className="h-8 w-1 rounded-full"
              style={{ background: 'var(--color-lx-accent-red)' }}
            />
            <div className="flex flex-col">
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-lx-text-primary)',
                }}
              >
                Learn · Unit 3
              </span>
              <span
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.65rem',
                  color: 'var(--color-lx-text-muted)',
                }}
              >
                Anger &amp; Conflict · 12 words
              </span>
            </div>
          </div>
        </ZoneTap>
      </div>
    </DemoSlideLayout>
  );
}

/* ── Tappable zone wrapper ──────────────────────────────────── */

function ZoneTap({
  id,
  tapped,
  onTap,
  children,
}: {
  id: string;
  tapped: Set<string>;
  onTap: (id: string) => void;
  children: React.ReactNode;
}) {
  const isTapped = tapped.has(id);
  const zone = ZONES.find(z => z.id === id)!;

  return (
    <div className="relative">
      <PulseRing
        active={!isTapped}
        shape={id === 'session' ? '0.75rem' : '0.5rem'}
      />
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onTap(id)}
        className="relative rounded-lg"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {/* Pulse ring on tap */}
        {isTapped && (
          <motion.div
            className="absolute -inset-1 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 0.8 }}
            style={{ border: '1.5px solid var(--color-lx-accent-red)' }}
          />
        )}
        {children}
      </motion.button>

      {/* Tooltip */}
      <AnimatePresence>
        {isTapped && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1"
            style={{
              top: '100%',
              marginTop: 6,
              background: 'var(--color-lx-surface)',
              border: '1px solid var(--color-lx-border)',
              fontFamily: "'Sora', sans-serif",
              fontSize: '0.6rem',
              color: 'var(--color-lx-text-secondary)',
              zIndex: 10,
            }}
          >
            {zone.label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
