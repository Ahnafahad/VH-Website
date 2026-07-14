'use client';

import React from 'react';
import StatCard  from './StatCard';
import ChartCard from './ChartCard';
import { fmtNum, fmtPct } from './formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LexicoreData {
  engagement: {
    dau: number;
    wau: number;
    mau: number;
    totalUsers: number;
    newUsersInRange: number;
    avgStreakDays: number;
    usersWithStreak7Plus: number;
    longestStreakUser: { name: string; days: number } | null;
    retention7d: number;
    churned14d: number;
  };
  learning: {
    avgWordsStudiedPerUser: number;
    avgWordsMasteredPerUser: number;
    totalWordsStudiedAllUsers: number;
    totalWordBank: number;
    avgMasteryScore: number;
    wordsLearnedToday: number;
    topUserByWordsMastered: { name: string; count: number } | null;
    phase1Count: number;
    phase2Count: number;
  };
  quizAndFlashcard: {
    avgQuizzesPerUser: number;
    totalQuizzesTaken: number;
    quizzesToday: number;
    avgQuizScore: number;
    quizPassRate: number;
    avgFlashcardSessionsPerUser: number;
    totalFlashcardSessions: number;
    flashcardCompletionRate: number;
  };
  leaderboard: {
    topUserByPoints: { name: string; points: number } | null;
    topUserByStreak: { name: string; days: number } | null;
    avgTotalPoints: number;
    totalBadgesEarned: number;
    mostEarnedBadge: { badgeId: string; count: number } | null;
    top10Leaderboard: { name: string; points: number; streakDays: number; wordsMastered: number }[];
  };
}

interface LexicorePanelProps {
  data: LexicoreData | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
      {children}
    </div>
  );
}

export default function LexicorePanel({ data }: LexicorePanelProps) {
  if (!data) return null;
  const { engagement, learning, quizAndFlashcard, leaderboard } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Engagement & retention */}
      <SectionHeading>Engagement &amp; Retention</SectionHeading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <StatCard label="Users Today (DAU)" value={fmtNum(engagement.dau)} accent />
        <StatCard label="Weekly Active (WAU)" value={fmtNum(engagement.wau)} />
        <StatCard label="Monthly Active (MAU)" value={fmtNum(engagement.mau)} />
        <StatCard label="Total Users" value={fmtNum(engagement.totalUsers)} />
        <StatCard label="New Users (Range)" value={fmtNum(engagement.newUsersInRange)} />
        <StatCard label="Avg Streak (Active)" value={`${engagement.avgStreakDays} days`} />
        <StatCard label="Users w/ 7+ Day Streak" value={fmtNum(engagement.usersWithStreak7Plus)} />
        <StatCard
          label="Longest Streak"
          value={engagement.longestStreakUser ? `${engagement.longestStreakUser.days} days` : '—'}
          sub={engagement.longestStreakUser?.name}
        />
        <StatCard label="7-Day Retention" value={fmtPct(engagement.retention7d)} />
        <StatCard label="Churned (14d+ Inactive)" value={fmtNum(engagement.churned14d)} />
      </div>

      {/* Learning progress */}
      <SectionHeading>Learning Progress</SectionHeading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <StatCard label="Avg Words Studied / User" value={learning.avgWordsStudiedPerUser} accent />
        <StatCard label="Avg Words Mastered / User" value={learning.avgWordsMasteredPerUser} />
        <StatCard label="Total Words Studied" value={fmtNum(learning.totalWordsStudiedAllUsers)} />
        <StatCard label="Word Bank Size" value={fmtNum(learning.totalWordBank)} />
        <StatCard label="Avg Mastery Score" value={learning.avgMasteryScore} />
        <StatCard label="Words Learned Today" value={fmtNum(learning.wordsLearnedToday)} />
        <StatCard
          label="Most Words Mastered"
          value={learning.topUserByWordsMastered ? fmtNum(learning.topUserByWordsMastered.count) : '—'}
          sub={learning.topUserByWordsMastered?.name}
        />
        <StatCard label="Phase 1 (Full Access)" value={fmtNum(learning.phase1Count)} />
        <StatCard label="Phase 2 (Limited)" value={fmtNum(learning.phase2Count)} />
      </div>

      {/* Quiz & flashcard performance */}
      <SectionHeading>Quiz &amp; Flashcard Performance</SectionHeading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <StatCard label="Avg Quizzes / User" value={quizAndFlashcard.avgQuizzesPerUser} accent />
        <StatCard label="Total Quizzes (Range)" value={fmtNum(quizAndFlashcard.totalQuizzesTaken)} />
        <StatCard label="Quizzes Today" value={fmtNum(quizAndFlashcard.quizzesToday)} />
        <StatCard label="Avg Quiz Score" value={fmtPct(quizAndFlashcard.avgQuizScore)} />
        <StatCard label="Quiz Pass Rate" value={fmtPct(quizAndFlashcard.quizPassRate)} />
        <StatCard label="Avg Flashcard Sessions / User" value={quizAndFlashcard.avgFlashcardSessionsPerUser} />
        <StatCard label="Total Flashcard Sessions" value={fmtNum(quizAndFlashcard.totalFlashcardSessions)} />
        <StatCard label="Flashcard Completion Rate" value={fmtPct(quizAndFlashcard.flashcardCompletionRate)} />
      </div>

      {/* Leaderboard & gamification */}
      <SectionHeading>Leaderboard &amp; Gamification</SectionHeading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <StatCard
          label="Top User (Points)"
          value={leaderboard.topUserByPoints ? fmtNum(leaderboard.topUserByPoints.points) : '—'}
          sub={leaderboard.topUserByPoints?.name}
          accent
        />
        <StatCard
          label="Top User (Streak)"
          value={leaderboard.topUserByStreak ? `${leaderboard.topUserByStreak.days} days` : '—'}
          sub={leaderboard.topUserByStreak?.name}
        />
        <StatCard label="Avg Total Points" value={fmtNum(leaderboard.avgTotalPoints)} />
        <StatCard label="Total Badges Earned" value={fmtNum(leaderboard.totalBadgesEarned)} />
        <StatCard
          label="Most Earned Badge"
          value={leaderboard.mostEarnedBadge ? fmtNum(leaderboard.mostEarnedBadge.count) : '—'}
          sub={leaderboard.mostEarnedBadge?.badgeId}
        />
      </div>

      <ChartCard
        title="Top 10 Leaderboard"
        sub="Ranked by total points"
        empty={leaderboard.top10Leaderboard.length === 0}
        emptyNote="No leaderboard data yet."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {leaderboard.top10Leaderboard.map((u, i) => (
            <div
              key={i}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                gap:            '10px',
                padding:        '8px 10px',
                background:     '#FAFAFA',
                borderRadius:   '6px',
                border:         '1px solid #E5E7EB',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#9CA3AF', width: '18px', flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '13px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.name}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0, fontSize: '12px', color: '#6B7280' }}>
                <span>{u.wordsMastered} mastered</span>
                <span>{u.streakDays}d streak</span>
                <span style={{ fontWeight: 700, color: '#D62B38' }}>{fmtNum(u.points)} pts</span>
              </span>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
