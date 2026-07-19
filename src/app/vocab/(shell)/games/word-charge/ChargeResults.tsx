'use client';

/**
 * ChargeResults — end-of-round summary.
 * Points from server (authoritative); local answers used for review list.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { speak } from '@/lib/vocab/speak';
import AnimatedNumber from '@/components/vocab/AnimatedNumber';
import { LexiArtwork } from '@/components/vocab/LexiAsset';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import type { ChargeWord, ChargeAnswer, ChargeFinishResponse, Connotation } from '@/lib/vocab/word-charge/types';

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS  = "'Sora', sans-serif";

/** Round tier from server-recomputed stats — drives the result emblem. */
function roundTier(r: ChargeFinishResponse): { asset: string; label: string } {
  const attempts = r.correct + r.wrong;
  const acc = attempts > 0 ? r.correct / attempts : 0;
  if (r.wrong === 0 && r.skipped === 0 && r.correct >= 8) return { asset: 'result-perfect',   label: 'Perfect round' };
  if (acc >= 0.8 && r.correct >= 5)                       return { asset: 'result-excellent', label: 'Excellent' };
  if (acc >= 0.55 && attempts > 0)                        return { asset: 'result-good',      label: 'Good round' };
  return { asset: 'result-weak', label: 'Keep charging' };
}

function SideChip({ connotation }: { connotation: Connotation }) {
  const isPos = connotation === 'positive';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '0.2rem 0.6rem',
      borderRadius: 20,
      fontFamily: SANS, fontSize: '0.65rem', fontWeight: 700,
      background: isPos ? 'rgba(244,168,40,0.12)' : 'rgba(91,163,245,0.12)',
      border: isPos ? '1px solid rgba(244,168,40,0.4)' : '1px solid rgba(91,163,245,0.4)',
      color: isPos ? 'var(--color-lx-accent-gold)' : 'var(--color-lx-mastery-familiar)',
    }}>
      {isPos ? '+' : '−'} {isPos ? 'Pos' : 'Neg'}
    </span>
  );
}

/** Expandable review row for a single word */
function ReviewRow({ word, answer }: { word: ChargeWord; answer: ChargeAnswer }) {
  const [expanded, setExpanded] = useState(false);
  const playerChoice = answer.choice;
  const correct = playerChoice === word.connotation;

  return (
    <div style={{
      borderRadius: 12,
      background: 'var(--color-lx-surface)',
      border: '1px solid var(--color-lx-border)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: '0.75rem 1rem', minHeight: 52,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-lx-text-primary)', flex: 1 }}>
          {word.word}
        </span>

        {/* Player choice */}
        {playerChoice ? (
          <SideChip connotation={playerChoice} />
        ) : (
          <span style={{ fontFamily: SANS, fontSize: '0.65rem', color: 'var(--color-lx-text-muted)' }}>skipped</span>
        )}
        <span style={{ fontFamily: SANS, fontSize: '0.7rem', color: 'var(--color-lx-text-muted)' }}>→</span>
        <SideChip connotation={word.connotation} />

        {/* Correct/wrong indicator */}
        <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>
          {correct ? '✓' : playerChoice ? '✗' : '—'}
        </span>

        {expanded ? <ChevronUp size={14} style={{ color: 'var(--color-lx-text-muted)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--color-lx-text-muted)', flexShrink: 0 }} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', borderTop: '1px solid var(--color-lx-border)' }}>
              {/* Word + speaker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: '0.75rem' }}>
                <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: 'var(--color-lx-text-primary)' }}>
                  {word.word}
                </span>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => speak(word.word)}
                  style={{
                    width: 36, height: 36,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', background: 'var(--color-lx-elevated)',
                    border: '1px solid var(--color-lx-border)',
                    color: 'var(--color-lx-accent-gold)', cursor: 'pointer',
                  }}
                  aria-label={`Hear ${word.word}`}
                >
                  <Volume2 size={14} />
                </motion.button>
                {word.partOfSpeech && (
                  <span style={{ fontFamily: SANS, fontSize: '0.62rem', color: 'var(--color-lx-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {word.partOfSpeech}
                  </span>
                )}
              </div>

              {/* Definition */}
              <p style={{ fontFamily: SERIF, fontSize: '1.05rem', lineHeight: 1.5, color: 'var(--color-lx-text-primary)' }}>
                {word.definition}
              </p>

              {/* Example */}
              {word.exampleSentence && (
                <div style={{ borderRadius: 10, padding: '0.6rem 0.875rem', background: 'var(--color-lx-elevated)', borderLeft: '2px solid var(--color-lx-accent-gold)' }}>
                  <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '0.95rem', color: 'var(--color-lx-text-primary)', lineHeight: 1.5 }}>
                    &ldquo;{word.exampleSentence}&rdquo;
                  </p>
                </div>
              )}

              {/* Contrast */}
              {word.antonyms.length > 0 && (
                <p style={{ fontFamily: SANS, fontSize: '0.73rem', color: 'var(--color-lx-text-secondary)' }}>
                  Contrast: <span style={{ fontFamily: SERIF, fontStyle: 'italic', color: 'var(--color-lx-text-primary)' }}>{word.antonyms[0]}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Props {
  result:        ChargeFinishResponse | null;
  saveError:     boolean;
  onSaveRetry:   () => void;
  onPlayAgain:   () => void;
  onBack:        () => void;
  words:         ChargeWord[];
  answers:       ChargeAnswer[];
  reduce:        boolean;
}

export default function ChargeResults({ result, saveError, onSaveRetry, onPlayAgain, onBack, words, answers, reduce }: Props) {
  const fb = useVocabFeedback();

  const completePlayed = useRef(false);
  useEffect(() => {
    if (result && !completePlayed.current) {
      completePlayed.current = true;
      fb.play('complete');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Words to review: wrong or skipped answers
  const reviewAnswers = answers.filter(a => {
    const word = words.find(w => w.id === a.wordId);
    if (!word) return false;
    return a.choice !== word.connotation || a.choice === null;
  });
  const reviewWords = reviewAnswers.map(a => words.find(w => w.id === a.wordId)).filter((w): w is ChargeWord => !!w);

  const accuracy = result
    ? result.correct + result.wrong > 0
      ? Math.round((result.correct / (result.correct + result.wrong)) * 100)
      : 0
    : null;

  return (
    <div style={{ padding: '2rem 1.25rem', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto' }}>
      {/* Loading skeleton for result */}
      {!result && !saveError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[160, 80, 120].map((h, i) => (
            <div key={i} style={{
              height: h, borderRadius: 14,
              background: 'var(--color-lx-surface)',
              border: '1px solid var(--color-lx-border)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.04) 50%, transparent 80%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.8s ease infinite',
              }} />
            </div>
          ))}
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div style={{
          padding: '1rem 1.125rem', borderRadius: 12, marginBottom: '1.25rem',
          background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.2)',
          fontFamily: SANS, fontSize: '0.8rem', color: 'var(--color-lx-text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          Couldn&apos;t save results. Your answers are preserved.
          <button
            onClick={onSaveRetry}
            style={{
              background: 'var(--color-lx-accent-red)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '0.4rem 0.75rem',
              fontFamily: SANS, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', minHeight: 36, flexShrink: 0,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main result card */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          {/* Points headline */}
          <div style={{
            textAlign: 'center', marginBottom: '1.5rem',
            padding: '1.75rem 1.5rem',
            background: 'var(--color-lx-surface)',
            border: '1px solid var(--color-lx-border)',
            borderRadius: 18,
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Ambient glow */}
            <div aria-hidden style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at center top, rgba(244,168,40,0.08) 0%, transparent 65%)',
            }} />

            {/* Round tier emblem */}
            <motion.div
              initial={{ opacity: 0, scale: reduce ? 1 : 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: '0.875rem' }}
            >
              <LexiArtwork path={`games/word-charge/${roundTier(result).asset}.svg`} width={64} height={64} loading="eager" />
              <span style={{
                fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
                fontSize: '1.15rem', color: 'var(--color-lx-text-primary)',
              }}>
                {roundTier(result).label}
              </span>
            </motion.div>

            <p style={{ fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-lx-text-muted)', marginBottom: '0.5rem' }}>
              Points earned
            </p>
            <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(2.8rem, 10vw, 4rem)', color: 'var(--color-lx-accent-gold)', lineHeight: 1 }}>
              <AnimatedNumber value={result.pointsEarned} />
            </p>

            {/* New personal best chip */}
            {result.isNewBest && (
              <motion.div
                initial={{ opacity: 0, scale: reduce ? 1 : 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 280, damping: 20 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: '0.75rem',
                  padding: '0.3rem 0.75rem', borderRadius: 20,
                  background: 'rgba(244,168,40,0.12)',
                  border: '1px solid rgba(244,168,40,0.4)',
                  fontFamily: SANS, fontSize: '0.72rem', fontWeight: 700,
                  color: 'var(--color-lx-accent-gold)',
                }}
              >
                ★ New personal best!
              </motion.div>
            )}

            {/* Central total */}
            <p style={{ fontFamily: SANS, fontSize: '0.73rem', color: 'var(--color-lx-text-muted)', marginTop: '0.625rem' }}>
              Total: <span style={{ color: 'var(--color-lx-text-secondary)', fontWeight: 600 }}>{result.totalPoints} pts</span>
            </p>
          </div>

          {/* Stat row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
            {[
              { label: 'Correct', value: result.correct,  color: 'var(--color-lx-success)' },
              { label: 'Wrong',   value: result.wrong,    color: 'var(--color-lx-accent-red)' },
              { label: 'Skipped', value: result.skipped,  color: 'var(--color-lx-text-muted)' },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, padding: '0.75rem 0.5rem', borderRadius: 12,
                background: 'var(--color-lx-surface)', border: '1px solid var(--color-lx-border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
                <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '1.6rem', color: s.color, lineHeight: 1 }}>
                  {s.value}
                </span>
                <span style={{ fontFamily: SANS, fontSize: '0.6rem', color: 'var(--color-lx-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {s.label}
                </span>
              </div>
            ))}
            {/* Best streak */}
            <div style={{
              flex: 1, padding: '0.75rem 0.5rem', borderRadius: 12,
              background: 'var(--color-lx-surface)', border: '1px solid var(--color-lx-border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '1.6rem', color: 'var(--color-lx-accent-gold)', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Flame size={18} />
                {result.bestStreak}
              </span>
              <span style={{ fontFamily: SANS, fontSize: '0.6rem', color: 'var(--color-lx-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Streak
              </span>
            </div>
          </div>

          {/* Accuracy */}
          {accuracy !== null && (
            <p style={{ fontFamily: SANS, fontSize: '0.78rem', color: 'var(--color-lx-text-secondary)', textAlign: 'center', marginBottom: '1.25rem' }}>
              Accuracy: <span style={{ fontWeight: 700, color: 'var(--color-lx-text-primary)' }}>{accuracy}%</span>
            </p>
          )}

          {/* Review list */}
          {reviewWords.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{
                fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                color: 'var(--color-lx-text-muted)', marginBottom: '0.75rem',
              }}>
                Words to review
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reviewWords.map((w, i) => (
                  <ReviewRow key={w.id} word={w} answer={reviewAnswers[i]} />
                ))}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <motion.button
              whileTap={reduce ? {} : { scale: 0.975 }}
              onClick={onPlayAgain}
              style={{
                width: '100%', minHeight: 52,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--color-lx-accent-red)',
                border: 'none', borderRadius: 14,
                fontFamily: SANS, fontSize: '0.9rem', fontWeight: 700,
                color: '#fff', cursor: 'pointer',
              }}
            >
              Play again →
            </motion.button>
            <button
              onClick={onBack}
              style={{
                width: '100%', minHeight: 48,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: '1px solid var(--color-lx-border)', borderRadius: 14,
                fontFamily: SANS, fontSize: '0.85rem', fontWeight: 500,
                color: 'var(--color-lx-text-secondary)', cursor: 'pointer',
              }}
            >
              Back to games
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
