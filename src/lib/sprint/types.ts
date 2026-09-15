import type { LmsSubject } from '@/lib/db/schema';

export interface SprintOption {
  key: string;
  text: string;
}

/** One set as listed on /sprint — includes the viewer's own attempt, if any. */
export interface SprintSetListEntry {
  id: number;
  subject: LmsSubject;
  title: string;
  questionCount: number;
  attempt: { totalCorrect: number; totalQuestions: number; totalTimeMs: number } | null;
}

/** A question as sent to the taker — correctKey/explanation included up front, since
 * this is untimed self-checked practice, not a proctored exam: the client withholds
 * them in the UI until the student answers/skips that question. */
export interface SprintTakingQuestion {
  id: number;
  number: number;
  stem: string;
  options: SprintOption[];
  correctKey: string;
  explanation: string | null;
}

export interface SprintSubmitAnswer {
  questionId: number;
  selectedKey: string | null; // null = skipped
  timeSpentMs: number;
}

export interface SprintAttemptResult {
  totalCorrect: number;
  totalQuestions: number;
  totalTimeMs: number;
}

export interface SprintLeaderboardRow {
  rank: number;
  userId: number;
  name: string;
  totalCorrect: number;
  totalQuestions: number;
  totalTimeMs: number;
  isMe: boolean;
}

/** Per-question option-distribution breakdown for the instructor live view. */
export interface SprintLiveQuestionStat {
  id: number;
  number: number;
  stem: string;
  options: SprintOption[];
  correctKey: string;
  counts: Record<string, number>; // option key -> number of students who picked it
  skipped: number;
  correctCount: number;
  answeredCount: number; // responses so far, excluding skips
}

export interface SprintLiveStats {
  set: { id: number; subject: LmsSubject; title: string; status: string };
  questionCount: number;
  submittedCount: number;
  questions: SprintLiveQuestionStat[];
  leaderboard: SprintLeaderboardRow[]; // full roster, not capped to top 5
}
