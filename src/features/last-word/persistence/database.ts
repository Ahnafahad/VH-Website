import { and, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import type { EdgeMastery, NodeMastery, ReviewSchedule } from '../core/types';
import { applySubmission, parseSubmission } from './submission';
import { PersistenceValidationError, type LastWordPersistence, type LearningSnapshot, type SessionSubmission } from './types';

type Database = LibSQLDatabase<typeof schema>;
const { lastWordSessions: sessions, lastWordNodeMastery: nodes, lastWordEdgeMastery: edges, lastWordReviews: reviews, lastWordDecisions: decisions } = schema;

/** Inject a local/in-memory database in tests; the API alone injects the host connection. */
export class DatabaseLastWordPersistence implements LastWordPersistence {
  constructor(private database: Database, private userId: number) {}

  private async read(connection: Pick<Database, 'select'>): Promise<LearningSnapshot> {
    const nodeRows = await connection.select().from(nodes).where(eq(nodes.userId, this.userId));
    const edgeRows = await connection.select().from(edges).where(eq(edges.userId, this.userId));
    const reviewRows = await connection.select().from(reviews).where(eq(reviews.userId, this.userId));
    const sessionRows = await connection.select().from(sessions).where(eq(sessions.userId, this.userId)).orderBy(sessions.completedAt);
    return {
      nodes: Object.fromEntries(nodeRows.map(row => [row.word, JSON.parse(row.data) as NodeMastery])),
      edges: Object.fromEntries(edgeRows.map(row => [row.edgeId, JSON.parse(row.data) as EdgeMastery])),
      reviews: Object.fromEntries(reviewRows.map(row => [row.edgeId, JSON.parse(row.data) as ReviewSchedule])),
      sessions: sessionRows.map(row => ({ id: row.clientId, startedAt: row.startedAt.getTime(), completedAt: row.completedAt.getTime(), score: row.score, decisionCount: row.decisionCount })),
    };
  }

  load(): Promise<LearningSnapshot> {
    return this.read(this.database);
  }

  async saveSession(value: SessionSubmission): Promise<LearningSnapshot> {
    const submission = parseSubmission(value);
    return this.database.transaction(async tx => {
      const [existing] = await tx.select().from(sessions).where(and(eq(sessions.userId, this.userId), eq(sessions.clientId, submission.id))).limit(1);
      if (existing) {
        if (existing.submission !== JSON.stringify(submission)) throw new PersistenceValidationError('A saved session cannot be replaced.');
        return this.read(tx);
      }
      const { snapshot, decisions: records } = applySubmission(await this.read(tx), submission);
      const summary = snapshot.sessions[snapshot.sessions.length - 1];
      const [saved] = await tx.insert(sessions).values({
        userId: this.userId,
        clientId: submission.id,
        startedAt: new Date(submission.startedAt),
        completedAt: new Date(submission.completedAt),
        score: summary.score,
        decisionCount: summary.decisionCount,
        submission: JSON.stringify(submission),
      }).returning({ id: sessions.id });
      await tx.insert(decisions).values(records.map(record => ({
        userId: this.userId,
        sessionId: saved.id,
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
      const updatedAt = new Date(submission.completedAt);
      for (const [word, node] of Object.entries(snapshot.nodes)) {
        const data = JSON.stringify(node);
        await tx.insert(nodes).values({ userId: this.userId, word, data, updatedAt }).onConflictDoUpdate({ target: [nodes.userId, nodes.word], set: { data, updatedAt } });
      }
      for (const [edgeId, edge] of Object.entries(snapshot.edges)) {
        const data = JSON.stringify(edge);
        await tx.insert(edges).values({ userId: this.userId, edgeId, data, updatedAt }).onConflictDoUpdate({ target: [edges.userId, edges.edgeId], set: { data, updatedAt } });
      }
      for (const [edgeId, review] of Object.entries(snapshot.reviews)) {
        const row = { data: JSON.stringify(review), dueAt: new Date(review.dueAt), intervalDays: review.intervalDays };
        await tx.insert(reviews).values({ userId: this.userId, edgeId, ...row }).onConflictDoUpdate({ target: [reviews.userId, reviews.edgeId], set: row });
      }
      return snapshot;
    }, { behavior: 'immediate' });
  }
}
