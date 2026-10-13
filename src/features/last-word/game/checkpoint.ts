import type { Confidence, DecisionInput, DecisionRecord } from '../core/types';
import type { SessionSubmission } from '../persistence/types';
import type { GameContext } from './machine';
import type { Goal, Mode, Step } from './session';

/**
 * An in-progress session, saved on this device after every choice so an interruption (a call, a tab kill,
 * the browser back button, a refresh) never loses it. Finished rounds are also saved to the account as they complete.
 */
export type CheckpointPhase = 'reading' | 'beatFeedback' | 'feedback' | 'card';
export interface Checkpoint {
  version: 1;
  /** The signed-in user's email, so a shared device never resumes someone else's session. */
  owner: string;
  savedAt: number;
  phase: CheckpointPhase;
  mode: Mode;
  sessionId: string;
  startedAt: number;
  goals: Goal[];
  steps: Step[];
  beat: number;
  hintLevel: 0 | 1 | 2 | 3;
  confidence: Confidence;
  records: DecisionRecord[];
}

export const CHECKPOINT_KEY = 'last-word:checkpoint:v1';
/** Beyond this the session is saved as it stands instead of resumed (a session may not span more than a day). */
export const MAX_RESUME_MS = 2 * 3_600_000;

/** Machine states that are safe to resume into. `paused` resumes as `reading`; transient states are never saved. */
export function checkpointPhase(state: string): CheckpointPhase | null {
  if (state === 'paused') return 'reading';
  return state === 'reading' || state === 'beatFeedback' || state === 'feedback' || state === 'card' ? state : null;
}

export function makeCheckpoint(context: GameContext, phase: CheckpointPhase, owner: string, now: number): Checkpoint {
  const { mode, sessionId, startedAt, goals, steps, beat, hintLevel, confidence, records } = context;
  return { version: 1, owner, savedAt: now, phase, mode, sessionId, startedAt, goals, steps, beat, hintLevel, confidence, records };
}

/** What the server accepts: the player's inputs only, never scores. */
export const decisionInputs = (records: DecisionRecord[]): DecisionInput[] =>
  records.map(({ id, sessionId, setId, scenarioId, beatId, presentedWords, selectedWord, previousSelection, reactionTimeMs, hintLevel, confidence, reviewIntervalDays, occurredAt }) =>
    ({ id, sessionId, setId, scenarioId, beatId, presentedWords, selectedWord, previousSelection, reactionTimeMs, hintLevel, confidence, reviewIntervalDays, occurredAt }));

export const submissionFor = (sessionId: string, startedAt: number, completedAt: number, records: DecisionRecord[]): SessionSubmission =>
  ({ id: sessionId, startedAt, completedAt, decisions: decisionInputs(records) });

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readCheckpoint(storage: Store, owner: string): Checkpoint | null {
  try {
    const raw = storage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Checkpoint>;
    const valid = value.version === 1 && value.owner === owner && typeof value.sessionId === 'string' && Array.isArray(value.steps)
      && Array.isArray(value.goals) && Array.isArray(value.records) && typeof value.startedAt === 'number' && typeof value.savedAt === 'number';
    return valid ? (value as Checkpoint) : null;
  } catch {
    return null;
  }
}
export function writeCheckpoint(storage: Store, checkpoint: Checkpoint): void {
  try { storage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint)); } catch { /* storage full or blocked: playing on is still fine */ }
}
export function clearCheckpoint(storage: Store): void {
  try { storage.removeItem(CHECKPOINT_KEY); } catch { /* ignore */ }
}
