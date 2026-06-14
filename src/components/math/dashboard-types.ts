import type { MathOperation } from '@/lib/db/schema';
import type { Tier } from '@/lib/math/constants';

export interface DashboardHeatCell {
  operation: MathOperation;
  tier:      Tier;
  attempts:  number;
  correct:   number;
  accuracy:  number;  // 0–1
}

export interface DashboardCurvePoint {
  sessionId:  number;
  finishedAt: string | null;
  score:      number;
  accuracy:   number;  // 0–100
}

export interface DashboardRecentSession {
  id:                number;
  finishedAt:        string | null;
  operations:        MathOperation[];
  startDifficulty:   number;
  adaptive:          boolean;
  totalScore:        number;
  questionsAnswered: number;
  questionsCorrect:  number;
  accuracy:          number;
  timeLimit:         number;
}

export interface DashboardBests {
  bestScore:     number;
  bestAccuracy:  number;
  fastestAvgMs:  number | null;
  totalGames:    number;
}

export interface DashboardWeakSpot {
  operation: MathOperation;
  accuracy:  number;
  tier:      Tier;
  attempts:  number;
}

export interface DashboardProgress {
  totalGames:      number;
  totalQuestions:  number;
  totalCorrect:    number;
  overallAccuracy: number;
  bestScore:       number;
  skill: {
    addition:       number;
    subtraction:    number;
    multiplication: number;
    division:       number;
  };
  preferredDifficulty: number;
}

export interface DashboardPayload {
  progress:       DashboardProgress | null;
  bests:          DashboardBests;
  heatmap:        DashboardHeatCell[];
  curve:          DashboardCurvePoint[];
  weakSpot:       DashboardWeakSpot | null;
  recentSessions: DashboardRecentSession[];
}
