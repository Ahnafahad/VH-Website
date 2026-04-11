'use client';

import { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import QuizConfigSheet, { type QuizConfig } from '@/components/vocab/QuizConfigSheet';
import FlashcardScreen from '../../[themeId]/FlashcardScreen';
import QuizScreen from '../../[themeId]/quiz/QuizScreen';
import type { FlashcardSessionData, FlashcardWord } from '@/lib/vocab/flashcard-data';
import type { LetterWordData } from '@/lib/vocab/letter-data';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  letter:      string;
  words:       LetterWordData[];
  totalPoints: number;
}

// ─── CSS tokens ───────────────────────────────────────────────────────────────

const C = {
  surface:  'var(--color-lx-surface)',
  elevated: 'var(--color-lx-elevated)',
  border:   'var(--color-lx-border)',
  red:      'var(--color-lx-accent-red)',
  textPrim: 'var(--color-lx-text-primary)',
  textSec:  'var(--color-lx-text-secondary)',
  textMuted:'var(--color-lx-text-muted)',
} as const;

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";

const LEVEL_BG: Record<string, string> = {
  new:      'rgba(180,180,180,0.12)',
  learning: 'rgba(244,168,40,0.15)',
  familiar: 'rgba(56,189,248,0.15)',
  strong:   'rgba(46,204,113,0.15)',
  mastered: 'rgba(230,57,70,0.15)',
};
const LEVEL_TEXT: Record<string, string> = {
  new:      'rgba(160,160,160,0.9)',
  learning: 'var(--color-lx-accent-gold)',
  familiar: '#38bdf8',
  strong:   'var(--color-lx-success)',
  mastered: 'var(--color-lx-accent-red)',
};

// ─── Word row ─────────────────────────────────────────────────────────────────

const rowVariant: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.025, type: 'spring' as const, stiffness: 360, damping: 28 } }),
};

function WordRow({ w, index }: { w: LetterWordData; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      custom={index}
      variants={rowVariant}
      initial="hidden"
      animate="show"
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          padding: '0.875rem 1rem', gap: '0.75rem',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: SANS, fontSize: '0.6rem', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '0.2rem 0.5rem', borderRadius: 8, flexShrink: 0,
          background: LEVEL_BG[w.masteryLevel] ?? LEVEL_BG.new,
          color:      LEVEL_TEXT[w.masteryLevel] ?? LEVEL_TEXT.new,
        }}>
          {w.masteryLevel}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: SERIF, fontSize: '1.05rem', fontWeight: 600, color: C.textPrim, lineHeight: 1.2 }}>
            {w.word}
          </p>
          <p style={{ fontFamily: SANS, fontSize: '0.7rem', color: C.textMuted, marginTop: 1 }}>
            {w.partOfSpeech}
          </p>
        </div>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <ChevronDown size={14} color={C.textMuted} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontFamily: SERIF, fontSize: '0.9375rem', color: C.textSec, lineHeight: 1.6 }}>
                {w.definition}
              </p>
              {w.exampleSentence && (
                <p style={{
                  fontFamily: SERIF, fontSize: '0.875rem', fontStyle: 'italic',
                  color: C.textMuted, lineHeight: 1.6,
                  borderLeft: `2px solid ${C.border}`, paddingLeft: '0.75rem',
                }}>
                  &ldquo;{w.exampleSentence}&rdquo;
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type ScreenPhase = 'list' | 'flashcard' | 'config' | 'quiz';

export default function LetterStudyScreen({ letter, words, totalPoints }: Props) {
  const router = useRouter();
  const [phase, setPhase]   = useState<ScreenPhase>('list');
  const [config, setConfig] = useState<QuizConfig | null>(null);

  const learnedCount = words.filter(w => ['familiar', 'strong', 'mastered'].includes(w.masteryLevel)).length;
  const completePct  = words.length > 0 ? Math.round((learnedCount / words.length) * 100) : 0;

  const wordIds = words.map(w => w.wordId);

  // ── Flashcard phase — uses the real FlashcardScreen ──────────────────────────
  if (phase === 'flashcard') {
    const flashcardWords: FlashcardWord[] = words.map(w => ({
      id:              w.wordId,
      word:            w.word,
      definition:      w.definition,
      partOfSpeech:    w.partOfSpeech || null,
      synonyms:        w.synonyms,
      antonyms:        w.antonyms,
      exampleSentence: w.exampleSentence || null,
      masteryLevel:    w.masteryLevel,
      exposureCount:   w.exposureCount,
    }));

    const sessionData: FlashcardSessionData = {
      themeId:      0,
      themeName:    `Letter ${letter}`,
      unitName:     '',
      words:        flashcardWords,
      currentIndex: 0,
      ratings:      {},
      sessionId:    null,
      totalPoints,
      letterGroup:  letter,
    };

    return <FlashcardScreen data={sessionData} />;
  }

  // ── Quiz phase ───────────────────────────────────────────────────────────────
  if (phase === 'quiz' && config) {
    const hintWords = words.map(w => ({
      word:       w.word,
      pos:        w.partOfSpeech || null,
      definition: w.definition,
    }));
    return (
      <QuizScreen
        letterWordIds={wordIds}
        sessionType="letter"
        quizConfig={config}
        hintWords={hintWords}
      />
    );
  }

  // ── List phase ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: 'calc(100dvh - 72px)',
      maxWidth: 680,
      marginLeft: 'auto', marginRight: 'auto',
      width: '100%',
      padding: '1rem 1.25rem 2rem',
      display: 'flex', flexDirection: 'column', gap: '1rem',
    }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, display: 'flex' }}
          >
            <ArrowLeft size={20} />
          </button>

          <h1 style={{
            fontFamily: SERIF,
            fontSize: 'clamp(2.5rem, 8vw, 3.5rem)',
            fontWeight: 700, lineHeight: 1, color: C.textPrim,
          }}>
            {letter}
          </h1>

          <span style={{ fontFamily: SANS, fontSize: '0.8125rem', color: C.textMuted, alignSelf: 'flex-end', paddingBottom: '0.4rem' }}>
            {words.length} word{words.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Progress bar — same style as unit accordion */}
        {words.length > 0 && (
          <div>
            <div
              style={{
                height: 4, width: '100%', borderRadius: 99,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
                marginBottom: 6,
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completePct}%` }}
                transition={{ duration: 0.85, ease: 'easeOut', delay: 0.1 }}
                style={{
                  height: '100%',
                  borderRadius: 99,
                  background: 'linear-gradient(90deg, var(--color-lx-accent-red) 0%, var(--color-lx-accent-gold) 100%)',
                }}
              />
            </div>
            <span style={{ fontFamily: SANS, fontSize: '0.68rem', color: C.textMuted }}>
              {completePct}% complete · {learnedCount} of {words.length} learned
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      {words.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setPhase('flashcard')}
            style={{
              width: '100%', padding: '0.875rem',
              background: C.red, color: '#fff',
              border: 'none', borderRadius: 14, cursor: 'pointer',
              fontFamily: SANS, fontSize: '0.875rem', fontWeight: 600,
              boxShadow: '0 3px 16px rgba(230,57,70,0.28)',
            }}
          >
            Start Flashcards
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setPhase('config')}
            style={{
              width: '100%', padding: '0.8rem',
              background: 'transparent', color: C.textSec,
              border: `1px solid ${C.border}`, borderRadius: 14, cursor: 'pointer',
              fontFamily: SANS, fontSize: '0.8125rem', fontWeight: 500,
            }}
          >
            Practice Quiz
          </motion.button>
        </div>
      )}

      {/* Word list */}
      {words.length === 0 ? (
        <p style={{ fontFamily: SANS, fontSize: '0.875rem', color: C.textSec }}>
          No words starting with &ldquo;{letter}&rdquo; in the library.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {words.map((w, i) => <WordRow key={w.wordId} w={w} index={i} />)}
        </div>
      )}

      {/* Quiz config sheet */}
      <AnimatePresence>
        {phase === 'config' && (
          <QuizConfigSheet
            onStart={(cfg) => { setConfig(cfg); setPhase('quiz'); }}
            onCancel={() => setPhase('list')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
