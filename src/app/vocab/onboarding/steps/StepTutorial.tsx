'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, BookOpen, Sparkles } from 'lucide-react';

interface Props {
  saving:   boolean;
  onFinish: () => void;
}

const SLIDES = [
  {
    id:    'flashcards',
    icon:  <BookOpen size={16} />,
    title: 'Smart Flashcards',
    body:  'Flip cards to reveal definitions, synonyms, and examples. Rate yourself — the app adapts to what you know.',
    demo:  <FlipCardDemo />,
  },
  {
    id:    'quiz',
    icon:  <Sparkles size={16} />,
    title: 'AI-Powered Quizzes',
    body:  'After every session, an AI generates a personalised quiz. Harder words appear more often until you master them.',
    demo:  <QuizDemo />,
  },
  {
    id:    'streak',
    icon:  <Flame size={16} />,
    title: 'Streaks & Badges',
    body:  'Build daily streaks, earn badges, and climb the leaderboard. Every day you study keeps the fire burning.',
    demo:  <StreakDemo />,
  },
] as const;

export default function StepTutorial({ saving, onFinish }: Props) {
  const [idx, setIdx] = useState(0);

  const next = () => {
    if (idx < SLIDES.length - 1) setIdx(i => i + 1);
    else onFinish();
  };

  const slide = SLIDES[idx];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <p
          className="mb-1 text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
        >
          How it works
        </p>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   '1.8rem',
            fontWeight: 700,
            fontStyle:  'italic',
            color:      'var(--color-lx-text-primary)',
          }}
        >
          Your learning journey
        </h2>
      </div>

      {/* Slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-4"
        >
          {/* Demo area */}
          <div
            className="flex h-52 items-center justify-center overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, var(--color-lx-elevated) 0%, var(--color-lx-surface) 100%)',
              border:     '1px solid var(--color-lx-border)',
            }}
          >
            {slide.demo}
          </div>

          {/* Label */}
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'rgba(230,57,70,0.12)', color: 'var(--color-lx-accent-red)' }}
            >
              {slide.icon}
            </span>
            <p
              className="text-base font-semibold"
              style={{ color: 'var(--color-lx-text-primary)', fontFamily: "'Sora', sans-serif" }}
            >
              {slide.title}
            </p>
          </div>

          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--color-lx-text-secondary)', fontFamily: "'Sora', sans-serif" }}
          >
            {slide.body}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Step dots */}
      <div className="flex justify-center gap-2">
        {SLIDES.map((_, i) => (
          <motion.div
            key={i}
            animate={{
              width:      idx === i ? 20 : 8,
              background: idx === i ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-muted)',
            }}
            transition={{ duration: 0.2 }}
            className="h-2 rounded-full"
          />
        ))}
      </div>

      {/* CTA */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={next}
        disabled={saving}
        className="w-full rounded-[10px] py-4 text-lg font-semibold text-white disabled:opacity-60 lx-glow-red"
        style={{
          background: 'linear-gradient(135deg, var(--color-lx-accent-red) 0%, #c42d39 100%)',
          fontFamily: "'Sora', sans-serif",
        }}
      >
        {saving ? 'Setting up…' : idx < SLIDES.length - 1 ? 'Next' : 'Start Learning'}
      </motion.button>
    </div>
  );
}

/* ── Mini demos ─────────────────────────────────────────────────────────────── */

function FlipCardDemo() {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        className="preserve-3d relative h-28 w-52 cursor-pointer"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        onClick={() => setFlipped(f => !f)}
        whileTap={{ scale: 0.97 }}
      >
        {/* Front */}
        <div
          className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-2xl px-3"
          style={{
            background: 'linear-gradient(135deg, var(--color-lx-surface) 0%, var(--color-lx-elevated) 100%)',
            border:     '1px solid var(--color-lx-border)',
          }}
        >
          <span
            className="lx-word text-xl font-bold italic"
            style={{ color: 'var(--color-lx-text-primary)', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            magnanimous
          </span>
          <span
            className="mt-1.5 text-xs"
            style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
          >
            tap to flip
          </span>
        </div>

        {/* Back */}
        <div
          className="backface-hidden absolute inset-0 flex items-center justify-center rounded-2xl px-4 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(230,57,70,0.1) 0%, rgba(230,57,70,0.03) 100%)',
            border:     '1px solid rgba(230,57,70,0.25)',
            transform:  'rotateY(180deg)',
          }}
        >
          <span
            className="text-sm leading-snug"
            style={{ color: 'var(--color-lx-text-secondary)', fontFamily: "'Sora', sans-serif" }}
          >
            Generous in forgiving an insult or injury; showing noble understanding
          </span>
        </div>
      </motion.div>

      <span
        className="text-xs"
        style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
      >
        {flipped ? 'Got it? Rate yourself below' : 'Tap the card to see the definition'}
      </span>
    </div>
  );
}

function QuizDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  const correct = 'B';

  return (
    <div className="w-full px-4">
      <p
        className="mb-3 text-xs leading-snug"
        style={{
          color:      'var(--color-lx-text-secondary)',
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize:   '0.95rem',
          fontStyle:  'italic',
        }}
      >
        "The speaker's _____ tone put everyone at ease."
      </p>
      {(['A. austere', 'B. affable', 'C. volatile'] as const).map(opt => {
        const letter    = opt[0] as string;
        const isSelected = selected === letter;
        const isCorrect  = letter === correct;
        const showResult = selected !== null;

        return (
          <motion.button
            key={opt}
            whileTap={{ scale: 0.98 }}
            onClick={() => { if (!selected) setSelected(letter); }}
            className="mb-2 w-full rounded-xl px-3 py-2.5 text-left text-sm"
            style={{
              background: showResult && isCorrect
                ? 'rgba(46,204,113,0.12)'
                : showResult && isSelected && !isCorrect
                ? 'rgba(230,57,70,0.12)'
                : 'var(--color-lx-elevated)',
              border: `1px solid ${
                showResult && isCorrect
                  ? 'var(--color-lx-success)'
                  : showResult && isSelected && !isCorrect
                  ? 'var(--color-lx-danger)'
                  : 'var(--color-lx-border)'
              }`,
              color:      'var(--color-lx-text-primary)',
              fontFamily: "'Sora', sans-serif",
            }}
          >
            {opt}
          </motion.button>
        );
      })}
    </div>
  );
}

function StreakDemo() {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Flame icon with glow instead of emoji */}
      <div className="relative flex items-center justify-center">
        <motion.div
          aria-hidden
          className="absolute h-16 w-16 rounded-full blur-xl"
          style={{ background: 'rgba(230,57,70,0.35)' }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(230,57,70,0.2) 0%, rgba(244,168,40,0.15) 100%)',
            border:     '1px solid rgba(230,57,70,0.4)',
          }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Flame size={28} style={{ color: 'var(--color-lx-accent-red)' }} />
        </motion.div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <motion.span
          className="font-bold"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' as const, stiffness: 400, damping: 18, delay: 0.2 }}
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   '3rem',
            lineHeight: 1,
            color:      'var(--color-lx-accent-red)',
          }}
        >
          7
        </motion.span>
        <span
          className="text-sm"
          style={{ color: 'var(--color-lx-text-secondary)', fontFamily: "'Sora', sans-serif" }}
        >
          day streak
        </span>
      </div>
    </div>
  );
}
