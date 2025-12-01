// Accounting question structure (matches JSON output from parser)
export interface AccountingQuestion {
  id: string;              // "lecture1_q1"
  lecture: number;         // 1-12
  section: string;         // "Introduction to Accounting"
  question: string;        // Question text
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  explanation: string;
}

// Lecture data structure
export interface LectureData {
  lectureNumber: number;
  title: string;
  topics: string;
  shortTitle: string;      // For UI display
  sections: string[];
  questionCount: number;
  questions: AccountingQuestion[];
}

// API response for loading questions
export interface AccountingQuestionsData {
  lectures: LectureData[];
  totalQuestions: number;
  lastUpdated: string;
  metadata: {
    source: string;
    lecturesProcessed: number;
    totalLectures: number;
    questionsPerLecture: {
      lecture: number;
      count: number;
    }[];
  };
}

// Game state type
export type GameState = 'setup' | 'playing' | 'finished' | 'leaderboard';

// Setup configuration
export interface SetupConfig {
  selectedLectures: number[];
  // Always 16 questions - no limit selection needed
}

// Question result (after answering)
export interface QuestionResult {
  question: AccountingQuestion;
  userAnswer: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  isCorrect: boolean;
  isSkipped: boolean;
  timeTaken: number;  // Time in seconds for this question
  speedBonus: number; // Bonus points earned for speed
}

// Game results
export interface GameResults {
  simpleScore: number;       // Simple scoring: +1 correct, -0.25 wrong
  dynamicScore: number;      // Dynamic scoring with bonuses
  totalSpeedBonus: number;   // Total bonus from speed
  lectureCoverageBonus: number; // Bonus for selecting more lectures
  questionsAnswered: number;
  correctAnswers: number;
  wrongAnswers: number;
  skippedAnswers: number;
  accuracy: number;
  selectedLectures: number[];
  timeTaken: number;         // Total time for all questions
  results: QuestionResult[];
}

// Leaderboard entry (for singular - best single game)
export interface SingularLeaderboardEntry {
  playerEmail: string;
  playerName: string;
  bestDynamicScore: number;
  bestSimpleScore: number;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  selectedLecturesCount: number;
  timeTaken: number;
  playedAt: Date;
}

// Leaderboard entry (for cumulative - all games)
export interface CumulativeLeaderboardEntry {
  playerEmail: string;
  playerName: string;
  totalDynamicScore: number;
  totalSimpleScore: number;
  gamesPlayed: number;
  totalQuestions: number;
  totalCorrect: number;
  averageAccuracy: number;
  lastPlayed: Date;
  lecturesCoveredCount: number;
}

// API response types
export interface SaveScoreResponse {
  success: boolean;
  message: string;
  isAdmin: boolean;
  scoreId: string;
  simpleScore: number;
  dynamicScore: number;
}

export interface LeaderboardResponse {
  singular: SingularLeaderboardEntry[];
  cumulative: CumulativeLeaderboardEntry[];
  isEmpty: boolean;
  singularCount: number;
  cumulativeCount: number;
  message: string;
}
