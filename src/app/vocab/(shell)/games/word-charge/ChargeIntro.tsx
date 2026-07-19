'use client';

/**
 * ChargeIntro — one-time first-run intro + demo gate.
 * Student must actually swipe/click the demo "Confident" card right to proceed.
 * After completion, localStorage['lx-charge-intro']='1' prevents re-showing.
 * A "?" help icon on the playing header reopens this (in a paused state).
 */

import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";
const VELOCITY_THRESHOLD = 600;

interface Props {
  onDone:   () => void;
  onSkip:   () => void;
  reduce:   boolean;
  asOverlay?: boolean; // when opened from help icon on paused state
}

/**
 * The live demo card — student must drag right ("Confident" → Positive) to advance.
 * A ghost-hand hint CSS animation appears after 2s idle.
 */
function DemoCard({ onSwipedRight, reduce }: { onSwipedRight: () => void; reduce: boolean }) {
  const dragX    = useMotionValue(0);
  const rotate   = useTransform(dragX, [-120, 0, 120], [-6, 0, 6]);
  const [dragging, setDragging]   = useState(false);
  const [committed, setCommitted] = useState(false);
  const [showHint, setShowHint]   = useState(false);
  const locked = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show ghost-hand after 2s idle
  function startHintTimer() {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setShowHint(true), 2000);
  }

  // On mount: start timer
  // Using inline approach: show hint if not dragging after 2s
  useState(() => { startHintTimer(); return undefined; });

  const posOpacity = useTransform(dragX, [0, 100], [0, 0.65]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    setDragging(false);
    setShowHint(false);
    startHintTimer();
    if (locked.current) return;

    const ox = info.offset.x;
    const vx = info.velocity.x;
    const threshold = 100;
    const fling = Math.abs(vx) > VELOCITY_THRESHOLD && Math.abs(ox) >= 60;
    const dist  = Math.abs(ox) >= threshold;

    if ((dist || fling) && ox > 0) {
      locked.current = true;
      setCommitted(true);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      setTimeout(() => onSwipedRight(), reduce ? 200 : 480);
    }
  }

  const containerRef = useRef<HTMLDivElement>(null);

  function handleButtonClick() {
    if (locked.current) return;
    locked.current = true;
    setCommitted(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setTimeout(() => onSwipedRight(), reduce ? 100 : 320);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 320, margin: '0 auto' }}>
      <motion.div
        drag={committed ? false : 'x'}
        dragSnapToOrigin
        dragElastic={0.6}
        style={{
          x: dragX,
          rotate,
          touchAction: 'none',
          cursor: committed ? 'default' : 'grab',
          userSelect: 'none',
          position: 'relative',
        }}
        onDragStart={() => { setDragging(true); setShowHint(false); if (hintTimer.current) clearTimeout(hintTimer.current); }}
        onDragEnd={committed ? undefined : handleDragEnd}
      >
        <div style={{
          background: 'var(--color-lx-surface)',
          border: committed ? '2px solid rgba(244,168,40,0.7)' : '1px solid var(--color-lx-border)',
          borderRadius: 16,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 130,
          position: 'relative',
          overflow: 'hidden',
          transition: 'border-color 0.25s',
        }}>
          <p style={{
            fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
            fontSize: 'clamp(1.8rem, 7vw, 2.5rem)',
            color: committed ? 'var(--color-lx-accent-gold)' : 'var(--color-lx-text-primary)',
            transition: 'color 0.25s',
          }}>
            Confident
          </p>
          <p style={{ fontFamily: SANS, fontSize: '0.65rem', color: 'var(--color-lx-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '0.5rem' }}>
            adjective
          </p>

          {/* Positive tint overlay — only while dragging */}
          {dragging && (
            <motion.div
              aria-hidden
              style={{
                opacity: posOpacity,
                position: 'absolute', inset: 0, zIndex: 10,
                borderRadius: 16, pointerEvents: 'none',
                background: 'rgba(244,168,40,0.18)',
                border: '2px solid rgba(244,168,40,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: '1rem',
              }}
            >
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-lx-accent-gold)' }}>
                + POSITIVE
              </span>
            </motion.div>
          )}

          {/* Committed checkmark */}
          {committed && (
            <div aria-hidden style={{
              position: 'absolute', top: 8, right: 10,
              fontFamily: SANS, fontSize: '0.75rem', fontWeight: 700,
              color: 'var(--color-lx-accent-gold)',
            }}>
              ✓ Positive
            </div>
          )}
        </div>
      </motion.div>

      {/* Ghost-hand hint — pure CSS animation, frozen state = opacity:0 at 99% */}
      {showHint && !committed && !reduce && (
        <div
          aria-hidden
          className="lx-charge-ghost-hand"
          style={{
            position: 'absolute',
            bottom: -10,
            left: '30%',
            fontSize: '1.6rem',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          👆
        </div>
      )}

      {/* Button alternative */}
      {!committed && (
        <button
          onClick={handleButtonClick}
          style={{
            marginTop: '0.75rem',
            width: '100%',
            padding: '0.65rem',
            background: 'rgba(244,168,40,0.12)',
            border: '1px solid rgba(244,168,40,0.35)',
            borderRadius: 12,
            fontFamily: SANS,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--color-lx-accent-gold)',
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          + Positive ←tap if no touch
        </button>
      )}

      {/* Ghost-hand keyframes injected inline */}
      <style>{`
        @keyframes lx-ghost-hand-slide {
          0%   { transform: translateX(0); opacity: 0.9; }
          40%  { transform: translateX(55px); opacity: 0.9; }
          65%  { transform: translateX(55px); opacity: 0.5; }
          99%  { transform: translateX(0); opacity: 0; }
          100% { transform: translateX(0); opacity: 0; }
        }
        .lx-charge-ghost-hand {
          animation: lx-ghost-hand-slide 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function ChargeIntro({ onDone, onSkip, reduce, asOverlay }: Props) {
  const [step, setStep] = useState<'info' | 'demo'>('info');
  const [demoComplete, setDemoComplete] = useState(false);

  function handleDemoComplete() {
    setDemoComplete(true);
    setTimeout(() => onDone(), reduce ? 100 : 400);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.22 }}
      style={{
        position: asOverlay ? 'fixed' : 'relative',
        inset: asOverlay ? 0 : undefined,
        zIndex: asOverlay ? 60 : undefined,
        background: asOverlay ? 'rgba(0,0,0,0.72)' : 'var(--color-lx-base)',
        backdropFilter: asOverlay ? 'blur(6px)' : undefined,
        WebkitBackdropFilter: asOverlay ? 'blur(6px)' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1.25rem',
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--color-lx-surface)',
        border: '1px solid var(--color-lx-border)',
        borderRadius: 20,
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}>
        {/* Skip button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onSkip}
            style={{
              background: 'none', border: 'none',
              fontFamily: SANS, fontSize: '0.75rem', fontWeight: 500,
              color: 'var(--color-lx-text-muted)',
              cursor: 'pointer', padding: '0.375rem 0.5rem', minHeight: 44, minWidth: 44,
              display: 'flex', alignItems: 'center',
            }}
          >
            Skip, I&apos;ve got it
          </button>
        </div>

        {step === 'info' && (
          <motion.div
            key="info"
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -6 }}
            transition={{ duration: reduce ? 0 : 0.22 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            {/* Beat 1 */}
            <div>
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, fontSize: '1.7rem', color: 'var(--color-lx-text-primary)', lineHeight: 1.1 }}>
                Words carry a charge.
              </p>
              <p style={{ fontFamily: SANS, fontSize: '0.82rem', color: 'var(--color-lx-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>
                A <em>connotation</em> is the feeling a word carries — beyond its literal meaning.
              </p>
            </div>

            {/* Beat 2: example pair */}
            <div style={{
              display: 'flex', gap: 12, alignItems: 'stretch',
            }}>
              <div style={{
                flex: 1, padding: '0.875rem 1rem',
                background: 'rgba(244,168,40,0.08)',
                border: '1px solid rgba(244,168,40,0.3)',
                borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-lx-text-primary)' }}>Confident</span>
                <span style={{ fontFamily: SANS, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-lx-accent-gold)' }}>+ Positive</span>
              </div>
              <div style={{
                flex: 1, padding: '0.875rem 1rem',
                background: 'rgba(91,163,245,0.08)',
                border: '1px solid rgba(91,163,245,0.3)',
                borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-lx-text-primary)' }}>Arrogant</span>
                <span style={{ fontFamily: SANS, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-lx-mastery-familiar)' }}>− Negative</span>
              </div>
            </div>

            {/* Beat 3 */}
            <p style={{ fontFamily: SANS, fontSize: '0.82rem', color: 'var(--color-lx-text-secondary)', lineHeight: 1.6 }}>
              30 seconds. Swipe left for negative, right for positive. As many words as you can.
              <br />
              <span style={{ color: 'var(--color-lx-text-muted)', fontSize: '0.76rem' }}>Wrong answers pause the timer and teach you the word.</span>
            </p>

            <motion.button
              whileTap={{ scale: 0.975 }}
              onClick={() => setStep('demo')}
              style={{
                width: '100%', padding: '0.9rem',
                background: 'var(--color-lx-accent-red)',
                border: 'none', borderRadius: 14,
                fontFamily: SANS, fontSize: '0.9rem', fontWeight: 700,
                color: '#fff', cursor: 'pointer', minHeight: 48,
              }}
            >
              Try it →
            </motion.button>
          </motion.div>
        )}

        {step === 'demo' && (
          <motion.div
            key="demo"
            initial={{ opacity: 0, y: reduce ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.22 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}
          >
            <p style={{ fontFamily: SANS, fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-lx-text-secondary)', textAlign: 'center' }}>
              Swipe <span style={{ color: 'var(--color-lx-accent-gold)', fontWeight: 700 }}>right</span> for positive to continue.
            </p>

            <DemoCard onSwipedRight={handleDemoComplete} reduce={reduce} />

            {demoComplete && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ fontFamily: SANS, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-lx-success)', textAlign: 'center' }}
              >
                ✓ Correct! Starting…
              </motion.p>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
