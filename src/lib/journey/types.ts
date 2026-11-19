import type { TakingGroup, TakingQuestion } from '@/lib/tests/types';
import type { JourneySection } from './pick';

export type JourneyStatus = 'ready' | 'running' | 'paused' | 'done';

export interface JourneyResult {
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  marks: number; // +1 / -0.25, the IBA rule
  bySection: Record<JourneySection, { correct: number; total: number }>;
}

export interface JourneyReviewRow {
  id: number;
  section: JourneySection;
  source: string;           // e.g. "BTH Mock 4 · Q12"
  selected: string | null;
  correct: string | null;
}

/** What GET /api/journey sends. questions carry no answer keys until the journey is done. */
export interface JourneyPayload {
  status: JourneyStatus;
  elapsedMs: number;
  limitMs: number;
  answers: Record<number, string>;
  questions: Array<TakingQuestion & { section: JourneySection }>;
  groups: TakingGroup[];
  result: JourneyResult | null;
  review: JourneyReviewRow[] | null; // only when done
}

export interface JourneyAdminRow {
  userId: number;
  name: string;
  status: JourneyStatus | 'none'; // 'none' = has access but has not built a set
  answered: number;
  total: number;
  elapsedMs: number;
  result: JourneyResult | null;
  startedAt: number | null;
  finishedAt: number | null;
  updatedAt: number;
}
