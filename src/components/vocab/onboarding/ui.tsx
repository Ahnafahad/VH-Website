'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CardPrefs } from '@/lib/vocab/card-prefs';

/**
 * Stage transition used by every onboarding step, pre- and post-signin.
 * `initial`/`animate`/`exit` never branch on `reduce` — useReducedMotion()
 * resolves to a different value on the client's first render than on the
 * server, so branching the *initial* pose on it causes a hydration mismatch.
 * Only `transition.duration` (an animate-phase value, applied after
 * hydration) is safe to vary by `reduce`.
 */
export function Fade({ children, reduce, skipEntrance }: { children: React.ReactNode; reduce: boolean; skipEntrance?: boolean }) {
  return (
    <motion.div
      initial={skipEntrance ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

export function PrimaryButton({ children, onClick, disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className="w-full rounded-2xl py-4 text-base font-semibold"
      style={{
        background: 'var(--color-lx-accent-red)',
        color: '#fff',
        fontFamily: "'Sora', sans-serif",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </motion.button>
  );
}

const CARD_OPTIONS: { key: keyof CardPrefs; label: string }[] = [
  { key: 'showExample',     label: 'a sentence' },
  { key: 'showSynonyms',    label: 'near words' },
  { key: 'showConnotation', label: 'how it feels' },
  { key: 'showContrast',    label: 'what it isn’t' },
];

/**
 * The card is restyled by tapping words, never by a list of labelled switches —
 * the same row is reused wherever preferences are editable so the interaction
 * is identical in onboarding and later on.
 */
export function CardStyleChips({ prefs, setPrefs }: { prefs: CardPrefs; setPrefs: (p: CardPrefs) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        active={prefs.definitionVariant === 'alt'}
        label="plain wording"
        onClick={() => setPrefs({
          ...prefs,
          definitionVariant: prefs.definitionVariant === 'alt' ? 'standard' : 'alt',
        })}
      />
      {CARD_OPTIONS.map(o => (
        <Chip
          key={o.key}
          active={prefs[o.key] as boolean}
          label={o.label}
          onClick={() => setPrefs({ ...prefs, [o.key]: !prefs[o.key] })}
        />
      ))}
    </div>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  const [flash, setFlash] = useState(false);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 380);
      return () => clearTimeout(t);
    }
    wasActive.current = active;
  }, [active]);

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      aria-pressed={active}
      className="relative min-h-11 rounded-full px-3.5 py-2 text-sm"
      style={{
        fontFamily: "'Sora', sans-serif",
        background: active ? 'rgba(244,168,40,0.14)' : 'var(--color-lx-elevated)',
        color:      active ? 'var(--color-lx-accent-gold)' : 'var(--color-lx-text-secondary)',
        border:     `1px solid ${active ? 'rgba(244,168,40,0.38)' : 'var(--color-lx-border)'}`,
        boxShadow:  active ? '0 0 0 3px rgba(244,168,40,0.12), 0 2px 6px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.15)',
      }}
    >
      {label}
      <AnimatePresence>
        {flash && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 0 4px rgba(244,168,40,0.45)' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}
