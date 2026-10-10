import type { LastWordPersistence, LearningSnapshot, SessionSubmission } from './types';

export class HttpLastWordPersistence implements LastWordPersistence {
  private async request(init?: RequestInit): Promise<LearningSnapshot> {
    const response = await fetch('/api/last-word/progress', { ...init, cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? 'Progress could not be saved. Try again.');
    }
    return response.json() as Promise<LearningSnapshot>;
  }

  load(): Promise<LearningSnapshot> {
    return this.request();
  }

  saveSession(submission: SessionSubmission): Promise<LearningSnapshot> {
    return this.request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission) });
  }
}
