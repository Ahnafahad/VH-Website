'use client';

import { motion } from 'framer-motion';
import type { PublicGuess } from '@/lib/vocab/game/types';

const TOTAL_ATTEMPTS = 6;

function pipColor(relation: PublicGuess['relation']): string {
  if (relation === 'correct' || relation === 'very_close') return 'var(--color-lx-success)';
  if (relation === 'related' || relation === 'same_topic') return 'var(--color-lx-warning)';
  return 'var(--color-lx-text-muted)';
}

export default function AttemptTracker({
  guesses,
  guessCount,
  finished,
}: {
  guesses: PublicGuess[];
  guessCount: number;
  finished: boolean;
}) {
  const consumed = guesses.filter(g => g.sentenceStatus !== 'pending');

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }} aria-label={`Attempt ${Math.min(guessCount + 1, TOTAL_ATTEMPTS)} of ${TOTAL_ATTEMPTS}`}>
      {Array.from({ length: TOTAL_ATTEMPTS }).map((_, i) => {
        const guess     = consumed[i];
        const isFilled  = Boolean(guess);
        const isCurrent = !finished && i === guessCount;
        const color     = guess ? pipColor(guess.relation) : 'var(--color-lx-border)';

        return (
          <motion.span
            key={i}
            initial={false}
            animate={{
              scale: isCurrent ? 1.15 : 1,
              backgroundColor: isFilled ? color : 'transparent',
              borderColor: isCurrent ? 'var(--color-lx-accent-gold)' : color,
            }}
            transition={{ type: 'spring' as const, stiffness: 420, damping: 26 }}
            style={{
              width: 24,
              height: 8,
              borderRadius: 4,
              border: '1.5px solid var(--color-lx-border)',
              boxShadow: isCurrent ? '0 0 8px rgba(244,168,40,0.5)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
