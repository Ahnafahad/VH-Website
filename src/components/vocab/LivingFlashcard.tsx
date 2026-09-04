'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { LexiArtwork, LexiIcon } from '@/components/vocab/LexiAsset';
import { speak } from '@/lib/vocab/speak';
import type { CardPrefs } from '@/lib/vocab/card-prefs';

export interface LivingCardWord {
  id:              number;
  word:            string;
  definition:      string;
  altDefinition?:  string | null;
  partOfSpeech:    string | null;
  synonyms:        string[];
  exampleSentence: string | null;
  connotation?:    string | null;
  contrast?:       { word: string; gloss: string } | null;
}

/**
 * The card the whole product is built around: a true 3D flip, with the back
 * face composed from the user's own card preferences. Extracted from the study
 * flashcard screen so onboarding, study and settings all show the same card.
 */
export default function LivingFlashcard({
  word,
  prefs,
  isFlipped,
  onFlip,
  onFlipBack,
  onSwipeRate,
  reduce,
  footerHint,
}: {
  word: LivingCardWord;
  prefs: CardPrefs;
  isFlipped: boolean;
  onFlip: () => void;
  onFlipBack: () => void;
  /** Omit to disable swipe-to-rate (onboarding, settings preview). */
  onSwipeRate?: (r: 'got_it' | 'missed_it') => void;
  reduce: boolean;
  footerHint?: React.ReactNode;
}) {
  const dragX     = useMotionValue(0);
  const THRESHOLD = 120;

  // Live tint overlays driven by drag position
  const gotItOpacity  = useTransform(dragX, [0, THRESHOLD],  [0, 0.55]);
  const missedOpacity = useTransform(dragX, [-THRESHOLD, 0], [0.55, 0]);
  // Only mount the tint overlays while an actual drag is in progress.
  // Their opacity is motion-value driven; framer only flushes that value on
  // change, so a server-rendered opacity:1 would otherwise stay stuck visible.
  const [dragging, setDragging] = useState(false);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (!onSwipeRate) return;
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset > THRESHOLD || velocity > 500) {
      onSwipeRate('got_it');
    } else if (offset < -THRESHOLD || velocity < -500) {
      onSwipeRate('missed_it');
    }
    // below threshold — motion's dragSnapToOrigin snaps back automatically
  }

  const flipDuration = reduce ? 0.12 : 0.46;
  const speakWord    = useCallback(() => speak(word.word), [word.word]);
  const canSwipe     = Boolean(onSwipeRate) && isFlipped;

  // Definition variant falls back to the standard definition when the word has
  // no alternate one — never show an empty card.
  const shownDefinition = prefs.definitionVariant === 'alt' && word.altDefinition
    ? word.altDefinition
    : word.definition;

  // Whole-card "responded" pulse whenever card preferences change.
  const prefsKey = JSON.stringify(prefs);
  const prevPrefsKey = useRef(prefsKey);
  const [prefsPulse, setPrefsPulse] = useState(false);
  useEffect(() => {
    if (prevPrefsKey.current !== prefsKey && !reduce) {
      setPrefsPulse(true);
      const t = setTimeout(() => setPrefsPulse(false), 220);
      prevPrefsKey.current = prefsKey;
      return () => clearTimeout(t);
    }
    prevPrefsKey.current = prefsKey;
  }, [prefsKey, reduce]);

  return (
    <div className="relative w-full" style={{ perspective: '2000px', flex: 1 }}>
      {/* Swipe drag wrapper — only active once flipped */}
      <motion.div
        drag={canSwipe ? 'x' : false}
        dragSnapToOrigin
        dragElastic={0.5}
        style={{ x: dragX, flex: 1, height: '100%', position: 'relative', transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
        onDragStart={() => setDragging(true)}
        onDragEnd={canSwipe ? (e, info) => { setDragging(false); handleDragEnd(e, info); } : undefined}
      >
        {dragging && (<>
          {/* GOT IT hint overlay */}
          <motion.div
            aria-hidden
            style={{
              opacity: gotItOpacity,
              position: 'absolute', inset: 0, zIndex: 10,
              borderRadius: 20, pointerEvents: 'none',
              background: 'rgba(46,204,113,0.18)',
              border: '2px solid rgba(46,204,113,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-lx-success)', letterSpacing: '0.08em' }}>
              GOT IT
            </span>
          </motion.div>

          {/* MISSED hint overlay */}
          <motion.div
            aria-hidden
            style={{
              opacity: missedOpacity,
              position: 'absolute', inset: 0, zIndex: 10,
              borderRadius: 20, pointerEvents: 'none',
              background: 'rgba(230,57,70,0.18)',
              border: '2px solid rgba(230,57,70,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-lx-accent-red)', letterSpacing: '0.08em' }}>
              MISSED
            </span>
          </motion.div>
        </>)}

        {/* 3D flip inner — under reduced motion, skip the rotation entirely
            and crossfade opacity instead so the card never spins. */}
        <motion.div
          animate={{ rotateY: reduce ? 0 : (isFlipped ? 180 : 0) }}
          transition={{ duration: flipDuration, ease: [0.4, 0, 0.2, 1] }}
          style={{ transformStyle: 'preserve-3d', position: 'absolute', inset: 0 }}
        >
          {/* ── FRONT ─────────────────────────────────── */}
          <motion.div
            role="button"
            tabIndex={0}
            aria-label="Reveal definition"
            onClick={!isFlipped ? onFlip : undefined}
            onKeyDown={!isFlipped ? (e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onFlip();
              }
            } : undefined}
            animate={{ opacity: reduce ? (isFlipped ? 0 : 1) : 1 }}
            transition={{ duration: reduce ? 0.12 : 0 }}
            style={{
              backfaceVisibility: 'hidden',
              // Belt-and-suspenders against WebKit flattening the 3D context
              // (which kills backface-visibility): snap this face's own
              // visibility at the flip midpoint, when it's edge-on either way.
              // Under reduced motion there's no rotation, so gate purely on
              // opacity + pointer-events instead of a delayed visibility swap.
              visibility: reduce ? 'visible' : (isFlipped ? 'hidden' : 'visible'),
              pointerEvents: reduce && isFlipped ? 'none' : undefined,
              transition: reduce ? undefined : `visibility 0s linear ${flipDuration / 2}s`,
              position: 'absolute', inset: 0,
              borderRadius: 20,
              background: 'var(--color-lx-surface)',
              border: '1px solid var(--color-lx-border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '2rem',
              cursor: !isFlipped ? 'pointer' : 'default',
              overflow: 'hidden',
            }}
            className={!isFlipped ? 'lx-card-focus' : undefined}
          >
            {/* Ambient glow */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{
                position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)',
                width: '80%', height: '80%', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(230,57,70,0.08) 0%, transparent 70%)',
                filter: 'blur(20px)',
              }} />
            </div>

            {/* orbit-ring.svg: curved-arrow flip affordance hint in top-right corner */}
            <LexiIcon
              path="core/orbit-ring.svg"
              size={30}
              color="var(--color-lx-text-muted)"
              style={{ position: 'absolute', top: 5, right: 5, opacity: 0.55, pointerEvents: 'none', zIndex: 1 }}
            />

            {/* Light-catch sheen — sweeps once on appear, gated by reduced-motion.
                Plain CSS-animated div (compositor thread) so it can never freeze
                mid-sweep at visible opacity the way a JS/WAAPI animation can. */}
            {!reduce && (
              <div
                aria-hidden
                key={word.id}
                className="lx-card-sheen"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 20,
                  pointerEvents: 'none',
                  background: 'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.10) 47%, rgba(244,168,40,0.09) 50%, rgba(255,255,255,0.10) 53%, transparent 62%)',
                  zIndex: 2,
                }}
              />
            )}

            {/* Part of speech */}
            {word.partOfSpeech && (
              <span className="mb-4 rounded-full px-3 py-1 text-xs font-medium tracking-widest uppercase"
                    style={{ background: 'var(--color-lx-elevated)', color: 'var(--color-lx-text-muted)', border: '1px solid var(--color-lx-border)', position: 'relative', zIndex: 3 }}>
                {word.partOfSpeech}
              </span>
            )}

            {/* The word */}
            <h2 className="lx-word text-center"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(1.9rem, 9vw, 3.5rem)', fontWeight: 700, lineHeight: 1.05, color: 'var(--color-lx-text-primary)', letterSpacing: '-0.02em', position: 'relative', zIndex: 3, overflowWrap: 'break-word', wordBreak: 'break-word', maxWidth: '100%' }}>
              {word.word}
            </h2>

            {/* Tap hint — infinite pulse, gated by reduced-motion */}
            {reduce ? (
              <p className="mt-8 text-xs" style={{ color: 'var(--color-lx-text-secondary)', fontFamily: "'Sora', sans-serif" }}>
                tap to reveal
              </p>
            ) : (
              <motion.p
                animate={{ opacity: [0.85, 1, 0.85] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="mt-8 text-xs"
                style={{ color: 'var(--color-lx-text-secondary)', fontFamily: "'Sora', sans-serif" }}
              >
                tap to reveal
              </motion.p>
            )}
          </motion.div>

          {/* ── BACK ──────────────────────────────────── */}
          <motion.div
            aria-label="Definition revealed"
            animate={{ opacity: reduce ? (isFlipped ? 1 : 0) : 1 }}
            transition={{ duration: reduce ? 0.12 : 0 }}
            style={{
              backfaceVisibility: 'hidden',
              // Symmetric gate to the front face — see comment there.
              visibility: reduce ? 'visible' : (isFlipped ? 'visible' : 'hidden'),
              pointerEvents: reduce && !isFlipped ? 'none' : undefined,
              transition: reduce ? undefined : `visibility 0s linear ${flipDuration / 2}s`,
              position: 'absolute', inset: 0,
              borderRadius: 20,
              background: 'var(--color-lx-surface)',
              border: '1px solid rgba(230,57,70,0.25)',
              transform: reduce ? 'none' : 'rotateY(180deg)',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
              gap: '0.75rem',
              padding: '1.5rem',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            className="hide-scrollbar"
          >
            {/* Whole-card "responded" cue on prefs change */}
            <AnimatePresence>
              {prefsPulse && (
                <motion.div
                  aria-hidden
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.15, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 20,
                    pointerEvents: 'none', zIndex: 5,
                    background: 'var(--color-lx-accent-gold)',
                  }}
                />
              )}
            </AnimatePresence>

            {/* Word again (small) */}
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontStyle: 'italic', color: 'var(--color-lx-accent-red)', fontWeight: 600, overflowWrap: 'break-word', maxWidth: '100%' }}>
                {word.word}
              </span>
              <div className="flex items-center gap-2">
                {word.partOfSpeech && (
                  <span className="text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>{word.partOfSpeech}</span>
                )}
                <motion.button
                  onClick={speakWord}
                  whileTap={{ scale: 0.88 }}
                  style={{
                    width: 44, height: 44, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', background: 'var(--color-lx-elevated)',
                    border: '1px solid var(--color-lx-border)', color: 'var(--color-lx-accent-gold)',
                  }}
                  aria-label={`Hear ${word.word} pronounced`}
                >
                  <LexiIcon path="navigation/speaker.svg" size={18} color="var(--color-lx-accent-gold)" />
                </motion.button>
                <motion.button
                  onClick={onFlipBack}
                  whileTap={{ scale: 0.88 }}
                  style={{
                    width: 44, height: 44, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                    background: 'var(--color-lx-elevated)',
                    border: '1px solid var(--color-lx-border)',
                    color: 'var(--color-lx-text-muted)',
                  }}
                  aria-label="Flip back"
                >
                  <RotateCcw size={12} />
                </motion.button>
              </div>
            </div>

            {/* Definition */}
            <AnimatePresence mode="wait">
              <motion.p
                key={shownDefinition}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: reduce ? 0.1 : 0.2 }}
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', lineHeight: 1.55, color: 'var(--color-lx-text-primary)', fontWeight: 400 }}
              >
                {shownDefinition}
              </motion.p>
            </AnimatePresence>

            {/* Example sentence */}
            <AnimatePresence>
              {prefs.showExample && word.exampleSentence && (
                <motion.div
                  key="example"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: reduce ? 0.1 : 0.2 }}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--color-lx-elevated)', borderLeft: '2px solid var(--color-lx-accent-gold)' }}
                >
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontStyle: 'italic', fontWeight: 500, color: 'var(--color-lx-text-primary)', lineHeight: 1.5 }}>
                    &ldquo;{word.exampleSentence}&rdquo;
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Synonyms */}
            <AnimatePresence>
              {prefs.showSynonyms && word.synonyms.length > 0 && (
                <motion.div
                  key="synonyms"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: reduce ? 0.1 : 0.2 }}
                  className="flex flex-wrap gap-1.5"
                >
                  {word.synonyms.slice(0, 4).map(s => (
                    <span key={s} className="rounded-full px-2.5 py-1 text-xs"
                          style={{ background: 'rgba(230,57,70,0.1)', color: 'var(--color-lx-text-primary)', border: '1px solid rgba(230,57,70,0.35)', fontFamily: "'Sora', sans-serif" }}>
                      {s}
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Connotation — the feel of the word, not its dictionary sense */}
            <AnimatePresence>
              {prefs.showConnotation && word.connotation && word.connotation !== 'inapplicable' && (
                <motion.div
                  key="connotation"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: reduce ? 0.1 : 0.2 }}
                  className="flex items-center gap-2 text-xs"
                  style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-text-muted)' }}
                >
                  <span>feels</span>
                  <span className="rounded-full px-2.5 py-1"
                        style={{
                          background: word.connotation === 'positive' ? 'rgba(46,204,113,0.12)' : 'rgba(230,57,70,0.12)',
                          color:      word.connotation === 'positive' ? 'var(--color-lx-success)' : 'var(--color-lx-accent-red)',
                          border:     `1px solid ${word.connotation === 'positive' ? 'rgba(46,204,113,0.28)' : 'rgba(230,57,70,0.28)'}`,
                        }}>
                    {word.connotation}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contrast — the word people actually confuse this one with */}
            <AnimatePresence>
              {prefs.showContrast && word.contrast && (
                <motion.div
                  key="contrast"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: reduce ? 0.1 : 0.2 }}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--color-lx-elevated)', borderLeft: '2px solid var(--color-lx-text-muted)' }}
                >
                  <p className="text-xs" style={{ fontFamily: "'Sora', sans-serif", color: 'var(--color-lx-text-muted)' }}>
                    not <span style={{ color: 'var(--color-lx-text-primary)', fontWeight: 600 }}>{word.contrast.word}</span> — {word.contrast.gloss}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {footerHint && (
              <p className="mt-auto pt-2 text-center text-xs" style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}>
                {footerHint}
              </p>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
