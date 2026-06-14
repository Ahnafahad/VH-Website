'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import DemoProgress   from './DemoProgress';
import SlideHome      from './slides/SlideHome';
import SlideFlashcards from './slides/SlideFlashcards';
import SlideScoring   from './slides/SlideScoring';
import SlideSessions  from './slides/SlideSessions';
import SlideThemes    from './slides/SlideThemes';
import SlideCompletion from './slides/SlideCompletion';
import SlideLetters   from './slides/SlideLetters';
import SlideReview    from './slides/SlideReview';

/**
 * Slide order (8 slides — SlidePointsStreaks removed; its key stat merged into SlideScoring copy):
 * 0 = SlideFlashcards  (strongest lead — interactive card flip)
 * 1 = SlideScoring     (points, badges, leaderboard)
 * 2 = SlideSessions    (daily path)
 * 3 = SlideThemes      (themed learning)
 * 4 = SlideCompletion  (learning cycle)
 * 5 = SlideHome        (command centre overview)
 * 6 = SlideLetters     (alphabetical lookup)
 * 7 = SlideReview      (spaced-repetition guardian)
 */
const TOTAL_SLIDES = 8;

const slideTransition = { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const };

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) =>
  Math.abs(offset) * velocity;

interface DemoSlidesProps {
  mode:       'onboarding' | 'replay';
  onComplete: () => void;
  /** Called when the user taps "Skip tour" — goes straight to onComplete path */
  onSkip?:    () => void;
  onClose?:   () => void;
}

export default function DemoSlides({ mode, onComplete, onSkip, onClose }: DemoSlidesProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [direction,   setDirection]   = useState(1); // 1 = forward, -1 = back

  const goNext = useCallback(() => {
    if (activeSlide >= TOTAL_SLIDES - 1) {
      onComplete();
      return;
    }
    setDirection(1);
    setActiveSlide(s => s + 1);
  }, [activeSlide, onComplete]);

  const goBack = useCallback(() => {
    if (activeSlide <= 0) return;
    setDirection(-1);
    setActiveSlide(s => s - 1);
  }, [activeSlide]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const power = swipePower(info.offset.x, info.velocity.x);
      if (power < -swipeConfidenceThreshold && activeSlide < TOTAL_SLIDES - 1) {
        setDirection(1);
        setActiveSlide(s => s + 1);
      } else if (power > swipeConfidenceThreshold && activeSlide > 0) {
        setDirection(-1);
        setActiveSlide(s => s - 1);
      }
    },
    [activeSlide]
  );

  // Suppress TS warning — goBack is available for swipe; keep reference stable.
  void goBack;

  const stepLabel = `Slide ${activeSlide + 1} of ${TOTAL_SLIDES}`;

  const renderSlide = () => {
    switch (activeSlide) {
      case 0: return <SlideFlashcards onNext={goNext} stepLabel={stepLabel} />;
      case 1: return <SlideScoring    onNext={goNext} stepLabel={stepLabel} />;
      case 2: return <SlideSessions   onNext={goNext} stepLabel={stepLabel} />;
      case 3: return <SlideThemes     onNext={goNext} stepLabel={stepLabel} />;
      case 4: return <SlideCompletion onNext={goNext} stepLabel={stepLabel} />;
      case 5: return <SlideHome       onNext={goNext} stepLabel={stepLabel} />;
      case 6: return <SlideLetters    onNext={goNext} stepLabel={stepLabel} />;
      case 7: return <SlideReview     onNext={onComplete} stepLabel={stepLabel} />;
      default: return null;
    }
  };

  const handleSkip = onSkip ?? onComplete;

  return (
    <div className="relative flex w-full flex-col gap-5">
      {/* Close button (replay mode) — 44px hit area */}
      {mode === 'replay' && onClose && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          aria-label="Close tour"
          className="absolute -top-2 right-0 z-20 flex items-center justify-center rounded-full"
          style={{
            /* 44×44 hit area */
            width:      44,
            height:     44,
            background: 'var(--color-lx-elevated)',
            border:     '1px solid var(--color-lx-border)',
            cursor:     'pointer',
            color:      'var(--color-lx-text-muted)',
          }}
        >
          <X size={14} />
        </motion.button>
      )}

      {/* Progress dots + skip affordance row */}
      <div className="flex items-center justify-between">
        <DemoProgress total={TOTAL_SLIDES} current={activeSlide} />

        {/* Skip tour button (onboarding mode only) */}
        {mode === 'onboarding' && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSkip}
            className="rounded-full px-3"
            style={{
              /* ≥44px hit area */
              minHeight:  44,
              display:    'flex',
              alignItems: 'center',
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              fontFamily: "'Sora', sans-serif",
              fontSize:   '0.7rem',
              fontWeight: 500,
              color:      'var(--color-lx-text-muted)',
              padding:    '0 4px',
            }}
          >
            Skip tour →
          </motion.button>
        )}
      </div>

      {/* Slide content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={activeSlide}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{   opacity: 0, x: direction > 0 ? -40 : 40 }}
          transition={slideTransition}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
          className="w-full"
        >
          {renderSlide()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
