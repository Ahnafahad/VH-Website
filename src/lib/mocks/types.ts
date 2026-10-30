/** Client-safe DTOs for the mocks module (no server imports). */

import type { SectionMissed } from './missed-chances';
import type { MockPhase } from './state';

export type { MockPhase, SectionMissed };

export interface MockWindowDTO {
  id: number;
  mode: string;
  opensAt: number;
  closesAt: number;
  durationMinutes: number | null;
  state: 'upcoming' | 'open' | 'closed';
}

export interface MockEssayDTO {
  seriesId: number;
  title: string;
  deadline: number;
  essayCount: number;
  submitted: number;
  maxMarks: number;
}

export interface MockListEntry {
  slug: string;
  bucket: string;
  title: string;
  examCode: string | null;
  totalQuestions: number;
  totalMarks: number;
  windows: MockWindowDTO[];
  attempt: { status: string; mode: string; submittedAt: number | null } | null;
  phase: MockPhase;
  essay: MockEssayDTO | null;
}

export interface MockSectionLine {
  title: string;
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  unattempted: number;
}

export interface MockMcqSummary {
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  unattempted: number;
  sections: MockSectionLine[];
}

export interface MockEssayLine {
  index: number;
  max: number;
  total: number | null;
  status: 'not_submitted' | 'submitted' | 'graded' | 'rejected';
}

export interface MockLeaderboardRow { rank: number; name: string; mcq: number; essay: number; total: number }

export type MockResult =
  | { phase: 'locked'; title: string }
  | { phase: 'provisional'; title: string; examCode: string | null; mcq: MockMcqSummary }
  | {
      phase: 'official';
      title: string;
      examCode: string | null;
      mcq: MockMcqSummary | null;
      essays: MockEssayLine[] | null;
      essayTotal: number | null;
      essayMax: number;
      combined: number | null;
      maxTotal: number;
      me: { rank: number; percentile: number; outOf: number } | null;
      leaderboard: MockLeaderboardRow[];
      missed: SectionMissed[] | null;
      solutionUrl: string | null;
      reviewHref: string;
    };

export interface MockAdminEntry {
  id: number;
  slug: string;
  bucket: string;
  title: string;
  status: string;
  examCode: string | null;
  mockBatch: string | null;
  essaySeriesId: number | null;
  hasSolution: boolean;
  resultsPublishedAt: number | null;
  totalQuestions: number;
  totalMarks: number;
  windows: MockWindowDTO[];
  cohortSize: number;
  attempts: { inProgress: number; submitted: number; banned: number; scanned: number };
  essay: { title: string; submitted: number; graded: number; rejected: number } | null;
}

export interface MockAdminOverview {
  mocks: MockAdminEntry[];
  /** tests that could be turned into a mock */
  candidates: Array<{ id: number; title: string; slug: string; status: string }>;
  essaySeries: Array<{ id: number; title: string }>;
}
