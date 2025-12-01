import {
  AccountingQuestion,
  LectureData,
  AccountingQuestionsData,
  QuestionResult,
  GameResults
} from '@/app/games/fbs-accounting/types';

let cachedData: AccountingQuestionsData | null = null;

/**
 * Fetch accounting questions from generated JSON file
 */
export async function getAccountingQuestions(): Promise<LectureData[]> {
  if (cachedData) {
    return cachedData.lectures;
  }

  try {
    const response = await fetch('/data/accounting-questions.json');
    if (!response.ok) {
      throw new Error('Failed to load accounting questions');
    }

    const data: AccountingQuestionsData = await response.json();
    cachedData = data;
    return data.lectures;
  } catch (error) {
    console.error('Error loading accounting questions:', error);
    throw new Error('Failed to load accounting questions. Please try again.');
  }
}

/**
 * Get questions from selected lectures with mastery awareness
 * Prioritizes unmastered questions over mastered ones
 */
export function getQuestionsByLectures(
  allLectures: LectureData[],
  selectedLectures: number[],
  masteredQuestionIds: string[] = []
): AccountingQuestion[] {
  const QUESTION_LIMIT = 16;

  // Collect all questions from selected lectures
  const allQuestions: AccountingQuestion[] = [];

  selectedLectures.forEach(lectureNum => {
    const lecture = allLectures.find(l => l.lectureNumber === lectureNum);
    if (lecture && lecture.questions.length > 0) {
      allQuestions.push(...lecture.questions);
    }
  });

  if (allQuestions.length === 0) {
    throw new Error('No questions found for selected lectures');
  }

  // Separate questions by mastery status
  const masteredSet = new Set(masteredQuestionIds);
  const unmastered = allQuestions.filter(q => !masteredSet.has(q.id));
  const mastered = allQuestions.filter(q => masteredSet.has(q.id));

  // Shuffle both groups independently
  const shuffledUnmastered = shuffleArray(unmastered);
  const shuffledMastered = shuffleArray(mastered);

  // Fill 16-question pool: prioritize unmastered, backfill with mastered
  let selected: AccountingQuestion[] = [];

  if (unmastered.length >= QUESTION_LIMIT) {
    // Case 1: Enough unmastered questions (ideal learning state)
    selected = shuffledUnmastered.slice(0, QUESTION_LIMIT);
  } else {
    // Case 2: Mix unmastered + mastered
    selected = [
      ...shuffledUnmastered,
      ...shuffledMastered.slice(0, QUESTION_LIMIT - shuffledUnmastered.length)
    ];
  }

  // Final shuffle for unpredictability while maintaining mastery weighting
  return shuffleArray(selected);
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calculate speed bonus for a single question
 * Faster answers get higher bonuses
 */
export function calculateSpeedBonus(timeTaken: number, isCorrect: boolean): number {
  // No bonus for wrong or skipped answers
  if (!isCorrect) return 0;

  // Speed bonus tiers (seconds):
  // < 5s = 0.5 bonus
  // 5-10s = 0.3 bonus
  // 10-15s = 0.15 bonus
  // 15-20s = 0.05 bonus
  // > 20s = 0 bonus
  if (timeTaken < 5) return 0.5;
  if (timeTaken < 10) return 0.3;
  if (timeTaken < 15) return 0.15;
  if (timeTaken < 20) return 0.05;
  return 0;
}

/**
 * Calculate lecture coverage bonus
 * Reward for selecting more lectures (encourages broader learning)
 */
export function calculateLectureCoverageBonus(selectedLecturesCount: number): number {
  // Bonus scale: 0.1 points per lecture selected
  // Maximum: 1.2 points for all 12 lectures
  return selectedLecturesCount * 0.1;
}

/**
 * Calculate simple score with penalty for wrong answers
 * Returns: +1 for correct, -0.25 for wrong, 0 for skipped
 */
export function calculateSimpleScore(
  questions: AccountingQuestion[],
  userAnswers: (string | null)[]
): {
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
} {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;

  questions.forEach((q, index) => {
    const answer = userAnswers[index];
    if (answer === null) {
      skipped++;
    } else if (answer === q.correctAnswer) {
      correct++;
    } else {
      wrong++;
    }
  });

  // Score: +1 for correct, -0.25 for wrong, 0 for skipped
  const rawScore = correct * 1.0 + wrong * (-0.25);
  const score = Math.max(0, rawScore); // Never go below 0

  const accuracy = questions.length > 0
    ? (correct / questions.length) * 100
    : 0;

  return {
    score: Number(score.toFixed(2)),
    correct,
    wrong,
    skipped,
    accuracy: Number(accuracy.toFixed(1))
  };
}

/**
 * Calculate dynamic score with bonuses
 * Includes: simple score + speed bonuses + lecture coverage bonus
 */
export function calculateDynamicScore(
  questionResults: QuestionResult[],
  selectedLecturesCount: number
): {
  dynamicScore: number;
  totalSpeedBonus: number;
  lectureCoverageBonus: number;
} {
  // Sum up all speed bonuses
  const totalSpeedBonus = questionResults.reduce(
    (sum, result) => sum + result.speedBonus,
    0
  );

  // Calculate lecture coverage bonus
  const lectureCoverageBonus = calculateLectureCoverageBonus(selectedLecturesCount);

  // Get simple score from results
  const correct = questionResults.filter(r => r.isCorrect).length;
  const wrong = questionResults.filter(r => !r.isCorrect && !r.isSkipped).length;
  const simpleScore = Math.max(0, correct * 1.0 + wrong * (-0.25));

  // Dynamic score = simple + speed bonuses + lecture bonus
  const dynamicScore = simpleScore + totalSpeedBonus + lectureCoverageBonus;

  return {
    dynamicScore: Number(dynamicScore.toFixed(2)),
    totalSpeedBonus: Number(totalSpeedBonus.toFixed(2)),
    lectureCoverageBonus: Number(lectureCoverageBonus.toFixed(2))
  };
}

/**
 * Generate question results with correctness, time, and speed bonus info
 */
export function generateQuestionResults(
  questions: AccountingQuestion[],
  userAnswers: (string | null)[],
  questionTimes: number[]  // Time taken per question in seconds
): QuestionResult[] {
  return questions.map((question, index) => {
    const userAnswer = userAnswers[index];
    const isSkipped = userAnswer === null;
    const isCorrect = !isSkipped && userAnswer === question.correctAnswer;
    const timeTaken = questionTimes[index] || 0;
    const speedBonus = calculateSpeedBonus(timeTaken, isCorrect);

    return {
      question,
      userAnswer: userAnswer as 'A' | 'B' | 'C' | 'D' | 'E' | null,
      isCorrect,
      isSkipped,
      timeTaken,
      speedBonus
    };
  });
}

/**
 * Get short title for lecture (for UI display with tooltip)
 */
export function getShortTitle(topics: string): string {
  if (!topics) return 'Accounting';
  const parts = topics.split(',').map(t => t.trim());
  if (parts.length <= 1) return parts[0] || 'Accounting';
  return `${parts[0]} & ${parts.length - 1} more`;
}

/**
 * Format time in seconds to MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate total available questions from selected lectures
 */
export function getTotalAvailableQuestions(
  allLectures: LectureData[],
  selectedLectures: number[]
): number {
  let total = 0;
  selectedLectures.forEach(lectureNum => {
    const lecture = allLectures.find(l => l.lectureNumber === lectureNum);
    if (lecture) {
      total += lecture.questionCount;
    }
  });
  return total;
}

/**
 * Validate that a lecture has questions
 */
export function isLectureAvailable(lecture: LectureData): boolean {
  return lecture.questionCount > 0;
}

/**
 * Save score to API (dual scoring system)
 */
export async function saveScore(results: GameResults): Promise<boolean> {
  try {
    const response = await fetch('/api/accounting/scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        simpleScore: results.simpleScore,
        dynamicScore: results.dynamicScore,
        totalSpeedBonus: results.totalSpeedBonus,
        lectureCoverageBonus: results.lectureCoverageBonus,
        questionsAnswered: results.questionsAnswered,
        correctAnswers: results.correctAnswers,
        wrongAnswers: results.wrongAnswers,
        skippedAnswers: results.skippedAnswers,
        accuracy: results.accuracy,
        selectedLectures: results.selectedLectures,
        timeTaken: results.timeTaken
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to save score:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving score:', error);
    return false;
  }
}

/**
 * Fetch leaderboard from API
 */
export async function fetchLeaderboard() {
  try {
    const response = await fetch('/api/accounting/leaderboard');

    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
}

/**
 * Update question mastery for a user after game completion
 * This is called server-side from the API route
 */
export async function updateQuestionMastery(
  playerEmail: string,
  questionResults: QuestionResult[],
  allLectures: LectureData[]
): Promise<{
  newlyMastered: string[];
  lecturesCompleted: number[];
  totalMastered: number;
}> {
  // Import model dynamically (server-side only)
  const AccountingProgress = (await import('@/lib/models/AccountingProgress')).default;

  // 1. Get or create progress document
  let progress = await AccountingProgress.findOne({
    playerEmail: playerEmail.toLowerCase()
  });

  if (!progress) {
    progress = new AccountingProgress({
      playerEmail: playerEmail.toLowerCase(),
      masteredQuestions: new Set<string>(),
      lectureProgress: new Map(),
      totalMastered: 0,
      totalQuestions: 281,
      createdAt: new Date()
    });
  }

  // 2. Extract correctly answered question IDs
  const correctQuestionIds = questionResults
    .filter(r => r.isCorrect)
    .map(r => r.question.id);

  // 3. Track newly mastered questions
  const previouslyMastered = new Set(progress.masteredQuestions);
  const newlyMastered = correctQuestionIds.filter(
    id => !previouslyMastered.has(id)
  );

  // 4. Update mastered questions Set
  correctQuestionIds.forEach(id => {
    progress.masteredQuestions.add(id);
  });

  // 5. Update per-lecture progress
  const lecturesInGame = new Set(
    questionResults.map(r => r.question.lecture)
  );

  const lecturesCompleted: number[] = [];

  for (const lectureNum of lecturesInGame) {
    // Get lecture data
    const lectureData = allLectures.find(l => l.lectureNumber === lectureNum);
    if (!lectureData) continue;

    const totalQuestionsInLecture = lectureData.questionCount;

    // Count mastered questions in this lecture
    const masteredInLecture = Array.from(progress.masteredQuestions as Set<string>)
      .filter(id => id.startsWith(`lecture${lectureNum}_`))
      .length;

    // Check if lecture was previously completed
    const prevProgress = progress.lectureProgress.get(lectureNum);
    const wasCompleted = prevProgress?.masteredCount === totalQuestionsInLecture;
    const isNowCompleted = masteredInLecture === totalQuestionsInLecture;

    // Update lecture progress
    progress.lectureProgress.set(lectureNum, {
      totalQuestions: totalQuestionsInLecture,
      masteredCount: masteredInLecture,
      completionCount: (prevProgress?.completionCount || 0) +
                       (isNowCompleted && !wasCompleted ? 1 : 0),
      lastPlayed: new Date()
    });

    // Track newly completed lectures
    if (isNowCompleted && !wasCompleted) {
      lecturesCompleted.push(lectureNum);
    }
  }

  // 6. Update totals
  progress.totalMastered = progress.masteredQuestions.size;
  progress.lastUpdated = new Date();

  // 7. Save to database
  await progress.save();

  return {
    newlyMastered,
    lecturesCompleted,
    totalMastered: progress.totalMastered
  };
}
