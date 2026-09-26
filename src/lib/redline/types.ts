/** Shared Redline types. Content shapes mirror scripts/redline/build-content.mjs. */

export type Confidence = 'sure' | 'unsure' | 'guess';

/**
 * How one response reads, combining correctness with the interaction signals:
 *  mastered       correct, confident, unaided, no wavering
 *  fragile        correct but unsure / hinted / switched answers
 *  lucky          correct but flagged as a guess
 *  slip           wrong, yet solved the fresh transfer item — knows the rule, missed it here
 *  gap            wrong (or skipped) and knew they were unsure — a knowledge gap
 *  misconception  wrong while confident — a rule they believe that is false
 */
export type ResponseClass = 'mastered' | 'fragile' | 'lucky' | 'slip' | 'gap' | 'misconception';

export interface DistractorAutopsy {
  status: 'correct' | 'incorrect';
  reason?: string | null;
  issue?: string | null;
  attraction?: string | null;
  misconception?: string | null;
  family?: string;
  trap?: string;
}

export interface RedlineContent {
  sentence: string;
  span: string | null;
  options: Record<string, string>;
  meaning: string | null;
  xray: { label: string; text: string }[];
  decision: string | null;
  hint1: string;
  hint2: string;
  correct: string;
  proof: string;
  closestCompetitor: string | null;
  whyCompetitorFails: string | null;
  distractors: Record<string, DistractorAutopsy>;
  explanation: string;
  deeper: string;
  whyMiss: string;
  howCatch: string;
  transfer: { prompt: string; options: Record<string, string>; answer: string; explanation: string | null };
  skills: { primary: string; secondary: string[] };
  relatedItems: string[];
  reviewFamily: string | null;
  masterySkillId: string | null;
  sourcePdfPage: number | null;
}

/** A question as sent to the taker BEFORE answering — no key, proof or explanation. */
export interface RedlineTakingQuestion {
  id: number;
  position: number;
  sentence: string;
  span: string | null;
  options: Record<string, string>;
  hint1: string;
  hint2: string;
}

/** Everything revealed once a question is locked in. */
export interface RedlineReveal {
  questionId: number;
  correctKey: string;
  selectedKey: string | null;
  isCorrect: boolean;
  klass: ResponseClass;
  skillId: string;
  skillLabel: string;
  proof: string;
  explanation: string;
  deeper: string;
  whyMiss: string;
  howCatch: string;
  meaning: string | null;
  xray: { label: string; text: string }[];
  closestCompetitor: string | null;
  distractors: Record<string, { status: 'correct' | 'incorrect'; issue?: string | null; attraction?: string | null; reason?: string | null; familyLabel?: string; trapLabel?: string }>;
  /** Present only when the student missed it — the fresh transfer item (no answer key). */
  transfer: { prompt: string; options: Record<string, string> } | null;
}

export interface RedlineSubmitResponse {
  questionId: number;
  selectedKey: string | null;
  confidence: Confidence | null;
  firstClickMs: number;
  totalTimeMs: number;
  changes: { key: string; t: number }[];
  hint1Ms: number | null;
  hint2Ms: number | null;
}

export interface RedlineLevelTile {
  level: number;
  questionCount: number;
  status: 'locked' | 'open' | 'done';
  inProgress: boolean;
  /** First-attempt score (the one that feeds analysis). */
  firstScore: { correct: number; total: number } | null;
  bestScore: { correct: number; total: number } | null;
  attempts: number;
}

// ─── Analysis output ────────────────────────────────────────────────────────

export type SkillState = 'insufficient' | 'weak' | 'developing' | 'strong';

export interface SkillStat {
  id: string;
  label: string;
  mastery: number;          // 0-100
  margin: number;           // ± points, 95% band
  evidence: number;         // weighted response count behind the number
  answered: number;         // questions where this was the primary skill
  correct: number;
  classes: Record<ResponseClass, number>;
  state: SkillState;
  /** mastery over the most recent third minus the earliest third; null if too little data */
  trend: number | null;
}

export interface FamilyStat {
  id: string;
  label: string;
  count: number;            // times a wrong option of this family was picked
  share: number;            // of all wrong answers, 0-1
  confidentShare: number;   // of these, picked while "sure"
  skills: string[];         // skill ids where it happened most
}

export interface TrapStat {
  id: string;
  label: string;
  count: number;
  share: number;            // of all wrong answers
  baseShare: number;        // how often this trap appears among all distractors
  overIndex: number;        // share / baseShare (>1.3 = falls for it more than chance)
}

export interface Weakness {
  kind: 'skill' | 'family';
  id: string;
  label: string;
  severity: number;         // 0-1, used for ranking
  headline: string;
  points: string[];         // evidence sentences
  whyMiss: string | null;   // authored teaching text from a question they missed
  howCatch: string | null;
  questionNumbers: number[];
  /** A recent missed question to pull authored teaching text from (service fills whyMiss/howCatch). */
  teachQuestionId: number | null;
}

export interface BehaviorStats {
  answered: number;
  guessRate: number;
  sureAccuracy: number | null;      // accuracy when they said "sure"
  sureCount: number;
  overconfidence: number | null;    // share of "sure" answers that were wrong
  rushedWrongRate: number | null;   // wrong answers given in a fraction of their usual time
  overthinkRate: number | null;     // answers taking > 2.2x their median time
  overthinkAccuracy: number | null;
  medianTimeMs: number | null;
  hintRate: number;
  hintAccuracy: number | null;
  noHintAccuracy: number | null;
  changedRate: number;
  changedAccuracy: number | null;
  steadyAccuracy: number | null;
  talkedOutOfCorrect: number;       // first pick was right, final answer wrong
  fatigue: { early: number; late: number; delta: number } | null;
  transfer: { offered: number; attempted: number; correct: number };
  wrongLetters: Record<string, number>;
  letterBias: { letter: string; share: number } | null;
}

export interface LevelPoint { level: number; accuracy: number; avgTimeMs: number; masteredShare: number }

export interface RedlineAnalysis {
  answered: number;
  correct: number;
  accuracy: number | null;
  mastery: number | null;           // evidence-weighted overall 0-100
  levelsDone: number;
  classes: Record<ResponseClass, number>;
  skills: SkillStat[];
  families: FamilyStat[];
  traps: TrapStat[];
  behavior: BehaviorStats;
  weaknesses: Weakness[];
  strengths: { id: string; label: string; mastery: number }[];
  levelTrend: LevelPoint[];
  insights: string[];
}
