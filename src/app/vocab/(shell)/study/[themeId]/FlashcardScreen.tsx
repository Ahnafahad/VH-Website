'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronLeft, RotateCcw, CheckCircle2, HelpCircle, XCircle, Volume2, Trophy } from 'lucide-react';
import type { FlashcardSessionData, FlashcardWord } from '@/lib/vocab/flashcard-data';
import { useBadgeQueue } from '@/lib/vocab/badges/queue';

type Rating = 'got_it' | 'unsure' | 'missed_it';

/* ─── Confetti particle ─────────────────────────────────── */
function Confetti() {
  const particles = Array.from({ length: 36 }, (_, i) => ({
    id:    i,
    x:     Math.random() * 100,
    color: ['#E63946','#F4A828','#2ECC71','#F5F5F5'][i % 4],
    delay: Math.random() * 0.6,
    size:  Math.random() * 6 + 4,
  }));
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: '-5vh', opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: [1, 1, 0], rotate: 360 * (Math.random() > 0.5 ? 1 : -1) }}
          transition={{ duration: 2.2 + Math.random(), delay: p.delay, ease: 'easeIn' }}
          style={{ position: 'absolute', width: p.size, height: p.size, borderRadius: 2, background: p.color }}
        />
      ))}
    </div>
  );
}

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

  return (
    <>
      <Confetti />
      <div className="flex flex-col items-center gap-6 px-6 pt-16 pb-8 text-center md:max-w-xl md:mx-auto md:w-full">
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

/* ─── Flip card ─────────────────────────────────────────── */
function FlipCard({ word, isFlipped, onFlip }: { word: FlashcardWord; isFlipped: boolean; onFlip: () => void }) {
  return (
    <div
      className="relative w-full"
      style={{ perspective: '2000px', minHeight: 260, flex: 1 }}
      onClick={!isFlipped ? onFlip : undefined}
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformStyle: 'preserve-3d', position: 'relative', width: '100%', height: '100%', minHeight: 260 }}
      >
        {/* ── FRONT ─────────────────────────────────── */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            position: 'absolute', inset: 0,
            borderRadius: 20,
            background: 'var(--color-lx-surface)',
            border: '1px solid var(--color-lx-border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
            minHeight: 260,
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

          {/* Part of speech */}
          {word.partOfSpeech && (
            <span className="mb-4 rounded-full px-3 py-1 text-xs font-medium tracking-widest uppercase"
                  style={{ background: 'var(--color-lx-elevated)', color: 'var(--color-lx-text-muted)', border: '1px solid var(--color-lx-border)' }}>
              {word.partOfSpeech}
            </span>
          )}

          {/* The word */}
          <h2 className="lx-word text-center"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(2.5rem, 10vw, 3.5rem)', fontWeight: 700, lineHeight: 1.05, color: 'var(--color-lx-text-primary)', letterSpacing: '-0.02em' }}>
            {word.word}
          </h2>

          {/* Tap hint */}
          <motion.p
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            className="mt-8 text-xs"
            style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
          >
            tap to reveal
          </motion.p>
        </div>

        {/* ── BACK ──────────────────────────────────── */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            position: 'absolute', inset: 0,
            borderRadius: 20,
            background: 'var(--color-lx-surface)',
            border: '1px solid rgba(230,57,70,0.25)',
            transform: 'rotateY(180deg)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
            gap: '0.5rem',
            padding: '1rem 1.15rem',
            minHeight: 260,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          className="hide-scrollbar"
        >
          {/* Word again (small) */}
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontStyle: 'italic', color: 'var(--color-lx-accent-red)', fontWeight: 600 }}>
              {word.word}
            </span>
            {word.partOfSpeech && (
              <span className="text-xs" style={{ color: 'var(--color-lx-text-muted)' }}>{word.partOfSpeech}</span>
            )}
          </div>

          {/* Definition */}
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', lineHeight: 1.45, color: 'var(--color-lx-text-primary)', fontWeight: 400 }}>
            {word.definition}
          </p>

          {/* Example sentence */}
          {word.exampleSentence && (
            <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--color-lx-elevated)' }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '0.92rem', fontStyle: 'italic', color: 'var(--color-lx-text-secondary)', lineHeight: 1.45 }}>
                "{word.exampleSentence}"
              </p>
            </div>
          )}

          {/* Synonyms */}
          {word.synonyms.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {word.synonyms.slice(0, 4).map(s => (
                <span key={s} className="rounded-full px-2 py-0.5"
                      style={{ fontSize: '0.68rem', background: 'rgba(230,57,70,0.1)', color: 'var(--color-lx-accent-red)', border: '1px solid rgba(230,57,70,0.2)', fontFamily: "'Sora', sans-serif" }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
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
  const [index,     setIndex]     = useState(data.currentIndex);
  const [ratings,   setRatings]   = useState<Record<number, Rating>>(data.ratings as Record<number, Rating>);
  const [flipped,   setFlipped]   = useState(false);
  const [complete,  setComplete]  = useState(data.currentIndex >= data.words.length);
  const [direction, setDirection] = useState(1);
  const submitting                = useRef(false);

  const word = data.words[index];

  const handleRate = useCallback((rating: Rating) => {
    if (!word || submitting.current) return;
    submitting.current = true;

    const isLast     = index === data.words.length - 1;
    const newRatings = { ...ratings, [word.id]: rating };
    setRatings(newRatings);

    // Advance the card immediately — don't wait for the server
    if (isLast) {
      setComplete(true);
      submitting.current = false;
    } else {
      setDirection(1);
      setFlipped(false);
      setTimeout(() => {
        setIndex(i => i + 1);
        submitting.current = false;
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
  }, [word, index, data.words.length, data.themeId, data.letterGroup, ratings, push]);

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
        minHeight: 'calc(100dvh - 72px)',
        paddingBottom: flipped ? 'calc(80px + 72px + env(safe-area-inset-bottom))' : '1rem',
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
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            <FlipCard word={word} isFlipped={flipped} onFlip={() => setFlipped(true)} />
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
          <RatingButtons onRate={handleRate} disabled={false} />
        )}
      </AnimatePresence>
    </div>
  );
}
