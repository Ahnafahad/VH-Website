'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useVocabFeedback } from '@/lib/vocab/use-vocab-feedback';
import type { MiniEntry, MiniLeaderboardResponse } from '@/lib/vocab/mini-leaderboard';

const SANS  = "'Sora', sans-serif";
const SERIF = "'Cormorant Garamond', serif";

type Tab = 'top' | 'lifetime';

const TABS: { id: Tab; label: string }[] = [
  { id: 'top',      label: 'Top Run' },
  { id: 'lifetime', label: 'Lifetime' },
];

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function Row({ entry, pinned = false }: { entry: MiniEntry; pinned?: boolean }) {
  const { rank, displayName, points, isMe } = entry;
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        background:  isMe ? 'rgba(230,57,70,0.07)' : 'var(--color-lx-surface)',
        borderLeft:  isMe ? '3px solid var(--color-lx-accent-red)' : '3px solid transparent',
        border:      isMe ? '1px solid rgba(230,57,70,0.25)' : '1px solid var(--color-lx-border)',
        marginTop:   pinned ? 8 : 0,
      }}
    >
      <span
        className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums"
        style={{ color: 'var(--color-lx-text-muted)', fontFamily: SANS }}
      >
        {rank}
      </span>

      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{
          background: 'var(--color-lx-elevated)',
          color:      isMe ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-secondary)',
          fontFamily: SERIF,
          fontStyle:  'italic',
        }}
      >
        {initials(displayName)}
      </div>

      <p
        className="min-w-0 flex-1 truncate text-xs font-medium"
        style={{ color: isMe ? 'var(--color-lx-accent-red)' : 'var(--color-lx-text-primary)', fontFamily: SANS }}
      >
        {displayName}{isMe ? ' · you' : ''}
      </p>

      <span
        className="shrink-0 tabular-nums text-xs font-semibold"
        style={{ color: 'var(--color-lx-accent-gold)', fontFamily: SANS }}
      >
        {points.toLocaleString()}
      </span>
    </div>
  );
}

function LoadingRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            height: 42, borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--color-lx-border)',
            opacity: 1 - i * 0.15,
            animation: 'lx-mini-pulse 1.6s ease-in-out infinite',
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes lx-mini-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

export default function MiniLeaderboard({
  game,
  data: dataProp,
}: {
  game: 'word-hunt' | 'word-charge';
  data?: MiniLeaderboardResponse;
}) {
  const fb = useVocabFeedback();
  const [data, setData] = useState<MiniLeaderboardResponse | null>(dataProp ?? null);
  const [loading, setLoading] = useState(!dataProp);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('top');

  useEffect(() => {
    if (dataProp) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetch(`/api/vocab/games/leaderboard?game=${game}`)
      .then(r => r.ok ? r.json() as Promise<MiniLeaderboardResponse> : Promise.reject(r))
      .then(res => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [game, dataProp]);

  const rows = tab === 'top' ? data?.top ?? [] : data?.lifetime ?? [];
  const myRow = tab === 'top' ? data?.myTop ?? null : data?.myLifetime ?? null;

  return (
    <div
      style={{
        background:   'var(--color-lx-surface)',
        border:       '1px solid var(--color-lx-border)',
        borderRadius: 16,
        padding:      '1rem',
      }}
    >
      <div
        role="tablist"
        aria-label="Leaderboard views"
        className="flex gap-0 rounded-xl p-1 mb-3"
        style={{ background: 'var(--color-lx-elevated)' }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`lx-mini-tabpanel-${t.id}`}
            id={`lx-mini-tab-${t.id}`}
            onClick={() => { if (tab !== t.id) { fb.play('tap'); setTab(t.id); } }}
            className="relative flex-1 text-xs font-semibold transition-colors"
            style={{
              fontFamily: SANS,
              color: tab === t.id ? 'var(--color-lx-text-primary)' : 'var(--color-lx-text-muted)',
              minHeight: 36,
              paddingTop: '0.4rem',
              paddingBottom: '0.4rem',
            }}
          >
            {tab === t.id && (
              <motion.div
                layoutId="lx-mini-tab-pill"
                className="absolute inset-0 rounded-lg"
                style={{ background: 'var(--color-lx-surface)' }}
                transition={{ type: 'spring' as const, stiffness: 440, damping: 34 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      {loading && <LoadingRows />}

      {!loading && failed && (
        <p className="text-center text-xs" style={{ color: 'var(--color-lx-text-muted)', fontFamily: SANS }}>
          Leaderboard unavailable right now.
        </p>
      )}

      {!loading && !failed && rows.length === 0 && (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--color-lx-text-muted)', fontFamily: SANS }}>
          No scores yet. Be the first!
        </p>
      )}

      {!loading && !failed && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(entry => <Row key={entry.userId} entry={entry} />)}
          {myRow && (
            <div style={{ borderTop: '1px dashed var(--color-lx-border)' }}>
              <Row entry={myRow} pinned />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
