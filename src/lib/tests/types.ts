/**
 * Shared client-facing types for the online tests module.
 * These mirror the JSON returned by /api/tests/* routes (all timestamps are
 * epoch milliseconds so they serialize cleanly). Import these in UI components;
 * do NOT import Drizzle row types into client code.
 */

export type TestBucket = 'iba' | 'du_fbs';
export type TestMode = 'online' | 'offline';
export type WindowState = 'upcoming' | 'open' | 'closed';
export type AttemptStatus = 'in_progress' | 'submitted' | 'banned';
export type ViolationAction = 'warning' | 'reset' | 'ban';
export type GroupKind = 'instruction' | 'passage' | 'scenario' | 'shared_options';

export interface Option {
  key: string;   // 'A'..'E'
  text: string;  // may contain KaTeX ($...$) + markdown
}

// ─── GET /api/tests ─────────────────────────────────────────────────────────
export interface TestListWindow {
  id: number;
  mode: TestMode;
  opensAt: number;
  closesAt: number;
  durationMinutes: number | null;
  state: WindowState;
}
export interface TestListEntry {
  id: number;
  slug: string;
  title: string;
  bucket: TestBucket;
  description: string | null;
  syllabus: string | null;
  totalQuestions: number;
  totalMarks: number;
  windows: TestListWindow[];
  attempt: { id: number; mode: TestMode; status: AttemptStatus; submittedAt: number | null } | null;
  resultsAvailable: boolean;
}

// ─── GET /api/tests/[slug]/attempt ───────────────────────────────────────────
export interface TakingQuestion {
  id: number;
  number: number;
  order: number;
  groupId: number | null;
  type: string;
  stem: string;
  options: Option[];
  imageUrl: string | null;
  explanation: string | null;
}
export interface TakingGroup {
  id: number;
  order: number;
  kind: GroupKind;
  title: string | null;
  content: string;
  sharedOptions: Option[] | null;
}
export interface TakingSection {
  id: number;
  order: number;
  title: string;
  totalQuestions: number;
  marksPerCorrect: number;
  penaltyPerWrong: number;
  groups: TakingGroup[];
  questions: TakingQuestion[];
}
export interface AttemptPayload {
  test: { slug: string; title: string; bucket: TestBucket; totalQuestions: number; totalMarks: number };
  attempt: {
    id: number;
    mode: TestMode;
    startedAt: number;
    deadline: number;
    tabLeaveCount: number;
    resetCount: number;
  };
  sections: TakingSection[];
  answers: Array<{ questionId: number; selectedKey: string | null; flagged: boolean }>;
}

// ─── GET /api/tests/[slug]/results ───────────────────────────────────────────
export interface SectionScore {
  sectionId: number;
  title: string;
  correct: number;
  wrong: number;
  unattempted: number;
  totalQuestions: number;
  score: number;
  maxScore: number;
  percentage: number;
  thresholdPercent: number | null;
  passed: boolean | null;
}
export interface ResultsPayload {
  test: { slug: string; title: string; bucket: TestBucket; totalMarks: number; totalQuestions: number };
  me: {
    attemptId: number;
    mode: TestMode;
    totalScore: number;
    percentage: number;
    totalCorrect: number;
    totalWrong: number;
    totalUnattempted: number;
    rank: number;
    percentile: number;
    sections: SectionScore[];
    responses: Record<number, { selected: string | null; correct: string | null; isCorrect: boolean | null }>;
  } | null;
  classStats: {
    totalStudents: number;
    averageScore: number;
    top5Average: number;
    highest: number;
    lowest: number;
  };
  questionAnalytics: Record<number, { correctCount: number; wrongCount: number; skippedCount: number }>;
  sections: TakingSection[];
  answerKey: Record<number, string | null>;
}

// ─── POST responses ──────────────────────────────────────────────────────────
export interface StartResponse { attemptId: number; resumed: boolean; deadline: number }
export interface ViolationResponse { action: ViolationAction; tabLeaveCount: number }

export const BUCKET_LABELS: Record<TestBucket, string> = {
  iba: 'IBA',
  du_fbs: 'DU FBS',
};
