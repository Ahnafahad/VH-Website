'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { paginateBoard, type RankedBoardEntry } from '@/lib/leaderboard/boards';
import { BEIGE, BG, FONT_HEADING, R_LG, R_MD, SLATE, T_BASE, T_SM, T_XL, T_XS } from '@/components/admin/lms/lms-shared';

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
      <p style={{ fontSize: T_BASE, color: 'rgba(250,245,239,0.40)', padding: '24px 0', textAlign: 'center' }}>
        No rankings yet for your batch.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', fontSize: T_XS, color: 'rgba(250,245,239,0.40)', fontWeight: 600, textTransform: 'uppercase', padding: '0 12px 6px', letterSpacing: '0.04em' }}>
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
              borderRadius: R_MD,
              background: e.userId === currentUserId ? 'rgba(212,176,148,0.10)' : 'rgba(250,245,239,0.03)',
              border: e.userId === currentUserId ? '1px solid rgba(212,176,148,0.32)' : '1px solid rgba(212,176,148,0.16)',
            }}
          >
            <span style={{ width: 40, fontWeight: 700, fontSize: T_BASE, color: BG }}>{e.rank}</span>
            <span style={{ flex: 1, fontSize: T_BASE, color: BG, fontWeight: e.userId === currentUserId ? 600 : 500 }}>
              {e.displayName}{e.userId === currentUserId ? ' · you' : ''}
            </span>
            <span style={{ fontSize: T_BASE, fontWeight: 700, color: BG }}>
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
            marginTop: 12, fontSize: T_SM, fontWeight: 600, color: BEIGE,
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
    <main style={{ minHeight: '100vh', background: SLATE, padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link
          href="/dashboard"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T_BASE, color: 'rgba(250,245,239,0.64)', fontWeight: 500, marginBottom: 16, textDecoration: 'none' }}
        >
          <ArrowLeft size={14} aria-hidden /> Back to Dashboard
        </Link>
        <h1 style={{ fontFamily: FONT_HEADING, fontSize: T_XL, fontWeight: 700, color: BG, marginBottom: 4, letterSpacing: '-0.02em' }}>
          Leaderboard
        </h1>
        <p style={{ fontSize: T_SM, color: 'rgba(250,245,239,0.40)', marginBottom: 20 }}>
          {batchName ? `Batch ${batchName}` : 'No batch assigned — rankings unavailable'}
        </p>

        {batchName && (
          <>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(250,245,239,0.03)', border: '1px solid rgba(212,176,148,0.16)', borderRadius: R_LG, padding: 4, marginBottom: 16 }}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, fontSize: T_SM, fontWeight: 600, padding: '8px 4px', borderRadius: R_MD,
                    border: 'none', cursor: 'pointer',
                    background: tab === t.id ? 'rgba(212,176,148,0.16)' : 'transparent',
                    color: tab === t.id ? BEIGE : 'rgba(250,245,239,0.64)',
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
                <p style={{ fontSize: T_SM, color: 'rgba(250,245,239,0.40)', marginBottom: 10 }}>
                  {latestTest.testTitle ?? 'No published, results-visible test yet in your batch.'}
                </p>
                <BoardList entries={latestTest.entries} valueLabel="Score" currentUserId={currentUserId} />
              </>
            )}

            {tab === 'allTests' && (
              <>
                <p style={{ fontSize: T_XS, color: 'rgba(250,245,239,0.40)', marginBottom: 10 }}>
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
