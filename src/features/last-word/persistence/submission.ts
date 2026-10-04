import { z } from 'zod';
import { getFixtureSet } from '../content/fixtures';
import { evaluateDecision, updateMastery } from '../core/learning';
import type { DecisionRecord } from '../core/types';
import { PersistenceValidationError, type LearningSnapshot, type SessionSubmission } from './types';

const id = z.string().min(1).max(120);
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const sessionSubmissionSchema = z.strictObject({
  id,
  startedAt: timestamp,
  completedAt: timestamp,
  decisions: z.array(z.object({
    id,
    sessionId: id,
    setId: id,
    scenarioId: id,
    beatId: id,
    presentedWords: z.array(id).min(2).max(5),
    selectedWord: id,
    previousSelection: id.nullable(),
    reactionTimeMs: z.number().int().min(0).max(86_400_000),
    hintLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    confidence: z.enum(['guessing', 'pretty-sure', 'certain']).nullable(),
    reviewIntervalDays: z.number().min(0).max(100_000),
    occurredAt: timestamp,
  })).min(1).max(100),
}).superRefine((value, ctx) => {
  if (value.startedAt > value.completedAt || value.completedAt - value.startedAt > 86_400_000) {
    ctx.addIssue({ code: 'custom', message: 'Session times must be ordered and within one day.' });
  }
  const ids = new Set<string>();
  const beats = new Set<string>();
  let previousTime = value.startedAt;
  for (const decision of value.decisions) {
    const beatKey = `${decision.setId}/${decision.scenarioId}/${decision.beatId}`;
    if (decision.sessionId !== value.id || ids.has(decision.id) || beats.has(beatKey)) {
      ctx.addIssue({ code: 'custom', message: 'Session and decision identities must be consistent and unique.' });
    }
    if (decision.occurredAt < previousTime || decision.occurredAt > value.completedAt) {
      ctx.addIssue({ code: 'custom', message: 'Decisions must be ordered within session timestamps.' });
    }
    previousTime = decision.occurredAt;
    ids.add(decision.id);
    beats.add(beatKey);
  }
});

export function parseSubmission(value: unknown): SessionSubmission {
  const parsed = sessionSubmissionSchema.safeParse(value);
  if (!parsed.success) throw new PersistenceValidationError(parsed.error.issues.map(issue => issue.message).join(' '));
  return parsed.data;
}

/** This boundary never accepts client-derived scores, fits, mastery, or review intervals. */
export function applySubmission(snapshot: LearningSnapshot, value: unknown): { snapshot: LearningSnapshot; decisions: DecisionRecord[]; submission: SessionSubmission } {
  const submission = parseSubmission(value);
  let mastery = snapshot;
  let streak = 0;
  const decisions: DecisionRecord[] = [];
  const previousByScenario = new Map<string, { index: number; word: string }>();
  for (const input of submission.decisions) {
    const set = getFixtureSet(input.setId);
    const chain = set.chains.find(item => item.id === input.scenarioId);
    const beatIndex = chain?.beats.findIndex(beat => beat.id === input.beatId) ?? -1;
    if (!chain || beatIndex < 0) throw new PersistenceValidationError('Unknown scenario or beat.');
    const expectedWords = set.words.map(word => word.word);
    if (new Set(input.presentedWords).size !== expectedWords.length || input.presentedWords.length !== expectedWords.length || expectedWords.some(word => !input.presentedWords.includes(word)) || !expectedWords.includes(input.selectedWord)) {
      throw new PersistenceValidationError('Presented and selected words must match the content.');
    }
    const scenarioKey = `${input.setId}/${input.scenarioId}`;
    const previous = previousByScenario.get(scenarioKey);
    if (beatIndex !== (previous ? previous.index + 1 : 0)) throw new PersistenceValidationError('Scenario beats must be submitted in order.');
    const lastVerified = snapshot.edges[chain.edge_id]?.lastVerified;
    const reviewIntervalDays = lastVerified === undefined ? 0 : Math.max(0, (submission.startedAt - lastVerified) / 86_400_000);
    const record = evaluateDecision({ ...input, previousSelection: previous?.word ?? null, reviewIntervalDays }, set, streak);
    streak = record.streak;
    // Tutorial is guided exposure, never independent mastery evidence.
    if (chain.purpose !== 'tutorial') mastery = { ...mastery, ...updateMastery(mastery, record) };
    decisions.push(record);
    previousByScenario.set(scenarioKey, { index: beatIndex, word: input.selectedWord });
  }
  const summary = {
    id: submission.id,
    startedAt: submission.startedAt,
    completedAt: submission.completedAt,
    score: decisions.reduce((sum, decision) => sum + decision.score, 0),
    decisionCount: decisions.length,
  };
  return { snapshot: { ...mastery, sessions: [...snapshot.sessions, summary] }, decisions, submission };
}
