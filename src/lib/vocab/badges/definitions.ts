/**
 * Badge definitions for the LexiCore gamification system.
 *
 * 20 standard badges (short_term / mid_term / long_term) +
 * 4 ultimate achievements (hidden until Admin enables them).
 */

export interface BadgeDefinition {
  id:          string;
  name:        string;
  description: string;
  category:    'short_term' | 'mid_term' | 'long_term' | 'ultimate';
}

export const BADGE_DEFS: readonly BadgeDefinition[] = [
  // ── Short-term (4) ──────────────────────────────────────────────────────────
  {
    id:          'first_step',
    name:        'First Step',
    description: 'Complete your first flashcard session.',
    category:    'short_term',
  },
  {
    id:          'quiz_starter',
    name:        'Quiz Starter',
    description: 'Complete your first theme quiz.',
    category:    'short_term',
  },
  {
    id:          'on_a_roll',
    name:        'On a Roll',
    description: 'Maintain a 3-day study streak.',
    category:    'short_term',
  },
  {
    id:          'perfectionist',
    name:        'Perfectionist',
    description: 'Score 100% on any single quiz.',
    category:    'short_term',
  },

  // ── Mid-term (10) ────────────────────────────────────────────────────────────
  {
    id:          'week_warrior',
    name:        'Week Warrior',
    description: 'Maintain a 7-day study streak.',
    category:    'mid_term',
  },
  {
    id:          'sharp_shooter',
    name:        'Sharp Shooter',
    description: 'Answer 50 quiz questions correctly in a row without a single mistake.',
    category:    'mid_term',
  },
  {
    id:          'unit_slayer',
    name:        'Unit Slayer',
    description: 'Complete all quizzes in your first full unit.',
    category:    'mid_term',
  },
  {
    id:          'analogy_apprentice',
    name:        'Analogy Apprentice',
    description: 'Answer 25 analogy questions correctly (cumulative).',
    category:    'mid_term',
  },
  {
    id:          'halfway_there',
    name:        'Halfway There',
    description: 'Review at least half of all available words.',
    category:    'mid_term',
  },
  {
    id:          'streak_keeper',
    name:        'Streak Keeper',
    description: 'Maintain a 14-day study streak.',
    category:    'mid_term',
  },
  {
    id:          'review_regular',
    name:        'Review Regular',
    description: 'Complete 30 flashcard sessions.',
    category:    'mid_term',
  },
  {
    id:          'speed_demon',
    name:        'Speed Demon',
    description: 'Complete 5 flashcard sessions each in under 3 minutes.',
    category:    'mid_term',
  },
  {
    id:          'leaderboard_climber',
    name:        'Leaderboard Climber',
    description: 'Reach the Top 10 on any weekly leaderboard.',
    category:    'mid_term',
  },
  {
    id:          'vocab_explorer',
    name:        'Vocab Explorer',
    description: 'Start flashcards for 8 different units.',
    category:    'mid_term',
  },

  // ── Long-term (6) ────────────────────────────────────────────────────────────
  {
    id:          'the_800_club',
    name:        'The 800 Club',
    description: 'Review every word in the vocabulary bank at least once.',
    category:    'long_term',
  },
  {
    id:          'analogy_master',
    name:        'Analogy Master',
    description: 'Answer 200 analogy questions correctly (cumulative).',
    category:    'long_term',
  },
  {
    id:          'unit_conqueror',
    name:        'Unit Conqueror',
    description: 'Complete all quizzes in every unit.',
    category:    'long_term',
  },
  {
    id:          'review_legend',
    name:        'Review Legend',
    description: 'Complete 200 flashcard sessions.',
    category:    'long_term',
  },
  {
    id:          'completionist',
    name:        'Completionist',
    description: 'Pass every quiz in every unit.',
    category:    'long_term',
  },
  {
    id:          'leaderboard_legend',
    name:        'Leaderboard Legend',
    description: 'Finish in the Top 3 on any weekly leaderboard.',
    category:    'long_term',
  },

  // ── Ultimate achievements (4, hidden by default) ────────────────────────────
  {
    id:          'question_machine',
    name:        'Question Machine',
    description: 'Answer 10,000 quiz questions correctly.',
    category:    'ultimate',
  },
  {
    id:          'flawless_run',
    name:        'Flawless Run',
    description: 'Score 100% on every quiz in an entire unit.',
    category:    'ultimate',
  },
  {
    id:          'word_sovereign',
    name:        'Word Sovereign',
    description: 'Reach mastery score ≥151 on all words, each with a long-gap correct recall.',
    category:    'ultimate',
  },
  {
    id:          'immortal',
    name:        'Immortal',
    description: 'Study every day for 90 consecutive days.',
    category:    'ultimate',
  },
] as const;

export const BADGE_MAP = new Map<string, BadgeDefinition>(
  BADGE_DEFS.map(b => [b.id, b]),
);
