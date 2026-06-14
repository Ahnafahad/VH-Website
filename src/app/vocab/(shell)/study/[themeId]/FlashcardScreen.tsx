'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronLeft, RotateCcw, CheckCircle2, HelpCircle, XCircle, Trophy } from 'lucide-react';
import type { FlashcardSessionData, FlashcardWord } from '@/lib/vocab/flashcard-data';
import { useBadgeQueue } from '@/lib/vocab/badges/queue';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import Celebration from '@/components/vocab/Celebration';

type Rating = 'got_it' | 'unsure' | 'missed_it';

/* ─── Session complete screen ───────────────────────────── */
function SessionComplete({
  themeName,
  ratings,
  words,
  onReview,
  onNext,
}: {
  themeName: string;
  ratings: Record<number, Rating>;
  words: FlashcardWord[];
  onReview: () => void;
  onNext: () => void;
}) {
  const gotIt   = Object.values(ratings).filter(r => r === 'got_it').length;
  const unsure  = Object.values(ratings).filter(r => r === 'unsure').length;
  const missed  = Object.values(ratings).filter(r => r === 'missed_it').length;
  const pct     = Math.round((gotIt / words.length) * 100);

  const [celebActive, setCelebActive] = useState(true);
  const fb = useVocabFeedback();

  // Fire complete feedback once on mount
  useEffect(() => {
    fb.play('complete');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Celebration active={celebActive} intensity="full" onDone={() => setCelebActive(false)} />
      <div className="flex flex-col items-center gap-6 px-6 pt-16 pb-8 text-center md:max-w-xl md:mx-auto md:w-full" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom) + 1.5rem)' }}>
        {/* Trophy */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.3 }}
          className="flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: 'rgba(244,168,40,0.15)', border: '2px solid rgba(244,168,40,0.4)' }}
        >
          <Trophy size={48} strokeWidth={1.5} color="var(--color-lx-accent-gold)" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col gap-2"
        >
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '2rem',
              fontWeight: 700,
              fontStyle: 'italic',
              color: 'var(--color-lx-text-primary)',
            }}
          >
            Deck Complete
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-lx-text-secondary)' }}>
            {themeName}
          </p>
        </motion.div>

        {/* Score ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.65, type: 'spring', stiffness: 260, damping: 22 }}
          className="relative flex h-32 w-32 items-center justify-center"
        >
          <svg width={128} height={128} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={64} cy={64} r={56} fill="none" strokeWidth={8} stroke="var(--color-lx-elevated)" />
            <motion.circle
              cx={64} cy={64} r={56} fill="none" strokeWidth={8}
              stroke={pct >= 70 ? 'var(--color-lx-success)' : pct >= 40 ? 'var(--color-lx-warning)' : 'var(--color-lx-accent-red)'}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 56}
              initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - pct / 100) }}
              transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 700, color: 'var(--color-lx-text-primary)' }}>
              {pct}%
            </span>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="flex w-full gap-3"
        >
          {[
            { label: 'Got It',   count: gotIt,  color: 'var(--color-lx-success)' },
            { label: 'Unsure',   count: unsure, color: 'var(--color-lx-warning)' },
            { label: 'Missed',   count: missed, color: 'var(--color-lx-accent-red)' },
          ].map(s => (
            <div key={s.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-3"
              style={{ background: 'var(--color-lx-surface)', border: '1px solid var(--color-lx-border)' }}
            >
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', fontWeight: 700, color: s.color }}>
                {s.count}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>{s.label}</span>
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex w-full flex-col gap-3"
        >
          <button
            onClick={onNext}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold"
            style={{ background: 'var(--color-lx-accent-red)', color: '#fff', fontFamily: "'Sora', sans-serif" }}
          >
            Take the Quiz →
          </button>
          <button
            onClick={onReview}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium"
            style={{ background: 'var(--color-lx-elevated)', color: 'var(--color-lx-text-secondary)', fontFamily: "'Sora', sans-serif" }}
          >
            <RotateCcw size={15} /> Review Again
          </button>
        </motion.div>
      </div>
    </>
  );
}

/* ─── Swipeable flip card ───────────────────────────────── */
function FlipCard({
  word,
  isFlipped,
  onFlip,
  onFlipBack,
  onSwipeRate,
  reduce,
}: {
  word: FlashcardWord;
  isFlipped: boolean;
  onFlip: () => void;
  onFlipBack: () => void;
  onSwipeRate: (r: 'got_it' | 'missed_it') => void;
  reduce: boolean;
}) {
  const dragX        = useMotionValue(0);
  const THRESHOLD    = 120;

  // Live tint overlays driven by drag position
  const gotItOpacity   = useTransform(dragX, [0, THRESHOLD],      [0, 0.55]);
  const missedOpacity  = useTransform(dragX, [-THRESHOLD, 0],     [0.55, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset > THRESHOLD || velocity > 500) {
      onSwipeRate('got_it');
    } else if (offset < -THRESHOLD || velocity < -500) {
      onSwipeRate('missed_it');
    }
    // below threshold — motion's dragSnapToOrigin snaps back automatically
  }

  const flipDuration = reduce ? 0.12 : 0.65;

  return (
    <div
      className="relative w-full"
      style={{ perspective: '2000px', flex: 1 }}
    >
      {/* Swipe drag wrapper — only active once flipped */}
      <motion.div
        drag={isFlipped ? 'x' : false}
        dragSnapToOrigin
        dragElastic={0.5}
        style={{ x: dragX, flex: 1, height: '100%', position: 'relative' }}
        onDragEnd={isFlipped ? handleDragEnd : undefined}
      >
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

        {/* 3D flip inner */}
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: flipDuration, ease: [0.4, 0, 0.2, 1] }}
          style={{ transformStyle: 'preserve-3d', position: 'absolute', inset: 0 }}
        >
          {/* ── FRONT ─────────────────────────────────── */}
          <div
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
            style={{
              backfaceVisibility: 'hidden',
              position: 'absolute', inset: 0,
              borderRadius: 20,
              background: 'var(--color-lx-surface)',
              border: '1px solid var(--color-lx-border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '2rem',
              cursor: !isFlipped ? 'pointer' : 'default',
              outline: 'none',
              overflow: 'hidden',
            }}
          >
            {/* Ambient glow */}
            <div aria-hidden style={{
              position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)',
                width: '80%', height: '80%', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(230,57,70,0.08) 0%, transparent 70%)',
                filter: 'blur(20px)',
              }} />
            </div>

            {/* Light-catch sheen — sweeps once on appear, gated by reduced-motion */}
            {!reduce && (
              <motion.div
                aria-hidden
                key={word.id}
                initial={{ x: '-120%', opacity: 0 }}
                animate={{ x: ['−120%', '120%'], opacity: [0, 0.22, 0] }}
                transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.25 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 20,
                  pointerEvents: 'none',
                  background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 47%, rgba(244,168,40,0.12) 50%, rgba(255,255,255,0.18) 53%, transparent 70%)',
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
              <p
                className="mt-8 text-xs"
                style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
              >
                tap to reveal
              </p>
            ) : (
              <motion.p
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="mt-8 text-xs"
                style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
              >
                tap to reveal
              </motion.p>
            )}
          </div>

          {/* ── BACK ──────────────────────────────────── */}
          <div
            aria-label="Definition revealed"
            style={{
              backfaceVisibility: 'hidden',
              position: 'absolute', inset: 0,
              borderRadius: 20,
              background: 'var(--color-lx-surface)',
              border: '1px solid rgba(230,57,70,0.25)',
              transform: 'rotateY(180deg)',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
              gap: '0.75rem',
              padding: '1.5rem',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            className="hide-scrollbar"
          >
            {/* Word again (small) */}
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontStyle: 'italic', color: 'var(--color-lx-accent-red)', fontWeight: 600, overflowWrap: 'break-word', maxWidth: '100%' }}>
                {word.word}
              </span>
              <div className="flex items-center gap-2">
                {word.partOfSpeech && (
                  <span className="text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>{word.partOfSpeech}</span>
                )}
                {/* Flip-back button — enlarged to ≥44px touch target */}
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
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', lineHeight: 1.55, color: 'var(--color-lx-text-primary)', fontWeight: 400 }}>
              {word.definition}
            </p>

            {/* Example sentence */}
            {word.exampleSentence && (
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--color-lx-elevated)' }}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', fontStyle: 'italic', color: 'var(--color-lx-text-secondary)', lineHeight: 1.5 }}>
                  &ldquo;{word.exampleSentence}&rdquo;
                </p>
              </div>
            )}

            {/* Synonyms */}
            {word.synonyms.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {word.synonyms.slice(0, 4).map(s => (
                  <span key={s} className="rounded-full px-2.5 py-1 text-xs"
                        style={{ background: 'rgba(230,57,70,0.1)', color: 'var(--color-lx-accent-red)', border: '1px solid rgba(230,57,70,0.2)', fontFamily: "'Sora', sans-serif" }}>
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Swipe hint */}
            <p className="mt-auto pt-2 text-center text-xs" style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}>
              swipe right → Got It &nbsp;·&nbsp; swipe left → Missed
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─── Rating buttons ─────────────────────────────────────── */
function RatingButtons({ onRate, disabled }: { onRate: (r: Rating) => void; disabled: boolean }) {
  const btns: { rating: Rating; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { rating: 'missed_it', label: 'Missed',  icon: <XCircle size={18} />,       color: 'var(--color-lx-accent-red)', bg: 'rgba(230,57,70,0.12)' },
    { rating: 'unsure',    label: 'Unsure',  icon: <HelpCircle size={18} />,    color: 'var(--color-lx-warning)',    bg: 'rgba(243,156,18,0.12)' },
    { rating: 'got_it',    label: 'Got It',  icon: <CheckCircle2 size={18} />,  color: 'var(--color-lx-success)',    bg: 'rgba(46,204,113,0.12)' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className="fixed left-0 right-0 md:left-[220px] flex gap-3 px-4"
      style={{
        bottom: 'calc(72px + env(safe-area-inset-bottom) + 8px)',
        zIndex: 30,
      }}
    >
      {btns.map(b => (
        <motion.button
          key={b.rating}
          onClick={() => !disabled && onRate(b.rating)}
          whileTap={disabled ? {} : { scale: 0.94 }}
          disabled={disabled}
          className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl py-3.5"
          style={{
            background: b.bg,
            border:     `1px solid ${b.color}40`,
            color:      b.color,
            opacity:    disabled ? 0.5 : 1,
            fontFamily: "'Sora', sans-serif",
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {b.icon}
          <span className="text-xs font-semibold">{b.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}

/* ─── Main screen ────────────────────────────────────────── */
export default function FlashcardScreen({ data }: { data: FlashcardSessionData }) {
  const router      = useRouter();
  const { push }    = useBadgeQueue();
  const fb          = useVocabFeedback();
  const reduce      = useReducedMotion() ?? false;

  const [index,     setIndex]     = useState(data.currentIndex);
  const [ratings,   setRatings]   = useState<Record<number, Rating>>(data.ratings as Record<number, Rating>);
  const [flipped,   setFlipped]   = useState(false);
  const [complete,  setComplete]  = useState(data.currentIndex >= data.words.length);
  const [direction, setDirection] = useState(1);

  // Race fix: use a ref for the in-flight guard and a ref for the advance timer
  const submitting  = useRef(false);
  const advanceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const word = data.words[index];

  // Cleanup advance timer on unmount
  useEffect(() => {
    return () => {
      if (advanceRef.current) clearTimeout(advanceRef.current);
    };
  }, []);

  // Document-level keyboard shortcuts
  useEffect(() => {
    if (complete || !word) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (!flipped) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleFlip();
        }
      } else {
        switch (e.key) {
          case '1':
            e.preventDefault();
            handleRate('missed_it');
            break;
          case '2':
            e.preventDefault();
            handleRate('unsure');
            break;
          case '3':
            e.preventDefault();
            handleRate('got_it');
            break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, complete, word]);

  const handleFlip = useCallback(() => {
    setFlipped(true);
    fb.play('flip');
  }, [fb]);

  const handleFlipBack = useCallback(() => {
    setFlipped(false);
    fb.play('back');
  }, [fb]);

  const handleRate = useCallback((rating: Rating) => {
    if (!word || submitting.current) return;
    submitting.current = true;

    // Play the appropriate feedback sound
    if (rating === 'got_it')    fb.play('gotIt');
    else if (rating === 'unsure') fb.play('unsure');
    else                          fb.play('missed');

    const isLast     = index === data.words.length - 1;
    const newRatings = { ...ratings, [word.id]: rating };
    setRatings(newRatings);

    // State-driven advance: flip back first, then advance after a short delay
    // stored in a cancellable ref to prevent double-fire on unmount
    if (isLast) {
      setComplete(true);
      submitting.current = false;
    } else {
      setDirection(1);
      setFlipped(false);
      if (advanceRef.current) clearTimeout(advanceRef.current);
      advanceRef.current = setTimeout(() => {
        setIndex(i => i + 1);
        submitting.current = false;
        advanceRef.current = null;
      }, 120);
    }

    // Fire rating to server in background — UI never waits for this
    if (data.letterGroup) {
      fetch('/api/vocab/practice/rate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ wordId: word.id, rating }),
      }).catch(() => {});
    } else {
      fetch(`/api/vocab/flashcard/${data.themeId}/rate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ wordId: word.id, rating, isLast }),
      }).then(async (res) => {
        if (isLast && res.ok) {
          const d = await res.json() as { earnedBadges?: { id: string; name: string; description: string; category: 'short_term' | 'mid_term' | 'long_term' | 'ultimate' }[] };
          if (d.earnedBadges?.length) push(d.earnedBadges);
        }
      }).catch(() => {});
    }
  }, [word, index, data.words.length, data.themeId, data.letterGroup, ratings, push, fb]);

  const handleSwipeRate = useCallback((rating: 'got_it' | 'missed_it') => {
    handleRate(rating);
  }, [handleRate]);

  const handleReview = () => {
    setIndex(0);
    setRatings({});
    setFlipped(false);
    setComplete(false);
  };

  if (complete) {
    return (
      <SessionComplete
        themeName={data.themeName}
        ratings={ratings}
        words={data.words}
        onReview={handleReview}
        onNext={() => router.push(
          data.letterGroup
            ? `/vocab/study/letter/${data.letterGroup}`
            : `/vocab/study/${data.themeId}/quiz`
        )}
      />
    );
  }

  if (!word) return null;

  const progress = ((index) / data.words.length) * 100;

  return (
    <div
      className="flex flex-col px-4 pt-3 gap-2 md:px-8 md:pt-5 md:max-w-2xl md:mx-auto md:w-full"
      style={{
        height: 'calc(100dvh - 72px)',
        paddingBottom: flipped ? 'calc(80px + 72px + env(safe-area-inset-bottom))' : '1rem',
        overflow: 'hidden',
      }}
    >

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: 'var(--color-lx-elevated)' }}
          aria-label="Go back"
        >
          <ChevronLeft size={20} style={{ color: 'var(--color-lx-text-secondary)' }} />
        </motion.button>

        <div className="flex flex-col items-center gap-0.5">
          <p className="text-xs font-medium tracking-wide"
             style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}>
            {data.themeName}
          </p>
          <p className="text-sm font-semibold"
             style={{ color: 'var(--color-lx-text-primary)', fontFamily: "'Sora', sans-serif" }}>
            {index + 1} / {data.words.length}
          </p>
        </div>

        <div style={{ width: 40 }} /> {/* spacer */}
      </div>

      {/* ── Progress bar ────────────────────────────────── */}
      <div className="overflow-hidden rounded-full" style={{ height: 3, background: 'var(--color-lx-elevated)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--color-lx-accent-red)', boxShadow: '0 0 8px rgba(230,57,70,0.5)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* ── Card area ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2 min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={word.id}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 30 }}
            transition={{ duration: reduce ? 0.1 : 0.25, ease: 'easeOut' }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            <FlipCard
              word={word}
              isFlipped={flipped}
              onFlip={handleFlip}
              onFlipBack={handleFlipBack}
              onSwipeRate={handleSwipeRate}
              reduce={reduce}
            />
          </motion.div>
        </AnimatePresence>

        {/* Flip prompt if not yet flipped */}
        {!flipped && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs"
            style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
          >
            Tap the card to reveal — then rate yourself
          </motion.p>
        )}
      </div>

      {/* ── Rating buttons — fixed above BottomNav ────── */}
      <AnimatePresence>
        {flipped && (
          <RatingButtons onRate={handleRate} disabled={submitting.current} />
        )}
      </AnimatePresence>
    </div>
  );
}
