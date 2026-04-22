'use client';

/**
 * DailyDossier — fullscreen daily note from L.
 *
 * Shown exactly once per calendar day, on the first authenticated action inside
 * LexiCore (signalled by /api/vocab/daily-login returning `awarded: true`).
 * Auto-dismisses after 10 seconds; also dismissed by the close button, Esc,
 * the backdrop, or the "Continue" link. Day-gated via localStorage so it
 * survives reloads without re-triggering.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

const AUTO_DISMISS_MS = 10_000;
const RING_SIZE       = 44;
const RING_RADIUS     = 19;
const RING_CIRC       = 2 * Math.PI * RING_RADIUS;

export interface DailyDossierProps {
  message:   string;
  onDismiss: () => void;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  return reduced;
}

export function DailyDossier({ message, onDismiss }: DailyDossierProps) {
  const [mounted, setMounted]           = useState(false);
  const [remaining, setRemaining]       = useState(AUTO_DISMISS_MS);
  const closeBtnRef                     = useRef<HTMLButtonElement | null>(null);
  const prefersReducedMotion            = usePrefersReducedMotion();

  useEffect(() => { setMounted(true); }, []);

  // Auto-dismiss timer + live countdown for the ring (fires every 100ms — cheap).
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const left    = Math.max(0, AUTO_DISMISS_MS - elapsed);
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        onDismiss();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [onDismiss]);

  // Esc to dismiss.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  // Move focus onto the close button on mount (lightweight focus trap —
  // the overlay has only one control besides the "Continue" link).
  useEffect(() => {
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, []);

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const dismiss = useCallback(() => onDismiss(), [onDismiss]);

  if (!mounted) return null;

  const progress = prefersReducedMotion ? 1 : remaining / AUTO_DISMISS_MS;
  const dashoffset = RING_CIRC * (1 - progress);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="dossier"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-title"
        aria-describedby="dossier-body"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={dismiss}
        style={{
          position:        'fixed',
          inset:           0,
          zIndex:          9999,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         '24px',
          background:
            'radial-gradient(circle at 50% 30%, rgba(230,57,70,0.18), rgba(15,15,15,0.82) 55%, rgba(15,15,15,0.94))',
          backdropFilter:  'blur(20px) saturate(120%)',
          WebkitBackdropFilter: 'blur(20px) saturate(120%)',
        }}
      >
        {/* Subtle file-folder seal: crimson hairline at the top */}
        <motion.article
          onClick={(e) => e.stopPropagation()}
          initial={prefersReducedMotion
            ? { opacity: 0 }
            : { opacity: 0, y: 18, filter: 'blur(8px)', scale: 0.98 }
          }
          animate={prefersReducedMotion
            ? { opacity: 1 }
            : { opacity: 1, y: 0,  filter: 'blur(0px)', scale: 1 }
          }
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
          style={{
            position:      'relative',
            width:         'min(560px, 92vw)',
            padding:       '40px clamp(24px, 5vw, 48px) 36px',
            background:    'var(--color-lx-surface)',
            border:        '1px solid rgba(230,57,70,0.22)',
            borderRadius:  '2px',
            boxShadow:
              '0 60px 120px -30px rgba(230,57,70,0.28), 0 30px 60px -20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(244,168,40,0.06)',
          }}
        >
          {/* Crimson hairline rule at top (like a wax-sealed envelope) */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: '2px',
              background:
                'linear-gradient(90deg, transparent 0%, var(--color-lx-accent-red) 30%, var(--color-lx-accent-gold) 50%, var(--color-lx-accent-red) 70%, transparent 100%)',
              opacity: 0.85,
            }}
          />

          {/* Close button + countdown ring */}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={dismiss}
            aria-label={`Dismiss dossier (auto-closes in ${Math.ceil(remaining / 1000)} seconds)`}
            style={{
              position:       'absolute',
              top:            16,
              right:          16,
              width:          RING_SIZE,
              height:         RING_SIZE,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     'transparent',
              border:         'none',
              cursor:         'pointer',
              color:          'var(--color-lx-text-primary)',
              borderRadius:   '50%',
            }}
          >
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              aria-hidden
              style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
            >
              {/* Track */}
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="rgba(244,168,40,0.14)"
                strokeWidth={1.25}
              />
              {/* Progress — depletes as time runs out */}
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke="var(--color-lx-accent-gold)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={dashoffset}
                style={{ transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 100ms linear' }}
              />
            </svg>
            <X size={16} strokeWidth={1.6} aria-hidden />
          </button>

          {/* Case-file caption */}
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        10,
              marginBottom: 18,
            }}
          >
            <span
              aria-hidden
              style={{
                display:      'inline-block',
                width:        6,
                height:       6,
                borderRadius: '50%',
                background:   'var(--color-lx-accent-red)',
                boxShadow:    '0 0 12px rgba(230,57,70,0.65)',
              }}
            />
            <span
              style={{
                fontFamily:    "'Sora', sans-serif",
                fontSize:      10,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color:         'var(--color-lx-accent-gold)',
                fontWeight:    500,
              }}
            >
              Dossier · {formatLongDate(new Date())}
            </span>
          </div>

          {/* Headline */}
          <h2
            id="dossier-title"
            className="lx-word"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize:   'clamp(2rem, 5.2vw, 2.75rem)',
              lineHeight: 1.05,
              margin:     '0 0 22px 0',
              color:      'var(--color-lx-text-primary)',
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            <em style={{ fontStyle: 'italic', fontWeight: 400 }}>L</em> has filed a note.
          </h2>

          {/* Message body — quoted style with left crimson rule */}
          <blockquote
            id="dossier-body"
            aria-live="polite"
            style={{
              position:    'relative',
              padding:     '4px 0 4px 20px',
              margin:      0,
              borderLeft:  '2px solid rgba(230,57,70,0.55)',
            }}
          >
            <p
              className="lx-word"
              style={{
                fontFamily:   "'Cormorant Garamond', Georgia, serif",
                fontStyle:    'italic',
                fontSize:     'clamp(1.125rem, 2.4vw, 1.375rem)',
                lineHeight:   1.55,
                color:        'var(--color-lx-text-primary)',
                margin:       0,
                fontWeight:   400,
              }}
            >
              {message}
            </p>
          </blockquote>

          {/* Footer row — continue link + signature */}
          <div
            style={{
              marginTop:      30,
              paddingTop:     18,
              borderTop:      '1px solid var(--color-lx-border)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              gap:            16,
              flexWrap:       'wrap',
            }}
          >
            <span
              style={{
                fontFamily:    "'Sora', sans-serif",
                fontSize:      10,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color:         'var(--color-lx-text-muted)',
              }}
            >
              Filed by L · Confidential
            </span>

            <motion.button
              type="button"
              onClick={dismiss}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              style={{
                display:        'inline-flex',
                alignItems:     'center',
                gap:            8,
                padding:        '6px 2px',
                background:     'transparent',
                border:         'none',
                cursor:         'pointer',
                color:          'var(--color-lx-accent-gold)',
                fontFamily:     "'Sora', sans-serif",
                fontSize:       12,
                letterSpacing:  '0.2em',
                textTransform:  'uppercase',
                fontWeight:     500,
              }}
            >
              Continue
              <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>→</span>
            </motion.button>
          </div>
        </motion.article>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
