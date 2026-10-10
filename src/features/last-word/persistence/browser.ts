import { applySubmission, parseSubmission } from './submission';
import { emptyLearningSnapshot, PersistenceValidationError, type LastWordPersistence, type LearningSnapshot, type SessionSubmission } from './types';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Browser-only guest progress; never uploaded or merged into authenticated evidence. */
export class BrowserLastWordPersistence implements LastWordPersistence {
  constructor(private storage: BrowserStorage, private key = 'last-word:guest:v1') {}

  private submissions(): SessionSubmission[] {
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new PersistenceValidationError('Guest progress is invalid.');
    return parsed.map(parseSubmission);
  }

  async load(): Promise<LearningSnapshot> {
    return this.submissions().reduce((snapshot, submission) => applySubmission(snapshot, submission).snapshot, emptyLearningSnapshot());
  }

  async saveSession(value: SessionSubmission): Promise<LearningSnapshot> {
    const submission = parseSubmission(value);
    const submissions = this.submissions();
    const existing = submissions.find(item => item.id === submission.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(submission)) throw new PersistenceValidationError('A saved session cannot be replaced.');
      return this.load();
    }
    const snapshot = applySubmission(await this.load(), submission).snapshot;
    this.storage.setItem(this.key, JSON.stringify([...submissions, submission]));
    return snapshot;
  }
}
