'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Delete } from 'lucide-react';
import { motion } from 'motion/react';
import type { FeedbackEvent } from '@/lib/math/use-math-feedback';

export interface KeypadProps {
  value:       string;
  onChange:    (next: string) => void;
  onSubmit:    () => void;
  disabled?:   boolean;
  onFeedback?: (event: FeedbackEvent) => void;
  /** Max digit count (default 6 — enough for 4-digit answers + sign flip). */
  maxLength?:  number;
}

type KeyKind = 'digit' | 'sign' | 'back' | 'submit' | 'spacer';

interface KeyDef {
  label: React.ReactNode;
  value: string;
  kind:  KeyKind;
  span?: number;
  /** aria-label for non-digit keys. */
  aria?: string;
}

const KEY_ROWS: KeyDef[][] = [
  [
    { label: '7', value: '7', kind: 'digit' },
    { label: '8', value: '8', kind: 'digit' },
    { label: '9', value: '9', kind: 'digit' },
    { label: <Delete size={18} strokeWidth={1.5} />, value: 'back', kind: 'back', aria: 'Backspace' },
  ],
  [
    { label: '4', value: '4', kind: 'digit' },
    { label: '5', value: '5', kind: 'digit' },
    { label: '6', value: '6', kind: 'digit' },
    { label: '±', value: 'sign', kind: 'sign', aria: 'Toggle sign' },
  ],
  [
    { label: '1', value: '1', kind: 'digit' },
    { label: '2', value: '2', kind: 'digit' },
    { label: '3', value: '3', kind: 'digit' },
    { label: (
        <span className="inline-flex items-center gap-2">
          <ArrowRight size={16} />
          <span className="text-[11px] tracking-[0.25em] uppercase font-sans">Enter</span>
        </span>
      ),
      value: 'submit',
      kind: 'submit',
      aria: 'Submit answer',
    },
  ],
  [
    { label: '0', value: '0', kind: 'digit', span: 3 },
    // submit already occupies row 3 col 4; leave last cell empty on row 4
    { label: '', value: '', kind: 'spacer' },
  ],
];

export function Keypad({ value, onChange, onSubmit, disabled = false, onFeedback, maxLength = 6 }: KeypadProps) {
  const [pressed, setPressed] = useState<string | null>(null);

  const applyKey = useCallback(
    (k: KeyDef) => {
      if (disabled || k.kind === 'spacer') return;

      if (k.kind === 'digit') {
        if (value.replace('-', '').length >= maxLength) return;
        onChange(value + k.value);
        onFeedback?.('tap');
        return;
      }
      if (k.kind === 'back') {
        if (value.length === 0) return;
        onChange(value.slice(0, -1));
        onFeedback?.('back');
        return;
      }
      if (k.kind === 'sign') {
        if (value === '' || value === '-') return;
        onChange(value.startsWith('-') ? value.slice(1) : `-${value}`);
        onFeedback?.('tap');
        return;
      }
      if (k.kind === 'submit') {
        if (value === '' || value === '-') return;
        onSubmit();
        onFeedback?.('submit');
      }
    },
    [value, maxLength, onChange, onSubmit, onFeedback, disabled],
  );

  // Physical keyboard mirror
  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't hijack typing inside actual input fields (e.g. name entry)
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName) && target.getAttribute('data-math-keypad-mirror') !== 'true') {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        setPressed(e.key);
        applyKey({ label: e.key, value: e.key, kind: 'digit' });
        setTimeout(() => setPressed(null), 90);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPressed('back');
        applyKey({ label: '', value: 'back', kind: 'back' });
        setTimeout(() => setPressed(null), 90);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setPressed('submit');
        applyKey({ label: '', value: 'submit', kind: 'submit' });
        setTimeout(() => setPressed(null), 90);
      } else if (e.key === '-') {
        e.preventDefault();
        setPressed('sign');
        applyKey({ label: '', value: 'sign', kind: 'sign' });
        setTimeout(() => setPressed(null), 90);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [applyKey, disabled]);

  return (
    <div
      role="group"
      aria-label="Answer keypad"
      className="mx-auto grid w-full max-w-[360px] grid-cols-4 gap-2 sm:gap-3"
    >
      {KEY_ROWS.flat().map((k, i) => {
        if (k.kind === 'spacer') {
          return <div key={`s-${i}`} className={k.span ? `col-span-${k.span}` : ''} />;
        }
        const isDigit    = k.kind === 'digit';
        const isSubmit   = k.kind === 'submit';
        const isBack     = k.kind === 'back';
        const isPressed  = pressed === k.value;
        const spanClass  = k.span === 3 ? 'col-span-3' : '';

        const base =
          'relative flex items-center justify-center rounded-xl border transition-colors duration-150 select-none font-light';
        const size = 'h-14 sm:h-16 text-2xl sm:text-3xl';
        const digitStyle  = 'math-digit text-[var(--color-math-ink)] border-[var(--color-math-border)] bg-[var(--color-math-surface)]/60 hover:border-[var(--color-math-accent-gold)]/40';
        const signStyle   = 'text-[var(--color-math-accent-gold)] border-[var(--color-math-border)] bg-[var(--color-math-surface)]/60 hover:border-[var(--color-math-accent-gold)]/40';
        const backStyle   = 'text-[var(--color-math-ink-muted)] border-[var(--color-math-border)] bg-[var(--color-math-surface)]/40 hover:border-[var(--color-math-danger)]/40 hover:text-[var(--color-math-danger)]';
        const submitStyle = 'text-[var(--color-math-base)] bg-[var(--color-math-accent-gold)] border-[var(--color-math-accent-gold)] hover:bg-[var(--color-math-accent-gold-bright)] disabled:opacity-25 disabled:cursor-not-allowed text-base sm:text-lg';
        const pressedStyle = isPressed ? 'math-glow-gold border-[var(--color-math-accent-gold)]/80' : '';

        return (
          <motion.button
            key={`${k.value}-${i}`}
            type="button"
            onClick={() => {
              setPressed(k.value);
              applyKey(k);
              setTimeout(() => setPressed(null), 110);
            }}
            disabled={disabled || (isSubmit && (value === '' || value === '-'))}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 480, damping: 22 }}
            aria-label={k.aria ?? `Digit ${k.value}`}
            className={[
              base,
              size,
              spanClass,
              isDigit ? digitStyle : '',
              k.kind === 'sign' ? signStyle : '',
              isBack ? backStyle : '',
              isSubmit ? submitStyle : '',
              pressedStyle,
            ].filter(Boolean).join(' ')}
          >
            {k.label}
          </motion.button>
        );
      })}
    </div>
  );
}
