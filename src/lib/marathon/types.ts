/**
 * Shared client-facing types for the Math Marathon module.
 * Mirrors src/lib/tests/types.ts — timestamps are epoch ms so they serialize
 * cleanly. Import these in UI components; do NOT import Drizzle row types
 * into client code.
 */

import type { TestOption } from '@/lib/db/schema';

export type DayState = 'locked' | 'unlocked';
export type AttemptStatus = 'in_progress' | 'submitted';

export interface MarathonTag {
  code: string;   // e.g. '1.1.2'
  label: string;  // e.g. 'Lecture 1.1 — Consecutive Integers'
}

// ─── GET /api/marathon ───────────────────────────────────────────────────────

export interface MarathonDayListEntry {
  id: number;
  dayNumber: number;
  totalQuestions: number;
  state: DayState;
  unlocksAt: number;   // epoch ms — meaningful even when already unlocked
  attempt: { id: number; status: AttemptStatus; correct: number | null; submittedAt: number | null } | null;
}
export interface MarathonChapterListEntry {
  id: number;
  slug: string;
  title: string;
  totalDays: number;
  questionsPerDay: number;
  days: MarathonDayListEntry[];
}

// ─── GET /api/marathon/[slug]/[day]/attempt ──────────────────────────────────

export interface MarathonTakingQuestion {
  id: number;
  number: number;
  stem: string;
  options: TestOption[];
  imageUrl: string | null;
}
export interface MarathonAttemptPayload {
  chapter: { slug: string; title: string };
  day: { id: number; dayNumber: number; totalQuestions: number };
  attempt: {
    id: number;
    startedAt: number;
    pauseCount: number;
    pausedAt: number | null;
    totalPausedMs: number;
  };
  questions: MarathonTakingQuestion[];
  answers: Array<{ questionId: number; selectedKey: string | null; visited: boolean; timeSpentMs: number }>;
}

// ─── POST responses ───────────────────────────────────────────────────────────

export interface MarathonStartResponse { attemptId: number; resumed: boolean; startedAt: number }
export interface MarathonPauseResponse { pausedAt: number | null; pauseCount: number }
export interface MarathonSubmitResponse { attemptId: number; totalCorrect: number; totalWrong: number; totalSkipped: number }

// ─── GET /api/marathon/[slug]/[day]/results ──────────────────────────────────

export interface MarathonQuestionResult {
  id: number;
  number: number;
  stem: string;
  options: TestOption[];
  imageUrl: string | null;
  correctKey: string;
  solution: string | null;     // null = not authored yet ("coming soon")
  primaryTag: MarathonTag | null;
  secondaryTag: MarathonTag | null;
  selectedKey: string | null;
  isCorrect: boolean | null;   // null = skipped
  timeSpentMs: number;
  isSlow: boolean;             // flagged vs class median
  classStats: { correctCount: number; wrongCount: number; skippedCount: number; medianTimeMs: number };
}

export interface SubtopicStat {
  code: string;
  label: string;
  correct: number;
  total: number;
  accuracy: number; // 0-100
}

export interface MarathonResultsPayload {
  chapter: { slug: string; title: string };
  day: { dayNumber: number; totalQuestions: number };
  attempt: {
    id: number;
    totalCorrect: number;
    totalWrong: number;
    totalSkipped: number;
    totalActiveMs: number;
    isOverallSlow: boolean;
    submittedAt: number;
  };
  questions: MarathonQuestionResult[];
  /** Per-subtopic accuracy across every submitted day the student has done in this chapter. */
  subtopicWeakness: SubtopicStat[];
}
