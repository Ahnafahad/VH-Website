import type { DifficultyDimensions } from '../content/schema';

export type Correctness = 'best' | 'defensible' | 'incorrect';
export type Confidence = 'guessing' | 'pretty-sure' | 'certain' | null;
export type EvidenceKind = 'anchor' | 'standard' | 'shift' | 'hold' | 'transfer' | 'retention';
export interface DecisionInput {
  id: string;
  sessionId: string;
  setId: string;
  scenarioId: string;
  beatId: string;
  presentedWords: string[];
  selectedWord: string;
  previousSelection: string | null;
  reactionTimeMs: number;
  hintLevel: 0 | 1 | 2 | 3;
  confidence: Confidence;
  reviewIntervalDays: number;
  occurredAt: number;
}
export interface DecisionRecord extends DecisionInput {
  edgeId: string;
  bestWord: string;
  semanticFit: number;
  correctness: Correctness;
  changedSelection: boolean;
  misconceptionTag: string | null;
  contentDifficulty: DifficultyDimensions;
  score: number;
  evidenceWeight: number;
  streak: number;
  kind: EvidenceKind;
}
export interface NodeMastery {
  word: string;
  evidence: number;
  observations: number;
  knownScore: number;
  status: 'Unknown' | 'Recognized' | 'Known' | 'Stable';
  lastVerified: number;
}
export interface EdgeMastery {
  edgeId: string;
  evidence: number;
  observations: number;
  bestCount: number;
  masteryScore: number;
  transferScore: number;
  retentionScore: number;
  speedScore: number;
  status: 'Unseen' | 'Exploring' | 'Distinguishing' | 'Reliable' | 'Fluent' | 'Mastered';
  kinds: EvidenceKind[];
  sessionIds: string[];
  decisionIds: string[];
  scenarioSessions: Record<string, string>;
  misconceptions: Record<string, number>;
  lastVerified: number;
}
export interface ReviewSchedule {
  edgeId: string;
  dueAt: number;
  intervalDays: number;
  successfulReviews: number;
  previousScenarioId: string;
}
export interface MasterySnapshot {
  nodes: Record<string, NodeMastery>;
  edges: Record<string, EdgeMastery>;
  reviews: Record<string, ReviewSchedule>;
}
export const emptyMastery = (): MasterySnapshot => ({ nodes: {}, edges: {}, reviews: {} });
