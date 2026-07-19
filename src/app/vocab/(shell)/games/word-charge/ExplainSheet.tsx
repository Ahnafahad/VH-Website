'use client';

/**
 * ExplainSheet — bottom sheet for wrong answers and help ("Not sure?").
 * Uses fixed positioning (safe because page wrapper animates opacity only).
 * Timer pauses while sheet is open.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { speak } from '@/lib/vocab/speak';
import type { ChargeWord, Connotation } from '@/lib/vocab/word-charge/types';

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";

// Matches QuizConfigSheet animation pattern
const backdropVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.22 } },
  exit:   { opacity: 0, transition: { duration: 0.18 } },
};
const sheetVariants = {
  hidden: { opacity: 0, y: 40 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28, delay: 0.04 } },
  exit:   { opacity: 0, y: 28, transition: { duration: 0.18 } },
};

function SideChip({ connotation }: { connotation: Connotation }) {
  const isPos = connotation === 'positive';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '0.3rem 0.75rem',
      borderRadius: 20,
      fontFamily: SANS, fontSize: '0.7rem', fontWeight: 700,
      background: isPos ? 'rgba(244,168,40,0.12)' : 'rgba(91,163,245,0.12)',
      border: isPos ? '1px solid rgba(244,168,40,0.4)' : '1px solid rgba(91,163,245,0.4)',
      color: isPos ? 'var(--color-lx-accent-gold)' : 'var(--color-lx-mastery-familiar)',
      letterSpacing: '0.04em',
    }}>
      {isPos ? '+' : '−'} {isPos ? 'Positive' : 'Negative'}
    </span>
  );
}

// "TIMER PAUSED" pill
function TimerPausedPill() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '0.25rem 0.75rem',
      borderRadius: 20,
      fontFamily: SANS, fontSize: '0.62rem', fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      background: 'rgba(244,168,40,0.1)',
      border: '1px solid rgba(244,168,40,0.35)',
      color: 'var(--color-lx-accent-gold)',
    }}>
      ⏸ Timer Paused
    </span>
  );
}

/** Wrong-answer path */
interface WrongProps {
  word:             ChargeWord;
  playerChoice:     Connotation;
  onContinue:       () => void;
  reduce:           boolean;
}

/** Help path — "Not sure?" */
interface HelpProps {
  word:             ChargeWord;
  onChoose:         (choice: Connotation) => void;
  onSkip:           () => void;
  reduce:           boolean;
}

type Props =
  | ({ mode: 'wrong' } & WrongProps)
  | ({ mode: 'help'  } & HelpProps);

export default function ExplainSheet(props: Props) {
  const { word, reduce } = props;

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end',
          padding: '0 0 env(safe-area-inset-bottom)',
        }}
      >
        <motion.div
          variants={sheetVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{
            width: '100%',
            maxWidth: 560,
            margin: '0 auto',
            background: 'var(--color-lx-surface)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            border: '1px solid var(--color-lx-border)',
            borderBottom: 'none',
            maxHeight: '80dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Drag handle */}
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'var(--color-lx-border)',
            margin: '1rem auto 0',
            flexShrink: 0,
          }} />

          {/* Scrollable content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem 1.5rem 0',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            className="hide-scrollbar"
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: 8 }}>
              <TimerPausedPill />
            </div>

            {/* Verdict (wrong only) */}
            {props.mode === 'wrong' && (
              <p style={{ fontFamily: SANS, fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-lx-accent-red)', marginBottom: '0.75rem' }}>
                Wrong — <em style={{ fontFamily: SERIF, fontSize: '0.9rem', fontStyle: 'italic' }}>{word.word}</em> is{' '}
                <SideChip connotation={word.connotation} />
              </p>
            )}

            {/* Word + speaker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, fontSize: '1.75rem', color: 'var(--color-lx-text-primary)', lineHeight: 1.05 }}>
                {word.word}
              </p>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => speak(word.word)}
                style={{
                  width: 40, height: 40, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: 'var(--color-lx-elevated)',
                  border: '1px solid var(--color-lx-border)',
                  color: 'var(--color-lx-accent-gold)',
                  cursor: 'pointer',
                }}
                aria-label={`Hear ${word.word} pronounced`}
              >
                <Volume2 size={16} />
              </motion.button>
              {/* Help mode must not reveal the answer — the student can still classify for +2 */}
              {props.mode === 'wrong' && <SideChip connotation={word.connotation} />}
            </div>

            {/* Part of speech */}
            {word.partOfSpeech && (
              <p style={{ fontFamily: SANS, fontSize: '0.65rem', color: 'var(--color-lx-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                {word.partOfSpeech}
              </p>
            )}

            {/* Definition */}
            <p style={{ fontFamily: SERIF, fontSize: '1.15rem', lineHeight: 1.55, color: 'var(--color-lx-text-primary)', marginBottom: '0.75rem' }}>
              {word.definition}
            </p>

            {/* Example sentence */}
            {word.exampleSentence && (
              <div style={{
                borderRadius: 12, padding: '0.75rem 1rem',
                background: 'var(--color-lx-elevated)',
                borderLeft: '2px solid var(--color-lx-accent-gold)',
                marginBottom: '0.75rem',
              }}>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '1.05rem', fontWeight: 500, color: 'var(--color-lx-text-primary)', lineHeight: 1.5 }}>
                  &ldquo;{word.exampleSentence}&rdquo;
                </p>
              </div>
            )}

            {/* Contrast antonyms */}
            {word.antonyms.length > 0 && (
              <p style={{ fontFamily: SANS, fontSize: '0.76rem', color: 'var(--color-lx-text-secondary)', marginBottom: '0.75rem' }}>
                Contrast:{' '}
                <span style={{ fontFamily: SERIF, fontStyle: 'italic', color: 'var(--color-lx-text-primary)' }}>
                  {word.antonyms[0]}
                </span>
              </p>
            )}
          </div>

          {/* Footer actions */}
          <div style={{ padding: '1rem 1.5rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))', flexShrink: 0, borderTop: '1px solid var(--color-lx-border)' }}>
            {props.mode === 'wrong' ? (
              <WrongFooter onContinue={props.onContinue} reduce={reduce} />
            ) : (
              <HelpFooter onChoose={props.onChoose} onSkip={props.onSkip} reduce={reduce} />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function WrongFooter({ onContinue, reduce }: { onContinue: () => void; reduce: boolean }) {
  return (
    <motion.button
      whileTap={reduce ? {} : { scale: 0.975 }}
      onClick={onContinue}
      style={{
        width: '100%', minHeight: 48,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-lx-accent-red)',
        border: 'none', borderRadius: 14,
        fontFamily: SANS, fontSize: '0.9rem', fontWeight: 700,
        color: '#fff', cursor: 'pointer',
      }}
    >
      Continue →
    </motion.button>
  );
}

function HelpFooter({
  onChoose,
  onSkip,
  reduce,
}: {
  onChoose: (choice: Connotation) => void;
  onSkip: () => void;
  reduce: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontFamily: SANS, fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-lx-text-muted)', textAlign: 'center', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        What&apos;s the charge? (+2 for correct)
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <motion.button
          whileTap={reduce ? {} : { scale: 0.97 }}
          onClick={() => onChoose('negative')}
          style={{
            flex: 1, minHeight: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'rgba(91,163,245,0.1)',
            border: '1px solid rgba(91,163,245,0.4)',
            borderRadius: 12,
            fontFamily: SANS, fontSize: '0.85rem', fontWeight: 700,
            color: 'var(--color-lx-mastery-familiar)',
            cursor: 'pointer',
          }}
        >
          − Negative
        </motion.button>
        <motion.button
          whileTap={reduce ? {} : { scale: 0.97 }}
          onClick={() => onChoose('positive')}
          style={{
            flex: 1, minHeight: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'rgba(244,168,40,0.1)',
            border: '1px solid rgba(244,168,40,0.4)',
            borderRadius: 12,
            fontFamily: SANS, fontSize: '0.85rem', fontWeight: 700,
            color: 'var(--color-lx-accent-gold)',
            cursor: 'pointer',
          }}
        >
          + Positive
        </motion.button>
      </div>
      <button
        onClick={onSkip}
        style={{
          background: 'none', border: 'none',
          fontFamily: SANS, fontSize: '0.78rem',
          color: 'var(--color-lx-text-muted)',
          cursor: 'pointer', padding: '0.5rem', minHeight: 44,
        }}
      >
        Skip word
      </button>
    </div>
  );
}
