import type { LastWordSet } from '../content/schema';
import { applySubmission, parseSubmission } from './submission';
import { emptyLearningSnapshot, PersistenceValidationError, type LastWordPersistence, type LearningSnapshot, type SessionSubmission } from './types';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Browser-only guest progress; never uploaded or merged into authenticated evidence. */
export class BrowserLastWordPersistence implements LastWordPersistence {
  constructor(private storage: BrowserStorage, private sets: LastWordSet[], private key = 'last-word:guest:v1') {}

  private submissions(): SessionSubmission[] {
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new PersistenceValidationError('Guest progress is invalid.');
    return parsed.map(parseSubmission);
  }

  async load(): Promise<LearningSnapshot> {
    return this.submissions().reduce((snapshot, submission) => applySubmission(snapshot, submission, this.sets, { replay: true }).snapshot, emptyLearningSnapshot());
  }

  async saveSession(value: SessionSubmission): Promise<LearningSnapshot> {
    const submission = parseSubmission(value);
    const submissions = this.submissions();
    const existing = submissions.find(item => item.id === submission.id);
    if (existing) {
      // A session may grow as it is played; the saved decisions must be an unchanged prefix.
      const extension = existing.startedAt === submission.startedAt && existing.decisions.length <= submission.decisions.length
        && existing.decisions.every((decision, i) => JSON.stringify(decision) === JSON.stringify(submission.decisions[i]));
      if (!extension) throw new PersistenceValidationError('A saved session cannot be replaced.');
      this.storage.setItem(this.key, JSON.stringify(submissions.map(item => (item.id === submission.id ? submission : item))));
      return this.load();
    }
    const snapshot = applySubmission(await this.load(), submission, this.sets).snapshot;
    this.storage.setItem(this.key, JSON.stringify([...submissions, submission]));
    return snapshot;
  }
}
