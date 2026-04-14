'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import DemoProgress from './DemoProgress';
import SlideHome from './slides/SlideHome';
import SlidePointsStreaks from './slides/SlidePointsStreaks';
import SlideSessions from './slides/SlideSessions';
import SlideThemes from './slides/SlideThemes';
import SlideFlashcards from './slides/SlideFlashcards';
import SlideCompletion from './slides/SlideCompletion';
import SlideLetters from './slides/SlideLetters';
import SlideReview from './slides/SlideReview';

const TOTAL_SLIDES = 8;

const slideTransition = { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const };

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) =>
  Math.abs(offset) * velocity;

interface DemoSlidesProps {
  mode: 'onboarding' | 'replay';
  onComplete: () => void;
  onClose?: () => void;
}

export default function DemoSlides({ mode, onComplete, onClose }: DemoSlidesProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

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
        // Swipe left = forward — allow freely (demo content handles its own unlock)
        setDirection(1);
        setActiveSlide(s => s + 1);
      } else if (power > swipeConfidenceThreshold && activeSlide > 0) {
        setDirection(-1);
        setActiveSlide(s => s - 1);
      }
    },
    [activeSlide]
  );

  const stepLabel = `Step ${activeSlide + 1} of ${TOTAL_SLIDES}`;

  const renderSlide = () => {
    switch (activeSlide) {
      case 0: return <SlideHome onNext={goNext} stepLabel={stepLabel} />;
      case 1: return <SlidePointsStreaks onNext={goNext} stepLabel={stepLabel} />;
      case 2: return <SlideSessions onNext={goNext} stepLabel={stepLabel} />;
      case 3: return <SlideThemes onNext={goNext} stepLabel={stepLabel} />;
      case 4: return <SlideFlashcards onNext={goNext} stepLabel={stepLabel} />;
      case 5: return <SlideCompletion onNext={goNext} stepLabel={stepLabel} />;
      case 6: return <SlideLetters onNext={goNext} stepLabel={stepLabel} />;
      case 7: return <SlideReview onNext={activeSlide === TOTAL_SLIDES - 1 ? onComplete : goNext} stepLabel={stepLabel} />;
      default: return null;
    }
  };

  return (
    <div className="relative flex w-full flex-col gap-5">
      {/* Close button (replay mode only) */}
      {mode === 'replay' && onClose && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="absolute -top-2 right-0 z-20 flex h-8 w-8 items-center justify-center rounded-full"
          style={{
            background: 'var(--color-lx-elevated)',
            border: '1px solid var(--color-lx-border)',
            cursor: 'pointer',
            color: 'var(--color-lx-text-muted)',
          }}
        >
          <X size={14} />
        </motion.button>
      )}

      {/* Progress dots */}
      <DemoProgress total={TOTAL_SLIDES} current={activeSlide} />

      {/* Slide content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={activeSlide}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
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
