'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { LimitKind } from '@/lib/vocab/limit';

interface Props {
  /** Which free daily limit was hit. Omit for a plain "get unlimited" prompt. */
  kind?:   LimitKind;
  onClose: () => void;
}

const C = {
  surface:  'var(--color-lx-surface)',
  elevated: 'var(--color-lx-elevated)',
  border:   'var(--color-lx-border)',
  red:      'var(--color-lx-accent-red)',
  gold:     'var(--color-lx-accent-gold)',
  textPrim: 'var(--color-lx-text-primary)',
  textSec:  'var(--color-lx-text-secondary)',
  textMuted:'var(--color-lx-text-muted)',
} as const;
const SERIF = "var(--font-lexi-word), Georgia, serif";
const SANS  = "var(--font-lexi-ui), system-ui, sans-serif";

/** The one "free plan limit / upgrade" prompt, used by every gated flashcard and quiz call site. */
export default function UpgradeModal({ kind, onClose }: Props) {
  const title = kind === 'cards'
    ? "You've used today's free flashcards (20/day)"
    : kind === 'quizzes'
      ? "You've used today's free quizzes (2/day)"
      : 'Get unlimited LexiCore';

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,5,7,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      />
      <motion.div
        key="sheet"
        role="dialog" aria-modal="true" aria-label={title}
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring' as const, stiffness: 340, damping: 34 } }}
        exit={{ y: '100%', transition: { duration: 0.22 } }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 61,
          maxWidth: 560, margin: '0 auto',
          background: C.surface, border: `1px solid ${C.border}`, borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          padding: '1.5rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom))',
        }}
      >
        <button
          onClick={onClose} aria-label="Close"
          style={{
            position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%',
            background: C.elevated, border: `1px solid ${C.border}`, color: C.textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        ><X size={14} /></button>

        <p style={{ fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, margin: '0 0 8px' }}>
          Free plan
        </p>
        <h2 style={{ fontFamily: SERIF, fontSize: '1.7rem', fontWeight: 700, fontStyle: 'italic', color: C.textPrim, lineHeight: 1.15, margin: '0 36px 10px 0' }}>
          {title}
        </h2>
        <p style={{ fontFamily: SANS, fontSize: '0.78rem', color: C.textSec, lineHeight: 1.65, margin: '0 0 20px' }}>
          Upgrade for ৳200 — unlimited flashcards and quizzes until 5 Dec.
        </p>

        <Link
          href="/lexicore/upgrade"
          style={{
            display: 'block', textAlign: 'center', padding: 14, borderRadius: 12,
            background: C.red, color: '#fff', fontFamily: SANS, fontSize: '0.875rem', fontWeight: 700,
            textDecoration: 'none', boxShadow: '0 4px 18px rgba(230,57,70,0.3)',
          }}
        >
          Upgrade for ৳200
        </Link>
        <Link
          href="/vocab/home"
          style={{
            display: 'block', textAlign: 'center', padding: 12, marginTop: 8, borderRadius: 12,
            color: C.textSec, fontFamily: SANS, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
          }}
        >
          Come back tomorrow
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
