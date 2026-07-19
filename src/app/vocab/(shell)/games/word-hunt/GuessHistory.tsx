'use client';

import { motion } from 'framer-motion';
import type { PublicGuess, GuessRelation, SentenceStatus } from '@/lib/vocab/game/types';

const SANS  = "'Sora', sans-serif";
const SERIF = "'Cormorant Garamond', Georgia, serif";

const SENTENCE_TAG: Record<SentenceStatus, { label: string; color: string } | null> = {
  accepted_clear:   { label: 'Clear ✓', color: 'var(--color-lx-success)' },
  accepted_basic:   { label: 'Basic',   color: 'var(--color-lx-warning)' },
  accepted_revised: { label: 'Revised', color: 'var(--color-lx-warning)' },
  pending:  null,
  rejected: null,
};

const RELATION_LABEL: Record<GuessRelation, { label: string; color: string }> = {
  correct:    { label: 'Correct!',    color: 'var(--color-lx-success)' },
  very_close: { label: 'Very close',  color: 'var(--color-lx-success)' },
  related:    { label: 'Related',     color: 'var(--color-lx-warning)' },
  same_topic: { label: 'Same topic',  color: 'var(--color-lx-warning)' },
  opposite:   { label: 'Opposite',    color: 'var(--color-lx-text-muted)' },
  unrelated:  { label: 'Unrelated',   color: 'var(--color-lx-text-muted)' },
};

function GuessCard({ guess, index }: { guess: PublicGuess; index: number }) {
  const sentenceTag = SENTENCE_TAG[guess.sentenceStatus];
  const relation     = guess.relation ? RELATION_LABEL[guess.relation] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 340, damping: 30, delay: Math.min(index * 0.04, 0.2) }}
      style={{
        background: 'var(--color-lx-surface)',
        border: '1px solid var(--color-lx-border)',
        borderRadius: 14,
        padding: '0.875rem 1rem',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
          fontSize: '1.15rem', color: 'var(--color-lx-text-primary)', textTransform: 'capitalize',
        }}>
          {guess.word}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {sentenceTag && (
            <span style={{ fontFamily: SANS, fontSize: '0.62rem', fontWeight: 700, color: sentenceTag.color }}>
              {sentenceTag.label}
            </span>
          )}
          {guess.sentencePointsEarned > 0 && (
            <span style={{
              fontFamily: SANS, fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-lx-accent-gold)',
              background: 'rgba(244,168,40,0.12)', borderRadius: 10, padding: '0.1rem 0.45rem',
            }}>
              +{guess.sentencePointsEarned}
            </span>
          )}
        </div>
      </div>

      <p style={{ fontFamily: SERIF, fontSize: '0.9rem', fontStyle: 'italic', lineHeight: 1.5, color: 'var(--color-lx-text-secondary)', margin: 0 }}>
        &ldquo;{guess.sentence}&rdquo;
      </p>

      {relation && guess.relationFeedback && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 3,
          marginTop: 2, paddingTop: 8, borderTop: '1px solid var(--color-lx-border)',
        }}>
          <span style={{ fontFamily: SANS, fontSize: '0.68rem', fontWeight: 700, color: relation.color }}>
            {relation.label}
          </span>
          <span style={{ fontFamily: SANS, fontSize: '0.76rem', color: 'var(--color-lx-text-muted)', lineHeight: 1.45 }}>
            {guess.relationFeedback}
          </span>
        </div>
      )}
    </motion.div>
  );
}

export default function GuessHistory({ guesses }: { guesses: PublicGuess[] }) {
  const consumed = guesses.filter(g => g.sentenceStatus !== 'pending' && g.sentenceStatus !== 'rejected');
  if (consumed.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{
        fontFamily: SANS, fontSize: '0.58rem', fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--color-lx-text-muted)',
      }}>
        Your guesses
      </p>
      {consumed.map((g, i) => <GuessCard key={g.guessNumber} guess={g} index={i} />)}
    </div>
  );
}
