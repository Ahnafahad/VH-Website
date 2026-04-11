'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Variants, useInView } from 'framer-motion';
import type { LeaderboardData, LeaderEntry, AllTimeEntry, HallEntry } from '@/lib/vocab/leaderboard-data';

// ─── Medal colours ────────────────────────────────────────────────────────────

const MEDAL = {
  1: {
    ring:      'rgba(244,168,40,0.9)',
    glow:      '0 0 20px rgba(244,168,40,0.45), 0 0 48px rgba(244,168,40,0.15)',
    border:    '1px solid rgba(244,168,40,0.4)',
    bg:        'linear-gradient(145deg, rgba(244,168,40,0.13) 0%, rgba(244,168,40,0.04) 100%)',
    numeral:   'I',
    label:     'GOLD',
  },
  2: {
    ring:      'rgba(192,192,192,0.9)',
    glow:      '0 0 20px rgba(192,192,192,0.35), 0 0 48px rgba(192,192,192,0.10)',
    border:    '1px solid rgba(192,192,192,0.3)',
    bg:        'linear-gradient(145deg, rgba(192,192,192,0.10) 0%, rgba(192,192,192,0.03) 100%)',
    numeral:   'II',
    label:     'SILVER',
  },
  3: {
    ring:      'rgba(205,127,50,0.9)',
    glow:      '0 0 18px rgba(205,127,50,0.35), 0 0 40px rgba(205,127,50,0.10)',
    border:    '1px solid rgba(205,127,50,0.3)',
    bg:        'linear-gradient(145deg, rgba(205,127,50,0.10) 0%, rgba(205,127,50,0.03) 100%)',
    numeral:   'III',
    label:     'BRONZE',
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Podium card (top 3) ──────────────────────────────────────────────────────

interface PodiumCardProps {
  rank:    1 | 2 | 3;
  name:    string;
  points:  number;
  isMe:    boolean;
  delay:   number;
  label:   string;
}

function PodiumCard({ rank, name, points, isMe, delay, label }: PodiumCardProps) {
  const m = MEDAL[rank];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 26, delay }}
      className="relative flex flex-col items-center gap-3 rounded-2xl px-4 py-5 overflow-hidden"
      style={{
        background: isMe
          ? 'linear-gradient(145deg, rgba(230,57,70,0.14) 0%, rgba(230,57,70,0.04) 100%)'
          : m.bg,
        border:     isMe ? '1px solid rgba(230,57,70,0.4)' : m.border,
        boxShadow:  isMe ? '0 0 22px rgba(230,57,70,0.22)' : m.glow,
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Watermark numeral */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1 -top-1 select-none font-serif leading-none"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize:   '5.5rem',
          fontWeight: 700,
          fontStyle:  'italic',
          color:      isMe ? 'rgba(230,57,70,0.08)' : `${m.ring.replace('0.9)', '0.08)')}`,
          lineHeight: 1,
        }}
      >
        {m.numeral}
      </span>

      {/* Avatar */}
      <div
        className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
        style={{
          background:  'var(--color-lx-elevated)',
          boxShadow:   `0 0 0 2px ${isMe ? 'var(--color-lx-accent-red)' : m.ring}`,
        }}
      >
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize:   '1.4rem',
            fontWeight: 700,
            color:      isMe ? 'var(--color-lx-accent-red)' : m.ring,
          }}
        >
          {initials(name)}
        </span>
      </div>

      {/* Medal label */}
      <span
        className="relative z-10 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest"
        style={{
          background: isMe ? 'rgba(230,57,70,0.15)' : `${m.ring.replace('0.9)', '0.15)')}`,
          color:      isMe ? 'var(--color-lx-accent-red)' : m.ring,
          fontFamily: "'Sora', sans-serif",
        }}
      >
        {isMe ? 'YOU' : label}
      </span>

      {/* Name */}
      <p
        className="relative z-10 text-center leading-tight"
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize:   '1.05rem',
          fontWeight: 600,
          fontStyle:  'italic',
          color:      'var(--color-lx-text-primary)',
          maxWidth:   '100%',
          overflow:   'hidden',
          display:    '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {name}
      </p>

      {/* Points */}
      <p
        className="relative z-10 tabular-nums"
        style={{
          fontFamily: "'Sora', sans-serif",
          fontSize:   '0.95rem',
          fontWeight: 700,
          color:      isMe ? 'var(--color-lx-accent-red)' : m.ring,
        }}
      >
        {points.toLocaleString()}
        <span
          className="ml-1 text-xs font-normal"
          style={{ color: 'var(--color-lx-text-muted)' }}
        >
          pts
        </span>
      </p>
    </motion.div>
  );
}

// ─── Row (rank 4+) ────────────────────────────────────────────────────────────

interface RowProps {
  rank:    number;
  name:    string;
  points:  number;
  isMe:    boolean;
  delay:   number;
  rowRef?: React.Ref<HTMLDivElement>;
}

function Row({ rank, name, points, isMe, delay, rowRef }: RowProps) {
  return (
    <motion.div
      ref={rowRef}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut', delay }}
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background:  isMe ? 'rgba(230,57,70,0.07)' : 'var(--color-lx-surface)',
        borderLeft:  isMe ? '3px solid var(--color-lx-accent-red)' : '3px solid transparent',
        border:      isMe
          ? '1px solid rgba(230,57,70,0.25)'
          : '1px solid var(--color-lx-border)',
      }}
    >
      <span
        className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums"
        style={{
          color:      'var(--color-lx-text-muted)',
          fontFamily: "'Sora', sans-serif",
        }}
      >
        {rank}
      </span>

      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{
          background:  'var(--color-lx-elevated)',
          color:       isMe ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-secondary)',
          fontFamily:  "'Cormorant Garamond', serif",
          fontSize:    '0.95rem',
          fontStyle:   'italic',
        }}
      >
        {initials(name)}
      </div>

      <p
        className="min-w-0 flex-1 truncate text-sm font-medium"
        style={{
          color:      isMe ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-primary)',
          fontFamily: "'Sora', sans-serif",
        }}
      >
        {name}{isMe ? ' · you' : ''}
      </p>

      <span
        className="shrink-0 tabular-nums text-sm font-semibold"
        style={{
          color:      'var(--color-lx-accent-gold)',
          fontFamily: "'Sora', sans-serif",
        }}
      >
        {points.toLocaleString()}
      </span>
    </motion.div>
  );
}

// ─── Hall of Fame session group ───────────────────────────────────────────────

interface SessionGroupProps {
  label:   string;
  entries: HallEntry[];
}

const HALL_COLORS: Record<number, string> = {
  1: 'var(--color-lx-accent-gold)',
  2: '#C0C0C0',
  3: '#CD7F32',
};

function SessionGroup({ label, entries }: SessionGroupProps) {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-2 rounded-2xl p-4"
      style={{
        background: 'var(--color-lx-surface)',
        border:     '1px solid var(--color-lx-border)',
      }}
    >
      {/* Session label */}
      <div className="mb-1 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M7 1L8.8 5H13L9.6 7.8L10.9 12L7 9.4L3.1 12L4.4 7.8L1 5H5.2L7 1Z"
            fill="var(--color-lx-accent-gold)"
          />
        </svg>
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
        >
          {label}
        </span>
      </div>

      {entries.map((e, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{ background: 'var(--color-lx-elevated)' }}
        >
          <span
            className="shrink-0 text-sm font-bold"
            style={{
              color:      HALL_COLORS[e.rank] ?? 'var(--color-lx-text-muted)',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize:   '1.1rem',
              fontStyle:  'italic',
              minWidth:   18,
            }}
          >
            {e.rank === 1 ? 'I' : e.rank === 2 ? 'II' : 'III'}
          </span>
          <p
            className="min-w-0 flex-1 truncate font-medium"
            style={{ color: 'var(--color-lx-text-primary)', fontFamily: "'Sora', sans-serif", fontSize: '0.875rem' }}
          >
            {e.displayName}
          </p>
          <span
            className="shrink-0 tabular-nums text-sm font-semibold"
            style={{ color: HALL_COLORS[e.rank] ?? 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
          >
            {e.points.toLocaleString()} <span style={{ color: 'var(--color-lx-text-muted)', fontWeight: 400 }}>pts</span>
          </span>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'weekly' | 'alltime' | 'hall';

const TABS: { id: Tab; label: string }[] = [
  { id: 'weekly',  label: 'This Week'    },
  { id: 'alltime', label: 'All-Time'     },
  { id: 'hall',    label: 'Hall of Fame' },
];

// ─── Leaderboard list ─────────────────────────────────────────────────────────

interface ListProps {
  entries:    (LeaderEntry | AllTimeEntry)[];
  getPoints:  (e: LeaderEntry | AllTimeEntry) => number;
  myRowRef:   React.RefObject<HTMLDivElement | null>;
}

function LeaderList({ entries, getPoints, myRowRef }: ListProps) {
  const top3 = entries.filter(e => e.rank <= 3) as (LeaderEntry | AllTimeEntry)[];
  const rest = entries.filter(e => e.rank > 3);

  return (
    <div className="flex flex-col gap-4">
      {/* Podium */}
      {top3.length > 0 && (
        <div className="flex gap-2.5">
          {top3.map((e, i) => (
            <PodiumCard
              key={e.userId}
              rank={e.rank as 1 | 2 | 3}
              name={e.displayName}
              points={getPoints(e)}
              isMe={e.isMe}
              delay={i * 0.07}
              label={MEDAL[e.rank as 1 | 2 | 3]?.label ?? ''}
            />
          ))}
        </div>
      )}

      {/* Divider */}
      {rest.length > 0 && (
        <div
          className="flex items-center gap-3"
          aria-hidden
        >
          <div className="h-px flex-1" style={{ background: 'var(--color-lx-border)' }} />
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
          >
            Ranking
          </span>
          <div className="h-px flex-1" style={{ background: 'var(--color-lx-border)' }} />
        </div>
      )}

      {/* Rank 4+ */}
      <div className="flex flex-col gap-1.5">
        {rest.map((e, i) => (
          <Row
            key={e.userId}
            rank={e.rank}
            name={e.displayName}
            points={getPoints(e)}
            isMe={e.isMe}
            delay={Math.min(i * 0.03, 0.3)}
            rowRef={e.isMe ? myRowRef : undefined}
          />
        ))}
      </div>

      {entries.length === 0 && (
        <p
          className="py-12 text-center text-sm"
          style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
        >
          No rankings yet. Be the first!
        </p>
      )}
    </div>
  );
}

// ─── My rank banner ───────────────────────────────────────────────────────────

interface MyBannerProps {
  rank:   number | null;
  points: number;
  label:  string;
}

function MyBanner({ rank, points, label }: MyBannerProps) {
  if (!rank && points === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, type: 'spring' as const, stiffness: 320, damping: 26 }}
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{
        background: 'linear-gradient(135deg, rgba(230,57,70,0.12) 0%, rgba(230,57,70,0.04) 100%)',
        border:     '1px solid rgba(230,57,70,0.28)',
      }}
    >
      <div>
        <p
          className="text-xs"
          style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
        >
          Your rank · {label}
        </p>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize:   '1.5rem',
            fontWeight: 700,
            color:      'var(--color-lx-accent-red)',
            lineHeight: 1.1,
          }}
        >
          {rank ? `#${rank}` : '—'}
        </p>
      </div>
      <div className="text-right">
        <p
          className="text-xs"
          style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
        >
          Points
        </p>
        <p
          className="tabular-nums"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   '1rem',
            fontWeight: 700,
            color:      'var(--color-lx-accent-gold)',
          }}
        >
          {points.toLocaleString()}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LeaderboardScreen({ data }: { data: LeaderboardData }) {
  const [tab, setTab] = useState<Tab>('weekly');
  const myWeeklyRef  = useRef<HTMLDivElement | null>(null);
  const myAllTimeRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logged-in user into view
  useEffect(() => {
    const el = tab === 'weekly' ? myWeeklyRef.current : myAllTimeRef.current;
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350);
    }
  }, [tab]);

  // Group Hall of Fame by sessionLabel
  const hallGroups = useMemo(() => {
    const map = new Map<string, HallEntry[]>();
    for (const e of data.hall) {
      const group = map.get(e.sessionLabel) ?? [];
      group.push(e);
      map.set(e.sessionLabel, group);
    }
    return Array.from(map.entries()).map(([label, entries]) => ({ label, entries }));
  }, [data.hall]);

  const activeRank   = tab === 'weekly' ? data.myWeeklyRank   : tab === 'alltime' ? data.myAllTimeRank   : null;
  const activePoints = tab === 'weekly' ? data.myWeeklyPoints : tab === 'alltime' ? data.myAllTimePoints : 0;
  const activeLabel  = tab === 'weekly' ? 'This Week' : 'All-Time';

  return (
    <div className="relative flex flex-col pb-8 pt-10 md:pt-12 md:max-w-2xl md:mx-auto md:w-full">

      {/* Ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(230,57,70,0.10) 0%, transparent 70%)' }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative px-5 mb-6 md:px-8"
      >
        <p
          className="mb-1 text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
        >
          Rankings
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   'clamp(2.2rem, 8vw, 2.6rem)',
            fontWeight: 700,
            fontStyle:  'italic',
            lineHeight: 1.05,
            color:      'var(--color-lx-text-primary)',
          }}
        >
          Leaderboard
        </h1>
      </motion.div>

      {/* Tabs */}
      <div className="relative px-5 mb-4 md:px-8">
        <div
          className="flex gap-0 rounded-xl p-1 md:max-w-sm"
          style={{ background: 'var(--color-lx-elevated)' }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex-1 py-2.5 text-xs font-semibold transition-colors"
              style={{
                fontFamily: "'Sora', sans-serif",
                color: tab === t.id ? 'var(--color-lx-text-primary)' : 'var(--color-lx-text-muted)',
              }}
            >
              {tab === t.id && (
                <motion.div
                  layoutId="lx-tab-pill"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--color-lx-surface)' }}
                  transition={{ type: 'spring' as const, stiffness: 440, damping: 34 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* My rank banner (weekly/alltime only) */}
      {tab !== 'hall' && (
        <div className="px-5 mb-4 md:px-8 md:max-w-2xl md:w-full">
          <MyBanner
            rank={activeRank}
            points={activePoints}
            label={activeLabel}
          />
        </div>
      )}

      {/* Tab content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: tab === 'weekly' ? -16 : 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: tab === 'weekly' ? 16 : -16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="px-5 md:px-8 md:max-w-2xl md:w-full"
        >

          {tab === 'weekly' && (
            <LeaderList
              entries={data.weekly}
              getPoints={e => (e as LeaderEntry).weeklyPoints}
              myRowRef={myWeeklyRef}
            />
          )}

          {tab === 'alltime' && (
            <LeaderList
              entries={data.allTime}
              getPoints={e => (e as AllTimeEntry).totalPoints}
              myRowRef={myAllTimeRef}
            />
          )}

          {tab === 'hall' && (
            <div className="flex flex-col gap-4">
              {hallGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-12 text-center">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                    <path
                      d="M20 4L24.5 13.8H35L26.8 19.8L30 30L20 24.2L10 30L13.2 19.8L5 13.8H15.5L20 4Z"
                      fill="var(--color-lx-elevated)"
                      stroke="var(--color-lx-border)"
                      strokeWidth="1.5"
                    />
                  </svg>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
                  >
                    No champions yet.
                    <br />Complete a week to make history.
                  </p>
                </div>
              ) : (
                hallGroups.map(g => (
                  <SessionGroup key={g.label} label={g.label} entries={g.entries} />
                ))
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
