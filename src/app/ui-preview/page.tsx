'use client';

/**
 * UI Preview — LexiCore rebuilt components
 * No auth required. Visit: http://localhost:6960/ui-preview
 */

import { useState } from 'react';
import StepWelcome      from '@/app/vocab/onboarding/steps/StepWelcome';
import StepTutorial     from '@/app/vocab/onboarding/steps/StepTutorial';
import ProgressRing     from '@/components/vocab/ProgressRing';
import StudyScreen      from '@/app/vocab/(shell)/study/StudyScreen';
import LeaderboardScreen from '@/app/vocab/(shell)/leaderboard/LeaderboardScreen';
import type { LeaderboardData } from '@/lib/vocab/leaderboard-data';
import type { UnitWithThemes }  from '@/lib/vocab/study-data';

/* ── Mock data ──────────────────────────────────────────────────────────────── */

const mockLeaderboard: LeaderboardData = {
  myWeeklyRank:    4,
  myWeeklyPoints:  1_240,
  myAllTimeRank:   12,
  myAllTimePoints: 8_450,
  weekly: [
    { rank: 1, userId: 1, displayName: 'Tasnim Ahmed',   weeklyPoints: 3_840, isMe: false },
    { rank: 2, userId: 2, displayName: 'Rafid Hassan',   weeklyPoints: 2_910, isMe: false },
    { rank: 3, userId: 3, displayName: 'Nadia Islam',    weeklyPoints: 2_250, isMe: false },
    { rank: 4, userId: 4, displayName: 'You (preview)',  weeklyPoints: 1_240, isMe: true  },
    { rank: 5, userId: 5, displayName: 'Mehedi Hasan',   weeklyPoints:   980, isMe: false },
    { rank: 6, userId: 6, displayName: 'Lamia Khanam',   weeklyPoints:   720, isMe: false },
  ],
  allTime: [
    { rank:  1, userId: 1, displayName: 'Tasnim Ahmed',  totalPoints: 48_200, isMe: false },
    { rank:  2, userId: 3, displayName: 'Nadia Islam',   totalPoints: 41_750, isMe: false },
    { rank:  3, userId: 2, displayName: 'Rafid Hassan',  totalPoints: 38_100, isMe: false },
    { rank:  4, userId: 5, displayName: 'Mehedi Hasan',  totalPoints: 31_490, isMe: false },
    { rank:  5, userId: 6, displayName: 'Lamia Khanam',  totalPoints: 27_830, isMe: false },
    { rank: 12, userId: 4, displayName: 'You (preview)', totalPoints:  8_450, isMe: true  },
  ],
  hall: [
    { rank: 1, displayName: 'Sadia Rahman', points: 12_400, sessionLabel: 'Week of Mar 24' },
    { rank: 2, displayName: 'Arif Hossain', points:  9_800, sessionLabel: 'Week of Mar 24' },
    { rank: 3, displayName: 'Lamia Khan',   points:  8_100, sessionLabel: 'Week of Mar 17' },
    { rank: 4, displayName: 'Omar Faruk',   points:  6_500, sessionLabel: 'Week of Mar 10' },
  ],
};

const mockUnits: UnitWithThemes[] = [
  {
    id: 1, name: 'Unit 1 — Foundation', order: 1, completePct: 75,
    themes: [
      { id: 1, name: 'Adjectives I',      order: 1, wordCount: 30, status: 'complete',       locked: false },
      { id: 2, name: 'Adjectives II',     order: 2, wordCount: 28, status: 'quiz_pending',   locked: false },
      { id: 3, name: 'Nouns & Verbs',     order: 3, wordCount: 32, status: 'flashcards_done',locked: false },
      { id: 4, name: 'Abstract Concepts', order: 4, wordCount: 25, status: 'not_started',    locked: false },
    ],
  },
  {
    id: 2, name: 'Unit 2 — Intermediate', order: 2, completePct: 25,
    themes: [
      { id: 5, name: 'Power & Authority', order: 1, wordCount: 35, status: 'complete',    locked: false },
      { id: 6, name: 'Emotions',          order: 2, wordCount: 30, status: 'not_started', locked: false },
      { id: 7, name: 'Academic Terms',    order: 3, wordCount: 40, status: 'not_started', locked: true  },
    ],
  },
];

/* ── Section wrapper ────────────────────────────────────────────────────────── */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[390px] items-center gap-3">
        <div className="h-px flex-1" style={{ background: 'var(--color-lx-border)' }} />
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
        >
          {label}
        </span>
        <div className="h-px flex-1" style={{ background: 'var(--color-lx-border)' }} />
      </div>

      {/* Phone frame */}
      <div
        className="w-full max-w-[390px] overflow-hidden rounded-[2rem]"
        style={{
          background: 'var(--color-lx-base)',
          border:     '1px solid var(--color-lx-border)',
          boxShadow:  '0 32px 80px rgba(0,0,0,0.6)',
          minHeight:  220,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function UIPreviewPage() {
  const [tutorialDone, setTutorialDone] = useState(false);

  return (
    <div
      className="min-h-screen py-16"
      style={{ background: '#070709', fontFamily: "'Sora', sans-serif" }}
    >
      {/* Page header */}
      <div className="mb-14 flex flex-col items-center gap-2 text-center">
        <span
          className="text-xs font-semibold uppercase tracking-[0.3em]"
          style={{ color: 'var(--color-lx-text-muted)' }}
        >
          Component Preview
        </span>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize:   '2.8rem',
            fontWeight: 700,
            fontStyle:  'italic',
            color:      'var(--color-lx-text-primary)',
          }}
        >
          LexiCore UI
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-lx-text-secondary)' }}>
          Rebuilt components — no login required
        </p>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-20 px-4">

        {/* 1 — StepWelcome */}
        <Section label="Onboarding — Welcome">
          <div className="p-8">
            <StepWelcome userName="Ahnaf Hossain" onNext={() => {}} />
          </div>
        </Section>

        {/* 2 — StepTutorial */}
        <Section label="Onboarding — Tutorial">
          <div className="p-6">
            <StepTutorial
              saving={false}
              onFinish={() => setTutorialDone(d => !d)}
            />
            {tutorialDone && (
              <p className="mt-3 text-center text-xs" style={{ color: 'var(--color-lx-success)' }}>
                onFinish() fired — would navigate to app
              </p>
            )}
          </div>
        </Section>

        {/* 3 — ProgressRing */}
        <Section label="Progress Ring">
          <div className="flex flex-wrap items-center justify-center gap-10 p-10">
            <ProgressRing percentage={78} size={120} strokeWidth={10} label="mastery" />
            <ProgressRing percentage={42} size={90}  strokeWidth={8}  label="progress" />
            <ProgressRing percentage={100} size={72} strokeWidth={7}  />
            <ProgressRing percentage={15} size={72}  strokeWidth={7}  />
          </div>
        </Section>

        {/* 4 — StudyScreen */}
        <Section label="Study Screen">
          <StudyScreen
            data={{
              units:         mockUnits,
              phase:         1,
              resumeThemeId: 3,
              totalPoints:   1240,
              masteredWords: 42,
              totalWords:    200,
            }}
            letterIndex={[]}
          />
        </Section>

        {/* 5 — LeaderboardScreen */}
        <Section label="Leaderboard Screen">
          <LeaderboardScreen data={mockLeaderboard} />
        </Section>

      </div>

      {/* Footer */}
      <p
        className="mt-20 text-center text-xs"
        style={{ color: 'var(--color-lx-text-muted)', fontFamily: "'Sora', sans-serif" }}
      >
        /ui-preview · delete this route before production
      </p>
    </div>
  );
}
