'use client';

import { motion } from 'framer-motion';
import type { PublicGuess } from '@/lib/vocab/game/types';
import { LexiArtwork } from '@/components/vocab/LexiAsset';

const TOTAL_ATTEMPTS = 6;

/**
 * Pick the right attempt pip SVG asset for a completed guess.
 * correct/very_close → attempt-correct.svg (success)
 * all others (wrong/unrelated) → attempt-used.svg (neutral)
 * Game lost final fill → attempt-failed.svg (only when finished+lost on last)
 */
function pipAsset(relation: PublicGuess['relation']): string {
  if (relation === 'correct' || relation === 'very_close') return 'games/word-hunt/attempt-correct.svg';
  return 'games/word-hunt/attempt-used.svg';
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
  const won = finished && consumed.some(g => g.relation === 'correct' || g.relation === 'very_close');
  const lost = finished && !won;

  return (
    <div
      style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}
      aria-label={`Attempt ${Math.min(guessCount + 1, TOTAL_ATTEMPTS)} of ${TOTAL_ATTEMPTS}`}
    >
      {Array.from({ length: TOTAL_ATTEMPTS }).map((_, i) => {
        const guess     = consumed[i];
        const isFilled  = Boolean(guess);
        const isCurrent = !finished && i === guessCount;
        // Last slot on a lost game gets attempt-failed
        const isLastLost = lost && i === TOTAL_ATTEMPTS - 1 && !guess;

        if (isFilled && guess) {
          // Completed attempt pip
          return (
            <motion.span
              key={i}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' as const, stiffness: 440, damping: 26, delay: i * 0.04 }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <LexiArtwork path={pipAsset(guess.relation)} width={22} height={22} />
            </motion.span>
          );
        }

        if (isLastLost) {
          return (
            <motion.span
              key={i}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' as const, stiffness: 440, damping: 26 }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <LexiArtwork
                path="games/word-hunt/attempt-failed.svg" width={22} height={22}
              />
            </motion.span>
          );
        }

        // Unused pip
        return (
          <motion.span
            key={i}
            initial={false}
            animate={{
              scale: isCurrent ? 1.2 : 1,
            }}
            transition={{ type: 'spring' as const, stiffness: 420, damping: 26 }}
            style={{
              display:    'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: isCurrent ? 'drop-shadow(0 0 6px rgba(244,168,40,0.6))' : 'none',
            }}
          >
            <LexiArtwork
              path="games/word-hunt/attempt-unused.svg" width={22} height={22}
              style={{ opacity: isCurrent ? 1 : 0.45 }}
            />
          </motion.span>
        );
      })}
    </div>
  );
}
