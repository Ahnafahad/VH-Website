'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import type { RankedBoardEntry } from '@/lib/leaderboard/boards';

interface LeaderboardResponse {
  batch: { name: string; product: string } | null;
  boards: {
    latestTest: { entries: RankedBoardEntry[]; testTitle: string | null };
  };
}

interface Props {
  userId: number;
  /** Overrides the internal fetch — used by /ui-preview for a no-auth render check. */
  data?: LeaderboardResponse;
}

function Row({ entry, isMe }: { entry: RankedBoardEntry; isMe: boolean }) {
  return (
    <div
      className="flex items-center gap-3 py-2"
      style={{
        borderBottom: '1px solid rgba(212,176,148,0.16)',
        color: isMe ? '#D4B094' : undefined,
      }}
    >
      <span
        className="w-6 flex-shrink-0 text-sm text-center"
        style={{
          fontFamily: 'var(--font-math-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: isMe ? '#D4B094' : 'rgba(250,245,239,0.40)',
        }}
      >
        {entry.rank}
      </span>
      <span
        className="flex-1 min-w-0 truncate text-sm"
        style={{ color: isMe ? '#D4B094' : '#FAF5EF', fontWeight: isMe ? 600 : 400 }}
      >
        {entry.displayName}{isMe ? ' · you' : ''}
      </span>
      <span
        className="text-sm flex-shrink-0"
        style={{
          fontFamily: 'var(--font-math-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: isMe ? '#D4B094' : 'rgba(250,245,239,0.64)',
        }}
      >
        {entry.value.toLocaleString()}
      </span>
    </div>
  );
}

export default function DashboardLeaderboardWidget({ userId, data: dataProp }: Props) {
  const [data, setData] = useState<LeaderboardResponse | null>(dataProp ?? null);
  const [loading, setLoading] = useState(!dataProp);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (dataProp) return;
    let cancelled = false;
    fetch('/api/leaderboard')
      .then(r => (r.ok ? (r.json() as Promise<LeaderboardResponse>) : Promise.reject(r)))
      .then(res => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dataProp]);

  if (loading || failed) return null;

  const entries = data?.boards.latestTest.entries ?? [];
  const testTitle = data?.boards.latestTest.testTitle ?? null;
  if (entries.length === 0) return null;

  const top5 = entries.slice(0, 5);
  const myEntry = entries.find(e => e.userId === userId) ?? null;
  const myEntryOutsideTop5 = myEntry && !top5.some(e => e.userId === userId) ? myEntry : null;

  return (
    <div>
      {/* Section marker */}
      <div className="flex items-center gap-3 mb-5">
        <span className="font-heading italic text-sm flex-shrink-0" style={{ color: '#D4B094' }}>
          leaderboard
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: '#D4B094' }} strokeWidth={1.5} />
        <p className="text-sm truncate" style={{ color: 'rgba(250,245,239,0.64)' }}>
          {testTitle ?? 'Latest test'}
        </p>
      </div>

      <div className="flex flex-col">
        {top5.map(entry => (
          <Row key={entry.userId} entry={entry} isMe={entry.userId === userId} />
        ))}
        {myEntryOutsideTop5 && (
          <div style={{ marginTop: 4, borderTop: '1px dashed rgba(212,176,148,0.24)' }}>
            <Row entry={myEntryOutsideTop5} isMe />
          </div>
        )}
      </div>

      <Link
        href="/dashboard/leaderboard"
        className="text-sm w-fit inline-block mt-4 transition-all"
        style={{ color: '#D4B094' }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
      >
        View full leaderboard →
      </Link>
    </div>
  );
}
