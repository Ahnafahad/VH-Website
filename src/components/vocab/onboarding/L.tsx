'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * L's mark — the LexiCore logo, cropped in tight. Deliberately not a
 * character, not an illustration, not a mascot: L observes and says one thing.
 */
export function LMark({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: size * 0.28,
        overflow: 'hidden',
        position: 'relative',
        display: 'block',
        background: '#000',
        boxShadow: '0 0 0 1px rgba(244,168,40,0.35)',
      }}
    >
      <Image
        src="/lexicore-logo.png"
        alt=""
        fill
        sizes={`${size}px`}
        style={{ objectFit: 'cover', objectPosition: '50% 50%', transform: 'scale(1.45)' }}
      />
    </span>
  );
}

/**
 * One sentence, two at the very most. If it needs three, it isn't an
 * observation any more — it's a lecture.
 */
export default function LSays({ children, delay = 0 }: { children: string; delay?: number }) {
  const reduce = useReducedMotion() ?? false;
  const [typed, setTyped] = useState(reduce ? children : '');
  const [done, setDone] = useState(reduce);

  useEffect(() => {
    if (reduce) {
      setTyped(children);
      setDone(true);
      return;
    }
    setTyped('');
    setDone(false);
    // Faster per-character for longer lines so nothing outstays ~1s of typing.
    const msPerChar = Math.min(38, Math.max(14, 900 / children.length));
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setTyped(children.slice(0, i));
        if (i >= children.length) {
          if (interval) clearInterval(interval);
          setDone(true);
        }
      }, msPerChar);
    }, delay * 1000 + 220); // let the box finish fading in before L starts "writing"

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [children, delay, reduce]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0.15 : 0.22, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
      style={{
        background: 'var(--color-lx-surface)',
        border: '1px solid var(--color-lx-border)',
        borderLeft: '3px solid var(--color-lx-accent-gold)',
      }}
    >
      <LMark />
      <p style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 'clamp(1.05rem, 4.2vw, 1.35rem)',
        lineHeight: 1.5,
        color: 'var(--color-lx-text-primary)',
        margin: 0,
      }}>
        <span className="sr-only">{children}</span>
        <span aria-hidden="true">
          {typed}
          {!done && (
            <motion.span
              aria-hidden
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{ repeat: Infinity, duration: 0.9, times: [0, 0.5, 0.5, 1], ease: 'linear' }}
              style={{
                display: 'inline-block',
                width: '0.55em',
                height: '1em',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                background: 'var(--color-lx-accent-gold)',
              }}
            />
          )}
        </span>
      </p>
    </motion.div>
  );
}
