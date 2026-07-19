'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Puzzle, Sparkles, Flame, Zap } from 'lucide-react';
import { useSafeNavigate } from '@/hooks/useSafeNavigate';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import AnimatedNumber from '@/components/vocab/AnimatedNumber';
import type { GameStateResponse } from '@/lib/vocab/game/types';
import type { ChargeSummaryResponse } from '@/lib/vocab/word-charge/types';

const SANS  = "'Sora', sans-serif";
const SERIF = "'Cormorant Garamond', Georgia, serif";

type ArchiveEntry = {
  date:        string;
  played:      boolean;
  status?:     string;
  totalEarned?: number;
  isToday:     boolean;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatRowDate(dateStr: string): { day: string; weekday: string } {
  // Parse as a local calendar date, not UTC-shifted.
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    day:     dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div style={{
      height: 208, borderRadius: 18,
      background: 'var(--color-lx-surface)',
      border: '1px solid var(--color-lx-border)',
      overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.04) 50%, transparent 80%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.8s ease infinite',
      }} />
    </div>
  );
}

function WordHuntHero({ state, onPlay }: { state: GameStateResponse; onPlay: () => void }) {
  const reduceMotion = useReducedMotion();
  const fb = useVocabFeedback();

  const status = state.session?.status ?? null;
  const attemptsUsed = state.session?.guessCount ?? 0;
  const pointsEarned = (state.session?.wordPoints ?? 0) + (state.session?.sentencePoints ?? 0);

  const label =
    status === 'won'  ? 'Solved' :
    status === 'lost' ? 'Round over' :
    status === 'in_progress' ? `Attempt ${attemptsUsed} of 6` :
    'Not started';

  const cta =
    status === 'won' || status === 'lost' ? 'Review round' :
    status === 'in_progress'              ? 'Continue' :
    'Play today’s round';

  const badgeColor =
    status === 'won'  ? 'var(--color-lx-success)' :
    status === 'lost' ? 'var(--color-lx-text-muted)' :
    status === 'in_progress' ? 'var(--color-lx-accent-gold)' :
    'var(--color-lx-accent-red)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
      style={{
        padding: '1.375rem 1.5rem 1.5rem',
        background: 'var(--color-lx-surface)',
        border: '1px solid var(--color-lx-border)',
        borderRadius: 18,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* One-time diagonal sheen sweep on mount */}
      {!reduceMotion && (
        <motion.div
          aria-hidden
          initial={{ x: '-110%', skewX: -12 }}
          animate={{ x: '210%' }}
          transition={{ duration: 1.1, delay: 0.35, ease: [0.25, 0, 0.15, 1] }}
          style={{
            position: 'absolute', top: 0, left: 0, width: '45%', height: '100%',
            background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.05) 45%, rgba(230,57,70,0.05) 55%, transparent 100%)',
            pointerEvents: 'none', zIndex: 2,
          }}
        />
      )}

      <div aria-hidden style={{
        position: 'absolute', top: '-45%', right: '-10%', width: '55%', height: '190%',
        background: 'radial-gradient(ellipse, rgba(230,57,70,0.10) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(230,57,70,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-lx-accent-red)',
            }}>
              <Puzzle size={16} />
            </span>
            <span style={{
              fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: 'var(--color-lx-text-muted)',
            }}>
              Daily Challenge
            </span>
          </div>

          <span style={{
            fontFamily: SANS, fontSize: '0.62rem', fontWeight: 700,
            letterSpacing: '0.04em',
            color: badgeColor,
            background: `color-mix(in srgb, ${badgeColor} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${badgeColor} 32%, transparent)`,
            borderRadius: 20, padding: '0.3rem 0.7rem',
            whiteSpace: 'nowrap',
          }}>
            {label}
          </span>
        </div>

        <h2 style={{
          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
          fontSize: '1.9rem', lineHeight: 1.1, color: 'var(--color-lx-text-primary)',
          marginTop: '0.75rem',
        }}>
          Word Hunt
        </h2>

        <p style={{
          fontFamily: SANS, fontSize: '0.78rem', color: 'var(--color-lx-text-secondary)',
          marginTop: '0.375rem', lineHeight: 1.5,
        }}>
          {state.topic} · {state.wordType} · {state.letterCount} letters
        </p>

        {(status === 'won' || status === 'lost') && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.75rem',
          }}>
            <Sparkles size={13} color="var(--color-lx-accent-gold)" />
            <span style={{ fontFamily: SANS, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-lx-accent-gold)' }}>
              <AnimatedNumber value={pointsEarned} /> points earned
            </span>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.975 }}
          onClick={() => { fb.play('tap'); onPlay(); }}
          style={{
            marginTop: '1.125rem', width: '100%', minHeight: '3.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--color-lx-accent-red)', color: '#fff',
            border: 'none', borderRadius: '0.875rem',
            fontFamily: SANS, fontSize: '0.9rem', fontWeight: 650,
            cursor: 'pointer',
          }}
        >
          {cta}
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Word Charge card ─────────────────────────────────────────────────────────

function WordChargeCard({
  summary,
  onPlay,
}: {
  summary: ChargeSummaryResponse | null;
  onPlay: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const fb = useVocabFeedback();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 260, damping: 24 }}
      style={{
        padding: '1.25rem 1.5rem 1.5rem',
        background: 'var(--color-lx-surface)',
        border: '1px solid var(--color-lx-border)',
        borderRadius: 18,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Split-charge motif: blue left / gold right subtle gradient duel */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(105deg, rgba(91,163,245,0.07) 0%, transparent 45%, rgba(244,168,40,0.07) 55%, transparent 100%)',
      }} />

      {/* One-time sheen on mount */}
      {!reduceMotion && (
        <motion.div
          aria-hidden
          initial={{ x: '-110%', skewX: -12 }}
          animate={{ x: '210%' }}
          transition={{ duration: 1.1, delay: 0.35, ease: [0.25, 0, 0.15, 1] }}
          style={{
            position: 'absolute', top: 0, left: 0, width: '45%', height: '100%',
            background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.05) 45%, rgba(244,168,40,0.05) 55%, transparent 100%)',
            pointerEvents: 'none', zIndex: 2,
          }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Icon + eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(244,168,40,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-lx-accent-gold)',
            }}>
              <Zap size={16} />
            </span>
            <span style={{
              fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: 'var(--color-lx-text-muted)',
            }}>
              Quick Play
            </span>
          </div>

          {/* Rounds played badge */}
          {summary && summary.roundsPlayed > 0 && (
            <span style={{
              fontFamily: SANS, fontSize: '0.62rem', fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--color-lx-accent-gold)',
              background: 'rgba(244,168,40,0.12)',
              border: '1px solid rgba(244,168,40,0.28)',
              borderRadius: 20, padding: '0.3rem 0.7rem',
              whiteSpace: 'nowrap',
            }}>
              {summary.roundsPlayed} round{summary.roundsPlayed !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
          fontSize: '1.9rem', lineHeight: 1.1, color: 'var(--color-lx-text-primary)',
          marginTop: '0.75rem',
        }}>
          Word Charge
        </h2>

        <p style={{
          fontFamily: SANS, fontSize: '0.78rem', color: 'var(--color-lx-text-secondary)',
          marginTop: '0.375rem', lineHeight: 1.5,
        }}>
          Positive or negative? 30 seconds.
        </p>

        {/* Personal best */}
        {summary && summary.personalBest > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.75rem',
          }}>
            <Sparkles size={13} color="var(--color-lx-accent-gold)" />
            <span style={{ fontFamily: SANS, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-lx-accent-gold)' }}>
              Best: <AnimatedNumber value={summary.personalBest} /> pts
            </span>
          </div>
        )}

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.975 }}
          onClick={() => { fb.play('tap'); onPlay(); }}
          style={{
            marginTop: '1.125rem', width: '100%', minHeight: '3.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--color-lx-accent-red)', color: '#fff',
            border: 'none', borderRadius: '0.875rem',
            fontFamily: SANS, fontSize: '0.9rem', fontWeight: 650,
            cursor: 'pointer',
          }}
        >
          Play
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Archive row ──────────────────────────────────────────────────────────────

function ArchiveRow({ entry, index, onOpen }: { entry: ArchiveEntry; index: number; onOpen: () => void }) {
  const fb = useVocabFeedback();
  const { day, weekday } = formatRowDate(entry.date);
  const [hovered, setHovered] = useState(false);

  const won  = entry.status === 'won';
  const lost = entry.status === 'lost';

  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring' as const, stiffness: 340, damping: 30, delay: Math.min(index * 0.03, 0.3) }}
      onClick={() => { fb.play('tap'); onOpen(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
        gap: 12, padding: '0.75rem 0.875rem', minHeight: 44,
        background: hovered ? 'var(--color-lx-elevated)' : 'transparent',
        border: '1px solid var(--color-lx-border)',
        borderRadius: 10, cursor: 'pointer',
        transition: 'background 0.16s ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 }}>
        <span style={{ fontFamily: SANS, fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-lx-text-muted)' }}>
          {weekday}
        </span>
        <span style={{ fontFamily: SERIF, fontSize: '1rem', fontWeight: 700, color: 'var(--color-lx-text-primary)', lineHeight: 1.2 }}>
          {day}
        </span>
      </div>

      <div style={{ width: 1, height: 26, background: 'var(--color-lx-border)', flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {entry.played ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: SANS, fontSize: '0.72rem', fontWeight: 600,
              color: won ? 'var(--color-lx-success)' : lost ? 'var(--color-lx-text-muted)' : 'var(--color-lx-text-secondary)',
            }}>
              {won ? 'Solved' : lost ? 'Not solved' : 'Played'}
            </span>
            {typeof entry.totalEarned === 'number' && (
              <span style={{ fontFamily: SANS, fontSize: '0.72rem', color: 'var(--color-lx-accent-gold)' }}>
                · {entry.totalEarned} pts
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={11} color="var(--color-lx-accent-gold)" />
            <span style={{ fontFamily: SANS, fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-lx-accent-gold)' }}>
              {entry.status === 'in_progress' ? 'In progress' : 'Catch up · ¼ points'}
            </span>
          </div>
        )}
      </div>

      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-lx-text-muted)' }}>
        <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GamesHubScreen() {
  const { navigate } = useSafeNavigate();
  const [todayState, setTodayState] = useState<GameStateResponse | null>(null);
  const [archive, setArchive] = useState<ArchiveEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [chargeSummary, setChargeSummary] = useState<ChargeSummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/vocab/game/state').then(r => r.ok ? r.json() as Promise<GameStateResponse> : Promise.reject(r)),
      fetch('/api/vocab/game/archive').then(r => r.ok ? r.json() as Promise<ArchiveEntry[]> : Promise.reject(r)),
    ])
      .then(([state, archiveData]) => {
        if (cancelled) return;
        setTodayState(state);
        setArchive(archiveData);
      })
      .catch(() => { if (!cancelled) setLoadError(true); });

    // Fetch charge summary gracefully — failure must not affect hub load
    fetch('/api/vocab/word-charge/summary')
      .then(r => r.ok ? r.json() as Promise<ChargeSummaryResponse> : Promise.reject(r))
      .then(s => { if (!cancelled) setChargeSummary(s); })
      .catch(() => { /* graceful: summary unavailable, card still renders */ });

    return () => { cancelled = true; };
  }, []);

  const pastRounds = (archive ?? []).filter(e => !e.isToday).slice().reverse();

  return (
    <div
      style={{ padding: '2rem 1.25rem 6rem', minHeight: '100dvh' }}
      className="max-w-[660px] md:max-w-none lg:max-w-[720px] md:px-8 md:pt-10"
    >
      <motion.p
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--color-lx-text-muted)', marginBottom: 4,
        }}
      >
        Games
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        style={{
          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
          fontSize: 'clamp(1.9rem, 7vw, 2.4rem)', lineHeight: 1.05,
          color: 'var(--color-lx-text-primary)', marginBottom: '1.5rem',
        }}
      >
        Daily challenges
      </motion.h1>

      {loadError && (
        <div style={{
          padding: '1rem 1.125rem', borderRadius: 12,
          background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.2)',
          fontFamily: SANS, fontSize: '0.8rem', color: 'var(--color-lx-text-secondary)',
        }}>
          Couldn&apos;t load today&apos;s round. Check your connection and try again.
        </div>
      )}

      {!loadError && (
        <AnimatePresence mode="wait">
          {todayState ? (
            <WordHuntHero
              key="hero"
              state={todayState}
              onPlay={() => navigate('/vocab/games/word-hunt')}
            />
          ) : (
            <HeroSkeleton key="skeleton" />
          )}
        </AnimatePresence>
      )}

      {/* ── Quick play section ─────────────────────────────────────────── */}
      <div style={{ marginTop: '2rem' }}>
        <p style={{
          fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--color-lx-text-muted)', marginBottom: '0.75rem',
        }}>
          Quick play
        </p>
        <WordChargeCard
          summary={chargeSummary}
          onPlay={() => navigate('/vocab/games/word-charge')}
        />
      </div>

      <div style={{ marginTop: '2rem' }}>
        <p style={{
          fontFamily: SANS, fontSize: '0.6rem', fontWeight: 600,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--color-lx-text-muted)', marginBottom: '0.75rem',
        }}>
          Past rounds
        </p>

        {archive === null && !loadError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{
                height: 52, borderRadius: 10,
                background: 'var(--color-lx-surface)',
                border: '1px solid var(--color-lx-border)',
                opacity: 1 - i * 0.15,
              }} />
            ))}
          </div>
        )}

        {archive !== null && pastRounds.length === 0 && (
          <p style={{ fontFamily: SANS, fontSize: '0.78rem', color: 'var(--color-lx-text-muted)' }}>
            Your first round starts today — come back tomorrow for more.
          </p>
        )}

        {pastRounds.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pastRounds.map((entry, i) => (
              <ArchiveRow
                key={entry.date}
                entry={entry}
                index={i}
                onOpen={() => navigate(`/vocab/games/word-hunt?date=${entry.date}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
