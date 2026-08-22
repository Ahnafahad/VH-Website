/**
 * Pure scoring logic for the Math Marathon module. No DB access here —
 * everything is unit-testable.
 *
 * Deliberately no negative marking (confirmed with the user): this is mastery
 * practice, not a scored test. Score is simply the correct count.
 */

export interface MarathonQuestionLike {
  id: number;
  correctKey: string;
}

export interface AttemptScore {
  totalCorrect: number;
  totalWrong: number;
  totalSkipped: number;
  totalQuestions: number;
}

/** answers: questionId → selectedKey (only visited/answered questions need be present). */
export function scoreMarathonAttempt(
  questions: MarathonQuestionLike[],
  answers: Map<number, string | null>,
): AttemptScore {
  let totalCorrect = 0, totalWrong = 0, totalSkipped = 0;
  for (const q of questions) {
    const selected = answers.get(q.id);
    if (!selected) { totalSkipped++; continue; }
    if (selected === q.correctKey) totalCorrect++;
    else totalWrong++;
  }
  return { totalCorrect, totalWrong, totalSkipped, totalQuestions: questions.length };
}
