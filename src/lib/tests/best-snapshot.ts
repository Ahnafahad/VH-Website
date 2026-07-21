/**
 * Serialization for testAttempts.bestSnapshot — the parked "prior best"
 * score+answers for a staff diagnostic retake (see schema.ts). Only ever
 * read/written by the diagnostic start/submit routes.
 */

export interface BestSnapshot {
  totalScore: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  sectionScores: string;   // already-JSON-stringified per-section breakdown
  submittedAt: number;     // epoch ms of the original submission
  answers: Array<{ questionId: number; selectedKey: string | null; flagged: boolean }>;
}

export function serializeBestSnapshot(s: BestSnapshot): string {
  return JSON.stringify(s);
}

export function parseBestSnapshot(raw: string | null): BestSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.totalScore === 'number' && Array.isArray(parsed.answers)) {
      return parsed as BestSnapshot;
    }
  } catch {
    /* ignore malformed JSON */
  }
  return null;
}
