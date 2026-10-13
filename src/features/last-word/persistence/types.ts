import type { DecisionInput, MasterySnapshot } from '../core/types';

export interface SessionSubmission {
  id: string;
  startedAt: number;
  completedAt: number;
  decisions: DecisionInput[];
}

export interface SessionSummary {
  id: string;
  startedAt: number;
  completedAt: number;
  score: number;
  decisionCount: number;
}

export interface LearningSnapshot extends MasterySnapshot {
  sessions: SessionSummary[];
  /** The tutorial has been played on this account (server-derived, so it follows the user across devices). */
  tutorialDone?: boolean;
  /** Lexicore points earned from Last Word today (Dhaka day), after the daily cap. */
  pointsToday?: number;
  dailyCap?: number;
  /** What the most recent save added to the user's Lexicore total. */
  lastSave?: { awarded: number; capped: boolean };
}

/** Daily Last Word points cap: matches the top Word Hunt daily result (500 + 20 sentence points), so no game out-earns the daily challenge. */
export const DAILY_POINTS_CAP = 520;
/** How far behind the user's latest stored decision a new one may be dated (two devices briefly interleaved). */
export const CLOCK_TOLERANCE_MS = 10 * 60_000;

export interface LastWordPersistence {
  load(): Promise<LearningSnapshot>;
  saveSession(submission: SessionSubmission): Promise<LearningSnapshot>;
}

export const emptyLearningSnapshot = (): LearningSnapshot => ({ nodes: {}, edges: {}, reviews: {}, sessions: [] });

export class PersistenceValidationError extends Error {}
