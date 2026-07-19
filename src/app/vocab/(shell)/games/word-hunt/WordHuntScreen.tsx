'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, AlertTriangle, RotateCcw } from 'lucide-react';
import { useSafeNavigate } from '@/hooks/useSafeNavigate';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import { useBadgeQueue } from '@/lib/vocab/badges/queue';
import type { GameStateResponse } from '@/lib/vocab/game/types';
import AttemptTracker from './AttemptTracker';
import ClueDossier from './ClueDossier';
import ClueFeed from './ClueFeed';
import GuessHistory from './GuessHistory';
import RevealCard from './RevealCard';

const SANS  = "'Sora', sans-serif";
const SERIF = "'Cormorant Garamond', Georgia, serif";

type GuessResponse = GameStateResponse & {
  accepted: boolean;
  sentenceFeedback?: string;
  guessResult?: { relation: string; relationFeedback: string; correct: boolean };
  earnedBadges?: { id: string; name: string; description: string; category: 'short_term' | 'mid_term' | 'long_term' | 'ultimate' }[];
};

type Phase = 'loading' | 'error' | 'ready';

type SubmitError = { kind: 'judge-retry' | 'inline'; message: string } | null;

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function GameLoading() {
  return (
    <div style={{
      minHeight: 'calc(100dvh - 72px)', display: 'flex', flexDirection: 'column',
      gap: 14, padding: '1.25rem', maxWidth: 640, marginLeft: 'auto', marginRight: 'auto',
    }}>
      <div style={{ height: 30, width: 140, borderRadius: 8, background: 'var(--color-lx-elevated)', margin: '0 auto', animation: 'lx-wh-pulse 1.6s ease-in-out infinite' }} />
      <div style={{ height: 118, borderRadius: 16, background: 'var(--color-lx-surface)', border: '1px solid var(--color-lx-border)', animation: 'lx-wh-pulse 1.6s ease-in-out infinite' }} />
      <div style={{ height: 80, borderRadius: 14, background: 'var(--color-lx-surface)', border: '1px solid var(--color-lx-border)', animation: 'lx-wh-pulse 1.6s ease-in-out infinite', animationDelay: '120ms' }} />
      <style>{`@keyframes lx-wh-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function GameError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div style={{
      minHeight: 'calc(100dvh - 72px)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', gap: '1.25rem', textAlign: 'center',
    }}>
      <div style={{
        background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.25)',
        borderRadius: 16, padding: '2rem 1.5rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
      }}>
        <AlertTriangle size={30} color="var(--color-lx-accent-red)" />
        <p style={{ fontFamily: SERIF, fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-lx-text-primary)' }}>
          Round unavailable
        </p>
        <p style={{ fontFamily: SANS, fontSize: '0.85rem', color: 'var(--color-lx-text-secondary)', lineHeight: 1.5 }}>
          {message}
        </p>
      </div>
      <button
        onClick={onBack}
        style={{ fontFamily: SANS, fontSize: '0.85rem', color: 'var(--color-lx-accent-red)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
      >
        ← Back to games
      </button>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WordHuntScreen({ date }: { date?: string }) {
  const { navigate } = useSafeNavigate();
  const fb    = useVocabFeedback();
  const { push } = useBadgeQueue();

  const [phase, setPhase]           = useState<Phase>('loading');
  const [errorMsg, setErrorMsg]     = useState('Something went wrong loading this round.');
  const [gameState, setGameState]   = useState<GameStateResponse | null>(null);

  // Input / revise state
  const [wordInput, setWordInput]       = useState('');
  const [sentenceInput, setSentenceInput] = useState('');
  const [revising, setRevising]         = useState(false);
  const [lockedWord, setLockedWord]     = useState('');
  const [rejectFeedback, setRejectFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState<SubmitError>(null);

  const seededRef = useRef(false);

  // ── Load round state ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const url = date ? `/api/vocab/game/state?date=${date}` : '/api/vocab/game/state';

    fetch(url)
      .then(async r => {
        if (r.status === 404) throw new Error('There’s no round for this date yet.');
        if (r.status === 403) throw new Error('This round isn’t available yet — check back on the day.');
        if (!r.ok) {
          const body = await r.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? 'Something went wrong loading this round.');
        }
        return r.json() as Promise<GameStateResponse>;
      })
      .then(data => {
        if (cancelled) return;
        setGameState(data);

        // Resume a rejected-sentence guess left pending from a previous visit.
        if (!seededRef.current) {
          seededRef.current = true;
          const last = data.session?.guesses[data.session.guesses.length - 1];
          if (last && last.sentenceStatus === 'pending') {
            setRevising(true);
            setLockedWord(last.word);
            setSentenceInput(last.sentence);
            setRejectFeedback(last.sentenceFeedback);
          }
        }

        setPhase('ready');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorMsg(err.message);
        setPhase('error');
      });

    return () => { cancelled = true; };
  }, [date]);

  if (phase === 'loading') return <GameLoading />;
  if (phase === 'error' || !gameState) {
    return <GameError message={errorMsg} onBack={() => navigate('/vocab/games')} />;
  }

  const session   = gameState.session;
  const finished  = session?.status === 'won' || session?.status === 'lost';
  const guessCount = session?.guessCount ?? 0;

  const handleSubmit = async () => {
    if (submitting || finished) return;
    const trimmedSentence = sentenceInput.trim();
    if (trimmedSentence === '') return;
    if (!revising && wordInput.trim() === '') return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = revising
        ? await fetch('/api/vocab/game/revise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: gameState.date, sentence: trimmedSentence }),
          })
        : await fetch('/api/vocab/game/guess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: gameState.date, word: wordInput.trim(), sentence: trimmedSentence }),
          });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        const message = (body as { error?: string } | null)?.error ?? 'Something went wrong — please try again.';
        setSubmitError({ kind: res.status === 503 ? 'judge-retry' : 'inline', message });
        setSubmitting(false);
        return;
      }

      const data = body as GuessResponse;
      setGameState(data);

      if (!data.accepted) {
        setRevising(true);
        setLockedWord(revising ? lockedWord : wordInput.trim());
        setRejectFeedback(data.sentenceFeedback ?? null);
        fb.play('unsure');
      } else {
        setRevising(false);
        setLockedWord('');
        setWordInput('');
        setSentenceInput('');
        setRejectFeedback(null);
        fb.play(data.guessResult?.correct ? 'correct' : 'incorrect');
        if (data.earnedBadges?.length) push(data.earnedBadges);
      }
      setSubmitting(false);
    } catch {
      setSubmitError({ kind: 'inline', message: 'Network error — please try again.' });
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && !finished && sentenceInput.trim() !== '' && (revising || wordInput.trim() !== '');
  const showInput = !finished;

  return (
    <div
      style={{ maxWidth: 640, marginLeft: 'auto', marginRight: 'auto', width: '100%', paddingBottom: showInput ? 190 : 40 }}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.25rem 0.5rem',
      }}>
        <button
          onClick={() => { fb.play('tap'); navigate('/vocab/games'); }}
          aria-label="Back to games"
          style={{
            width: 44, height: 44, borderRadius: '50%', background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: 'var(--color-lx-text-secondary)', marginLeft: -10,
          }}
        >
          <ChevronLeft size={20} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <p style={{ fontFamily: SANS, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-lx-text-primary)' }}>
            Word Hunt
          </p>
          {gameState.isCatchUp && (
            <span style={{ fontFamily: SANS, fontSize: '0.58rem', fontWeight: 700, color: 'var(--color-lx-accent-gold)', letterSpacing: '0.04em' }}>
              Catch-up round · ¼ points
            </span>
          )}
        </div>

        <div style={{ width: 44 }} />
      </div>

      {/* ── Attempt tracker ── */}
      <div style={{ padding: '0.5rem 1.25rem 1rem' }}>
        <AttemptTracker
          guesses={session?.guesses ?? []}
          guessCount={guessCount}
          finished={Boolean(finished)}
        />
      </div>

      {/* ── Content ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 1.25rem' }}>
        <ClueDossier
          topic={gameState.topic}
          wordType={gameState.wordType}
          letterCount={gameState.letterCount}
          tone={gameState.tone}
          isCatchUp={gameState.isCatchUp}
        />

        <ClueFeed
          clues={gameState.unlockedClues}
          readOnly={Boolean(finished)}
          onPickChoice={(w) => { if (!revising && !finished) { setWordInput(w); fb.play('select'); } }}
        />

        <GuessHistory guesses={session?.guesses ?? []} />

        {gameState.reveal && session && (
          <RevealCard
            reveal={gameState.reveal}
            won={session.status === 'won'}
            wordPoints={session.wordPoints}
            sentencePoints={session.sentencePoints}
            isCatchUp={gameState.isCatchUp}
            totalPoints={gameState.totalPoints}
          />
        )}
      </div>

      {/* ── Sticky input area ── */}
      {showInput && (
        <div className="lx-wh-input-bar">
          <div style={{
            maxWidth: 640, marginLeft: 'auto', marginRight: 'auto',
            background: 'var(--color-lx-surface)', border: '1px solid var(--color-lx-border)',
            borderRadius: 16, padding: '0.875rem', boxShadow: '0 -4px 24px rgba(0,0,0,0.24)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {rejectFeedback && (
              <div style={{
                display: 'flex', gap: 8, padding: '0.625rem 0.75rem',
                background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.25)',
                borderRadius: 10,
              }}>
                <AlertTriangle size={14} color="var(--color-lx-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: SANS, fontSize: '0.76rem', lineHeight: 1.45, color: 'var(--color-lx-text-secondary)', margin: 0 }}>
                  {rejectFeedback}
                </p>
              </div>
            )}

            <AnimatePresence>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.75rem',
                    background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.25)', borderRadius: 10,
                  }}>
                    {submitError.kind === 'judge-retry' ? <RotateCcw size={13} color="var(--color-lx-accent-red)" /> : <AlertTriangle size={13} color="var(--color-lx-accent-red)" />}
                    <p style={{ fontFamily: SANS, fontSize: '0.76rem', color: 'var(--color-lx-accent-red)', margin: 0, flex: 1 }}>
                      {submitError.kind === 'judge-retry' ? 'Could not evaluate — try again' : submitError.message}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <input
              type="text"
              value={revising ? lockedWord : wordInput}
              onChange={(e) => !revising && setWordInput(e.target.value)}
              disabled={revising || submitting}
              placeholder="Your guess…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{
                width: '100%', minHeight: 44, padding: '0.625rem 0.875rem',
                background: revising ? 'var(--color-lx-elevated)' : 'var(--color-lx-base)',
                border: '1px solid var(--color-lx-border)', borderRadius: 10,
                fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: '1rem',
                color: revising ? 'var(--color-lx-text-muted)' : 'var(--color-lx-text-primary)',
                outline: 'none',
              }}
            />

            <textarea
              value={sentenceInput}
              onChange={(e) => setSentenceInput(e.target.value)}
              disabled={submitting}
              placeholder="Use it in a sentence…"
              rows={2}
              style={{
                width: '100%', padding: '0.625rem 0.875rem', resize: 'none',
                background: 'var(--color-lx-base)', border: '1px solid var(--color-lx-border)',
                borderRadius: 10, fontFamily: SANS, fontSize: '0.85rem', lineHeight: 1.4,
                color: 'var(--color-lx-text-primary)', outline: 'none',
              }}
            />

            <motion.button
              whileTap={canSubmit ? { scale: 0.98 } : {}}
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              style={{
                width: '100%', minHeight: '3.25rem', border: 'none', borderRadius: '0.875rem',
                background: 'var(--color-lx-accent-red)', color: '#fff',
                fontFamily: SANS, fontSize: '0.9rem', fontWeight: 650,
                cursor: canSubmit ? 'pointer' : 'default',
                opacity: canSubmit ? 1 : 0.55,
              }}
            >
              {submitting ? 'Evaluating your sentence…' : revising ? 'Revise sentence' : 'Submit guess'}
            </motion.button>
          </div>
        </div>
      )}

      <style>{`
        .lx-wh-input-bar {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 40;
          padding: 0.875rem 1.25rem calc(88px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(to top, var(--color-lx-base) 65%, transparent);
        }
        @media (min-width: 768px) {
          .lx-wh-input-bar {
            left: 220px;
            padding: 0.875rem 2rem 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
