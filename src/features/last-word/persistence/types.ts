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
}

export interface LastWordPersistence {
  load(): Promise<LearningSnapshot>;
  saveSession(submission: SessionSubmission): Promise<LearningSnapshot>;
}

export const emptyLearningSnapshot = (): LearningSnapshot => ({ nodes: {}, edges: {}, reviews: {}, sessions: [] });

export class PersistenceValidationError extends Error {}
