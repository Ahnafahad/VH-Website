export type RecommendationKind = 'resume_quiz' | 'due_review' | 'resume_learning' | 'ready_quiz' | 'repair' | 'new_learning';

export interface RecommendationInput {
  activeQuiz?: { id: number; href: string; answered: number; total: number } | null;
  dueCount: number;
  learn?: { themeId: number; name: string; wordCount: number; inProgress: boolean } | null;
  quiz?: { themeId: number; name: string; wordCount: number } | null;
  weakCount: number;
}

export interface LearningRecommendation {
  kind: RecommendationKind;
  href: string;
  action: string;
  title: string;
  reason: string;
  durationMinutes: number;
  outcome: string;
}

export function chooseRecommendation(input: RecommendationInput): LearningRecommendation {
  if (input.activeQuiz) {
    const left = Math.max(1, input.activeQuiz.total - input.activeQuiz.answered);
    return {
      kind: 'resume_quiz', href: input.activeQuiz.href, action: 'Resume quiz',
      title: `Finish your ${left}-question recall check`, reason: 'Your answers are saved, so you can continue where you stopped.',
      durationMinutes: Math.max(1, Math.ceil(left * 0.5)), outcome: 'Complete the recall check and update your mastery.',
    };
  }
  if (input.dueCount > 0) {
    const count = Math.min(input.dueCount, 10);
    return {
      kind: 'due_review', href: '/vocab/review', action: 'Review now',
      title: `Protect ${count} ${count === 1 ? 'word' : 'words'} before recall fades`,
      reason: 'These words have reached their scheduled review time.', durationMinutes: Math.max(2, Math.ceil(count * 0.6)),
      outcome: 'Strengthen the words most likely to become difficult.',
    };
  }
  if (input.learn?.inProgress) return {
    kind: 'resume_learning', href: `/vocab/study/${input.learn.themeId}`, action: 'Continue session',
    title: `Continue ${input.learn.name}`, reason: 'You already started this set; finishing it keeps the learning thread intact.',
    durationMinutes: Math.max(3, Math.ceil(input.learn.wordCount * 0.45)), outcome: 'Finish learning this set and prepare its recall check.',
  };
  if (input.quiz) return {
    kind: 'ready_quiz', href: `/vocab/study/${input.quiz.themeId}/quiz`, action: 'Test your recall',
    title: `Check what stayed from ${input.quiz.name}`, reason: 'You have seen these words; tested recall is the next useful step.',
    durationMinutes: Math.max(3, Math.ceil(input.quiz.wordCount * 0.5)), outcome: 'Turn exposure into measured mastery.',
  };
  if (input.weakCount > 0) {
    const count = Math.min(input.weakCount, 10);
    return {
      kind: 'repair', href: '/vocab/practice', action: 'Repair weak words', title: `Repair ${count} uncertain ${count === 1 ? 'word' : 'words'}`,
      reason: 'Recent answers show these words need a different kind of practice.', durationMinutes: Math.max(3, Math.ceil(count * 0.7)),
      outcome: 'Resolve weak recall before adding more vocabulary.',
    };
  }
  const learn = input.learn;
  return {
    kind: 'new_learning', href: learn ? `/vocab/study/${learn.themeId}` : '/vocab/study', action: 'Start learning',
    title: learn ? `Learn ${learn.name}` : 'Begin a focused vocabulary session',
    reason: 'Your review queue is clear, so this is a good moment to add a small set.',
    durationMinutes: learn ? Math.max(4, Math.ceil(learn.wordCount * 0.45)) : 5, outcome: 'Learn a manageable set and prepare it for recall.',
  };
}
