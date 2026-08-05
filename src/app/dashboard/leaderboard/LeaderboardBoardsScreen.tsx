'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { paginateBoard, type RankedBoardEntry } from '@/lib/leaderboard/boards';

type BoardId = 'lexicore' | 'latestTest' | 'allTests';

interface Props {
  batchName: string | null;
  currentUserId: number;
  lexicore: RankedBoardEntry[];
  latestTest: { entries: RankedBoardEntry[]; testTitle: string | null };
  allTests: RankedBoardEntry[];
}

const TABS: { id: BoardId; label: string }[] = [
  { id: 'lexicore', label: 'LexiCore' },
  { id: 'latestTest', label: 'Latest Test' },
  { id: 'allTests', label: 'All Tests' },
];

function BoardList({
  entries, valueLabel, currentUserId, unit,
}: { entries: RankedBoardEntry[]; valueLabel: string; currentUserId: number; unit?: string }) {
  const [showAll, setShowAll] = useState(false);
  const { top, rest, total } = paginateBoard(entries, 20);
  const visible = showAll ? [...top, ...rest] : top;

  if (total === 0) {
    return (
      <p style={{ fontSize: 13, color: '#9CA3AF', padding: '24px 0', textAlign: 'center' }}>
        No rankings yet for your batch.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', padding: '0 12px 6px', letterSpacing: '0.04em' }}>
        <span style={{ width: 40 }}>#</span>
        <span style={{ flex: 1 }}>Name</span>
        <span>{valueLabel}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visible.map(e => (
          <div
            key={e.userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 8,
              background: e.userId === currentUserId ? 'rgba(230,57,70,0.08)' : '#FFFFFF',
              border: e.userId === currentUserId ? '1px solid rgba(230,57,70,0.25)' : '1px solid #F0F0F0',
            }}
          >
            <span style={{ width: 40, fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{e.rank}</span>
            <span style={{ flex: 1, fontSize: 13, color: '#0F172A', fontWeight: e.userId === currentUserId ? 600 : 500 }}>
              {e.displayName}{e.userId === currentUserId ? ' · you' : ''}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              {e.value.toLocaleString()}{unit ?? ''}
            </span>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(s => !s)}
          style={{
            marginTop: 12, fontSize: 12, fontWeight: 600, color: '#E63946',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          {showAll ? 'Show top 20 only' : `Show all (${total})`}
        </button>
      )}
    </div>
  );
}

export default function LeaderboardBoardsScreen({ batchName, currentUserId, lexicore, latestTest, allTests }: Props) {
  const [tab, setTab] = useState<BoardId>('lexicore');

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAFA', padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link
          href="/dashboard"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', fontWeight: 500, marginBottom: 16, textDecoration: 'none' }}
        >
          <ArrowLeft size={14} aria-hidden /> Back to Dashboard
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 4, letterSpacing: '-0.02em' }}>
          Leaderboard
        </h1>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
          {batchName ? `Batch ${batchName}` : 'No batch assigned — rankings unavailable'}
        </p>

        {batchName && (
          <>
            <div style={{ display: 'flex', gap: 4, background: '#F0F0F0', borderRadius: 10, padding: 4, marginBottom: 16 }}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, fontSize: 12, fontWeight: 600, padding: '8px 4px', borderRadius: 8,
                    border: 'none', cursor: 'pointer',
                    background: tab === t.id ? '#FFFFFF' : 'transparent',
                    color: tab === t.id ? '#0F172A' : '#6B7280',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'lexicore' && (
              <BoardList entries={lexicore} valueLabel="Points" currentUserId={currentUserId} />
            )}

            {tab === 'latestTest' && (
              <>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 10 }}>
                  {latestTest.testTitle ?? 'No published, results-visible test yet in your batch.'}
                </p>
                <BoardList entries={latestTest.entries} valueLabel="Score" currentUserId={currentUserId} />
              </>
            )}

            {tab === 'allTests' && (
              <>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
                  Average percentage across all your non-diagnostic tests.
                </p>
                <BoardList entries={allTests} valueLabel="Avg %" currentUserId={currentUserId} unit="%" />
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
