import { and, eq, gte, inArray, lt, max, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import { dhakaDayStart } from '@/lib/vocab/dhaka-time';
import { awardPoints } from '@/lib/vocab/points';
import type { LastWordSet } from '../content/schema';
import type { EdgeMastery, NodeMastery, ReviewSchedule } from '../core/types';
import { applySubmission, parseSubmission } from './submission';
import { CLOCK_TOLERANCE_MS, DAILY_POINTS_CAP, PersistenceValidationError, type LastWordPersistence, type LearningSnapshot, type SessionSubmission } from './types';

type Database = LibSQLDatabase<typeof schema>;
const { lastWordSessions: sessions, lastWordNodeMastery: nodes, lastWordEdgeMastery: edges, lastWordReviews: reviews, lastWordDecisions: decisions } = schema;
const DAY_MS = 86_400_000;

/** Inject a local/in-memory database in tests; the API alone injects the host connection. */
export class DatabaseLastWordPersistence implements LastWordPersistence {
  constructor(private database: Database, private userId: number, private sets: LastWordSet[]) {}

  /** Stored (pre-cap) decision points in the Dhaka day that starts at `dayStart`. */
  private async pointsInDay(connection: Pick<Database, 'select'>, dayStart: number): Promise<number> {
    const [row] = await connection.select({ total: sql<number>`coalesce(sum(${decisions.score}), 0)` }).from(decisions)
      .where(and(eq(decisions.userId, this.userId), gte(decisions.occurredAt, new Date(dayStart)), lt(decisions.occurredAt, new Date(dayStart + DAY_MS))));
    return Number(row?.total ?? 0);
  }

  private async read(connection: Pick<Database, 'select'>): Promise<LearningSnapshot> {
    const nodeRows = await connection.select().from(nodes).where(eq(nodes.userId, this.userId));
    const edgeRows = await connection.select().from(edges).where(eq(edges.userId, this.userId));
    const reviewRows = await connection.select().from(reviews).where(eq(reviews.userId, this.userId));
    const sessionRows = await connection.select().from(sessions).where(eq(sessions.userId, this.userId)).orderBy(sessions.completedAt);
    // The tutorial counts as done once any tutorial decision is saved, so it never repeats on another device.
    const tutorialIds = this.sets.flatMap(set => set.chains.filter(chain => chain.purpose === 'tutorial').map(chain => chain.id));
    const tutorialRows = tutorialIds.length
      ? await connection.select({ id: decisions.id }).from(decisions).where(and(eq(decisions.userId, this.userId), inArray(decisions.scenarioId, tutorialIds))).limit(1)
      : [];
    return {
      nodes: Object.fromEntries(nodeRows.map(row => [row.word, JSON.parse(row.data) as NodeMastery])),
      edges: Object.fromEntries(edgeRows.map(row => [row.edgeId, JSON.parse(row.data) as EdgeMastery])),
      reviews: Object.fromEntries(reviewRows.map(row => [row.edgeId, JSON.parse(row.data) as ReviewSchedule])),
      sessions: sessionRows.map(row => ({ id: row.clientId, startedAt: row.startedAt.getTime(), completedAt: row.completedAt.getTime(), score: row.score, decisionCount: row.decisionCount })),
      tutorialDone: tutorialRows.length > 0,
      pointsToday: Math.min(DAILY_POINTS_CAP, await this.pointsInDay(connection, dhakaDayStart(new Date()).getTime())),
      dailyCap: DAILY_POINTS_CAP,
    };
  }

  load(): Promise<LearningSnapshot> {
    return this.read(this.database);
  }

  /**
   * Saves a session. A session may be saved repeatedly as it grows (after each finished round, then at the end):
   * the stored decisions must be an unchanged prefix of the new list, and only the new decisions are applied.
   */
  async saveSession(value: SessionSubmission): Promise<LearningSnapshot> {
    const submission = parseSubmission(value);
    return this.database.transaction(async tx => {
      const [existing] = await tx.select().from(sessions).where(and(eq(sessions.userId, this.userId), eq(sessions.clientId, submission.id))).limit(1);
      const stored = existing ? parseSubmission(JSON.parse(existing.submission)) : null;
      if (existing && stored) {
        const extension = stored.startedAt === submission.startedAt && stored.decisions.length <= submission.decisions.length
          && stored.decisions.every((decision, i) => JSON.stringify(decision) === JSON.stringify(submission.decisions[i]));
        if (!extension) throw new PersistenceValidationError('A saved session cannot be replaced.');
        if (existing.submission === JSON.stringify(submission)) return this.read(tx);
      }
      const fresh = submission.decisions.slice(stored?.decisions.length ?? 0);

      // Play cannot be backdated: a new decision may not be dated meaningfully before the player's latest saved one.
      if (fresh.length) {
        const [row] = await tx.select({ latest: max(decisions.occurredAt) }).from(decisions).where(eq(decisions.userId, this.userId));
        const latest = row?.latest ? new Date(row.latest as unknown as string | number | Date).getTime() : null;
        if (latest !== null && fresh[0].occurredAt < latest - CLOCK_TOLERANCE_MS) throw new PersistenceValidationError('These decisions are older than your latest saved play.');
      }

      const base = await this.read(tx);
      const edgeIntervals: Record<string, number> = {};
      if (existing) {
        const earlier = await tx.select({ edgeId: decisions.edgeId, interval: decisions.reviewIntervalDays }).from(decisions).where(and(eq(decisions.userId, this.userId), eq(decisions.sessionId, existing.id))).orderBy(decisions.id);
        for (const row of earlier) edgeIntervals[row.edgeId] ??= row.interval;
      }
      const { snapshot, decisions: records } = fresh.length
        ? applySubmission(base, { ...submission, decisions: fresh }, this.sets, { prior: stored?.decisions ?? [], edgeIntervals })
        : { snapshot: base, decisions: [] };

      const score = (existing?.score ?? 0) + records.reduce((sum, record) => sum + record.score, 0);
      const decisionCount = (existing?.decisionCount ?? 0) + records.length;
      const row = { completedAt: new Date(submission.completedAt), score, decisionCount, submission: JSON.stringify(submission) };
      let sessionId = existing?.id;
      if (existing) await tx.update(sessions).set(row).where(eq(sessions.id, existing.id));
      else [{ id: sessionId }] = await tx.insert(sessions).values({ userId: this.userId, clientId: submission.id, startedAt: new Date(submission.startedAt), ...row }).returning({ id: sessions.id });

      // Lexicore points: each decision's server-computed points, up to the daily cap. Same write path as quiz/flashcard/Word Hunt.
      // The cap is measured against what the day's stored decisions already add up to, so it holds across devices and retries.
      const used = new Map<number, number>();
      let awarded = 0;
      let earned = 0;
      for (const record of records) {
        const day = dhakaDayStart(new Date(record.occurredAt)).getTime();
        if (!used.has(day)) used.set(day, await this.pointsInDay(tx, day));
        awarded += Math.min(record.score, Math.max(0, DAILY_POINTS_CAP - used.get(day)!));
        used.set(day, used.get(day)! + record.score);
        earned += record.score;
      }

      if (records.length) {
        await tx.insert(decisions).values(records.map(record => ({
          userId: this.userId,
          sessionId: sessionId!,
          clientId: record.id,
          setId: record.setId,
          edgeId: record.edgeId,
          scenarioId: record.scenarioId,
          beatId: record.beatId,
          presentedWords: JSON.stringify(record.presentedWords),
          selectedWord: record.selectedWord,
          bestWord: record.bestWord,
          semanticFit: record.semanticFit,
          correctness: record.correctness,
          reactionTimeMs: record.reactionTimeMs,
          changedSelection: record.changedSelection,
          previousSelection: record.previousSelection,
          hintLevel: record.hintLevel,
          confidence: record.confidence,
          misconceptionTag: record.misconceptionTag,
          contentDifficulty: JSON.stringify(record.contentDifficulty),
          reviewIntervalDays: record.reviewIntervalDays,
          score: record.score,
          evidenceWeight: record.evidenceWeight,
          occurredAt: new Date(record.occurredAt),
          data: JSON.stringify(record),
        })));
      }
      const updatedAt = new Date(submission.completedAt);
      await awardPoints(tx, this.userId, awarded, updatedAt);
      for (const [word, node] of Object.entries(snapshot.nodes)) {
        const data = JSON.stringify(node);
        await tx.insert(nodes).values({ userId: this.userId, word, data, updatedAt }).onConflictDoUpdate({ target: [nodes.userId, nodes.word], set: { data, updatedAt } });
      }
      for (const [edgeId, edge] of Object.entries(snapshot.edges)) {
        const data = JSON.stringify(edge);
        await tx.insert(edges).values({ userId: this.userId, edgeId, data, updatedAt }).onConflictDoUpdate({ target: [edges.userId, edges.edgeId], set: { data, updatedAt } });
      }
      for (const [edgeId, review] of Object.entries(snapshot.reviews)) {
        const data = { data: JSON.stringify(review), dueAt: new Date(review.dueAt), intervalDays: review.intervalDays };
        await tx.insert(reviews).values({ userId: this.userId, edgeId, ...data }).onConflictDoUpdate({ target: [reviews.userId, reviews.edgeId], set: data });
      }
      return { ...(await this.read(tx)), lastSave: { awarded, capped: awarded < earned } };
    }, { behavior: 'immediate' });
  }
}
