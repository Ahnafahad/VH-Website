'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import type { FlashcardSessionData, FlashcardWord } from '@/lib/vocab/flashcard-data';
import { useBadgeQueue } from '@/lib/vocab/badges/queue';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import Celebration from '@/components/vocab/Celebration';
import { trackFeature } from '@/lib/analytics/tracker';
import { RETENTION_EVENTS, trackRetention } from '@/lib/vocab/retention-events';
import { LexiArtwork } from '@/components/vocab/LexiAsset';
import LivingFlashcard from '@/components/vocab/LivingFlashcard';
import UpgradeModal from '@/components/vocab/UpgradeModal';
import { limitKindOf } from '@/lib/vocab/limit';
import { lxFs } from '@/lib/vocab/ui';
import { postWithRetry } from '@/lib/vocab/post-with-retry';

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
          <LexiArtwork path="flashcards/session-complete.svg" width={88} height={88} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col gap-2"
        >
          <h2
            style={{
              fontFamily: "var(--font-lexi-word), Georgia, serif",
              fontSize: lxFs('2rem'),
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
            <span style={{ fontFamily: "var(--font-lexi-word), Georgia, serif", fontSize: lxFs('2rem'), fontWeight: 700, color: 'var(--color-lx-text-primary)' }}>
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
              <span style={{ fontFamily: "var(--font-lexi-word), Georgia, serif", fontSize: lxFs('1.75rem'), fontWeight: 700, color: s.color }}>
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
            onClick={() => onNext()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold"
            style={{ background: 'var(--color-lx-accent-red)', color: '#fff', fontFamily: "var(--font-lexi-ui), system-ui, sans-serif" }}
          >
            Take the Quiz →
          </button>
          <button
            onClick={onReview}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium"
            style={{ background: 'var(--color-lx-elevated)', color: 'var(--color-lx-text-secondary)', fontFamily: "var(--font-lexi-ui), system-ui, sans-serif" }}
          >
            <RotateCcw size={15} /> Review Again
          </button>
        </motion.div>
      </div>
    </>
  );
}
/* ─── Rating buttons ─────────────────────────────────────── */
function RatingButtons({ onRate, disabled }: { onRate: (r: Rating) => void; disabled: boolean }) {
  const btns: { rating: Rating; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { rating: 'missed_it', label: 'Missed',  icon: <LexiArtwork path="flashcards/missed.svg" width={28} height={28} />, color: 'var(--color-lx-accent-red)', bg: 'rgba(230,57,70,0.12)' },
    { rating: 'unsure',    label: 'Unsure',  icon: <LexiArtwork path="flashcards/unsure.svg" width={28} height={28} />, color: 'var(--color-lx-warning)', bg: 'rgba(243,156,18,0.12)' },
    { rating: 'got_it',    label: 'Got It',  icon: <LexiArtwork path="flashcards/got-it.svg" width={28} height={28} />, color: 'var(--color-lx-success)', bg: 'rgba(46,204,113,0.12)' },
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
            fontFamily: "var(--font-lexi-ui), system-ui, sans-serif",
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
export default function FlashcardScreen({ data, onTakeQuiz }: { data: FlashcardSessionData; onTakeQuiz?: () => void }) {
  const router      = useRouter();
  const { push }    = useBadgeQueue();
  const fb          = useVocabFeedback();
  const reduce      = useReducedMotion() ?? false;
  // Ratings whose save failed. Retried only when the user taps Retry (flashcard rate is not safe to replay).
  const [unsaved, setUnsaved]   = useState<{ url: string; body: Record<string, unknown> }[]>([]);
  const [retrying, setRetrying] = useState(false);

  const [index,     setIndex]     = useState(data.currentIndex);
  const [ratings,   setRatings]   = useState<Record<number, Rating>>(data.ratings as Record<number, Rating>);
  const [flipped,   setFlipped]   = useState(false);
  const [complete,  setComplete]  = useState(data.currentIndex >= data.words.length);
  const [direction, setDirection] = useState(1);
  const [limitHit,  setLimitHit]  = useState(false);

  // Race fix: use a ref for the in-flight guard and a ref for the advance timer
  const submitting  = useRef(false);
  const advanceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const word = data.words[index];

  // Track flashcard session start once on mount
  useEffect(() => {
    trackFeature('flashcard_start', 'vocab', { themeId: data.themeId });
    trackRetention(RETENTION_EVENTS.learningSessionStarted, { sessionType: data.letterGroup ? 'letter_flashcard' : 'flashcard', themeId: data.themeId, words: data.words.length });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      trackRetention(RETENTION_EVENTS.learningSessionCompleted, { sessionType: data.letterGroup ? 'letter_flashcard' : 'flashcard', themeId: data.themeId, words: data.words.length });
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
      const body = { wordId: word.id, rating };
      postWithRetry('/api/vocab/practice/rate', body)
        .then(async r => {
          if (await limitKindOf(r)) { setLimitHit(true); return; }
          if (!r.ok) throw new Error('rate failed');
        })
        .catch(() => setUnsaved(u => [...u, { url: '/api/vocab/practice/rate', body }]));
    } else {
      sendFlashcardRate(`/api/vocab/flashcard/${data.themeId}/rate`, { wordId: word.id, rating, isLast });
    }
  }, [word, index, data.words.length, data.themeId, data.letterGroup, ratings, fb]); // eslint-disable-line react-hooks/exhaustive-deps

  // Single attempt, no auto-retry: a replay would double-count points.
  function sendFlashcardRate(url: string, body: Record<string, unknown>) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(async (res) => {
        if (await limitKindOf(res)) { setLimitHit(true); return true; }
        if (!res.ok) throw new Error('rate failed');
        if (body.isLast) {
          const d = await res.json() as { earnedBadges?: { id: string; name: string; description: string; category: 'short_term' | 'mid_term' | 'long_term' | 'ultimate' }[] };
          if (d.earnedBadges?.length) push(d.earnedBadges);
        }
        return true;
      })
      .catch(() => { setUnsaved(u => [...u, { url, body }]); return false; });
  }

  const retryUnsaved = async () => {
    const items = unsaved;
    setUnsaved([]);
    setRetrying(true);
    for (const it of items) {
      if (it.url === '/api/vocab/practice/rate') {
        await postWithRetry(it.url, it.body)
          .then(async r => {
            if (await limitKindOf(r)) { setLimitHit(true); return; }
            if (!r.ok) throw new Error('rate failed');
          })
          .catch(() => setUnsaved(u => [...u, it]));
      } else {
        await sendFlashcardRate(it.url, it.body);
      }
    }
    setRetrying(false);
  };

  const saveBanner = unsaved.length > 0 && (
    <p role="alert" style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(88px + env(safe-area-inset-bottom))', zIndex: 60, margin: 0, padding: '0.6rem 0.9rem', borderRadius: 12, textAlign: 'center', background: 'var(--color-lx-elevated)', border: '1px solid var(--color-lx-border)', color: 'var(--color-lx-accent-red)', fontFamily: "var(--font-lexi-ui), system-ui, sans-serif", fontSize: lxFs('0.8125rem'), fontWeight: 500 }}>
      {unsaved.length === 1 ? "Couldn't save 1 rating." : `Couldn't save ${unsaved.length} ratings.`}{' '}
      <button onClick={() => void retryUnsaved()} disabled={retrying} style={{ color: 'var(--color-lx-accent-red)', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </p>
  );

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
      <>
        <SessionComplete
          themeName={data.themeName}
          ratings={ratings}
          words={data.words}
          onReview={handleReview}
          onNext={onTakeQuiz ?? (() => router.push(`/vocab/study/${data.themeId}/quiz`))}
        />
        {limitHit && <UpgradeModal kind="cards" onClose={() => router.push('/vocab/home')} />}
        {saveBanner}
      </>
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
      {limitHit && <UpgradeModal kind="cards" onClose={() => router.push('/vocab/home')} />}

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
             style={{ color: 'var(--color-lx-text-muted)', fontFamily: "var(--font-lexi-ui), system-ui, sans-serif" }}>
            {data.themeName}
          </p>
          <p className="text-sm font-semibold"
             style={{ color: 'var(--color-lx-text-primary)', fontFamily: "var(--font-lexi-ui), system-ui, sans-serif" }}>
            {index + 1} / {data.words.length}
          </p>
        </div>

        <div style={{ width: 40 }} /> {/* spacer */}
      </div>
      {saveBanner}

      {/* ── Progress bar ────────────────────────────────── */}
      <div className="overflow-hidden rounded-full" style={{ height: 3, background: 'var(--color-lx-elevated)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'var(--color-lx-accent-red)', boxShadow: '0 0 8px rgba(230,57,70,0.5)', originX: 0 }}
          animate={{ scaleX: progress / 100 }}
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
            <LivingFlashcard
              word={word}
              prefs={data.cardPrefs}
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
            style={{ color: 'var(--color-lx-text-muted)', fontFamily: "var(--font-lexi-ui), system-ui, sans-serif" }}
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
