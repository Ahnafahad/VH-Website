import { integer, real, sqliteTable, text, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  email:     text('email').notNull().unique(),
  name:      text('name').notNull(),
  // 'super_admin' | 'admin' | 'instructor' | 'student'
  role:      text('role').notNull().default('student'),
  // 'active' | 'inactive' | 'pending'
  status:    text('status').notNull().default('active'),
  studentId: text('student_id').unique(),
  batch:     text('batch'),
  class:     text('class'),
  notes:     text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── User Access ──────────────────────────────────────────────────────────────
// Each row = one product a user has access to.
// Products: 'iba' | 'fbs' | 'fbs_detailed'
//   iba         → DU IBA + BUP IBA mocks
//   fbs         → DU FBS + BUP FBS mocks + accounting game
//   fbs_detailed → FBS detailed content

export const userAccess = sqliteTable('user_access', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  product:   text('product').notNull(),
  active:    integer('active', { mode: 'boolean' }).notNull().default(true),
  grantedAt: integer('granted_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  grantedBy: integer('granted_by').references(() => users.id),
}, (t) => [unique().on(t.userId, t.product)]);

// ─── Math Scores ──────────────────────────────────────────────────────────────

export const mathScores = sqliteTable('math_scores', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  playerEmail:       text('player_email').notNull(),
  playerName:        text('player_name'),
  score:             integer('score').notNull(),
  questionsCorrect:  integer('questions_correct').notNull(),
  questionsAnswered: integer('questions_answered').notNull(),
  accuracy:          real('accuracy'),
  difficulty:        text('difficulty'),
  operations:        text('operations'),   // JSON array
  timeLimit:         real('time_limit'),
  isAdmin:           integer('is_admin', { mode: 'boolean' }).default(false),
  playedAt:          integer('played_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Vocab Scores ─────────────────────────────────────────────────────────────

export const vocabScores = sqliteTable('vocab_scores', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  playerEmail:       text('player_email').notNull(),
  playerName:        text('player_name'),
  questionsAnswered: integer('questions_answered').notNull(),
  questionsCorrect:  integer('questions_correct').notNull(),
  totalSections:     integer('total_sections'),
  selectedSections:  text('selected_sections'),  // JSON array
  difficulty:        text('difficulty'),
  isAdmin:           integer('is_admin', { mode: 'boolean' }).default(false),
  playedAt:          integer('played_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Accounting Scores ────────────────────────────────────────────────────────

export const accountingScores = sqliteTable('accounting_scores', {
  id:                    integer('id').primaryKey({ autoIncrement: true }),
  playerEmail:           text('player_email').notNull(),
  playerName:            text('player_name'),
  simpleScore:           real('simple_score').notNull(),
  dynamicScore:          real('dynamic_score').notNull(),
  totalSpeedBonus:       real('total_speed_bonus').default(0),
  lectureCoverageBonus:  real('lecture_coverage_bonus').default(0),
  questionsAnswered:     integer('questions_answered').notNull(),
  correctAnswers:        integer('correct_answers'),
  wrongAnswers:          integer('wrong_answers'),
  skippedAnswers:        integer('skipped_answers'),
  accuracy:              real('accuracy'),
  selectedLectures:      text('selected_lectures'),  // JSON array
  timeTaken:             integer('time_taken'),
  isAdmin:               integer('is_admin', { mode: 'boolean' }).default(false),
  playedAt:              integer('played_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Accounting Progress ──────────────────────────────────────────────────────

export const accountingProgress = sqliteTable('accounting_progress', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  playerEmail:       text('player_email').notNull().unique(),
  masteredQuestions: text('mastered_questions').notNull().default('[]'),  // JSON array of question IDs
  lectureProgress:   text('lecture_progress').notNull().default('{}'),    // JSON map
  totalMastered:     integer('total_mastered').notNull().default(0),
  totalQuestions:    integer('total_questions').notNull().default(281),
  lastUpdated:       integer('last_updated', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt:         integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:         integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Registrations ────────────────────────────────────────────────────────────

export const registrations = sqliteTable('registrations', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  name:                 text('name').notNull(),
  email:                text('email').notNull(),
  phone:                text('phone').notNull(),
  educationType:        text('education_type'),       // 'hsc' | 'alevels'
  hscYear:              text('hsc_year'),
  sscYear:              text('ssc_year'),
  aLevelYear:           text('a_level_year'),
  oLevelYear:           text('o_level_year'),
  programMode:          text('program_mode'),          // 'mocks' | 'full'
  selectedMocks:        text('selected_mocks'),        // JSON array
  mockIntent:           text('mock_intent'),           // 'trial' | 'full'
  selectedFullCourses:  text('selected_full_courses'), // JSON array
  pricingSubtotal:      real('pricing_subtotal'),
  pricingDiscount:      real('pricing_discount'),
  pricingFinalPrice:    real('pricing_final_price'),
  referralName:         text('referral_name'),
  referralInstitution:  text('referral_institution'),
  referralBatch:        text('referral_batch'),
  // 'pending' | 'contacted' | 'enrolled' | 'cancelled'
  status:               text('status').notNull().default('pending'),
  notes:                text('notes'),
  createdAt:            integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:            integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User         = typeof users.$inferSelect;
export type NewUser      = typeof users.$inferInsert;
export type UserAccess   = typeof userAccess.$inferSelect;
export type Registration = typeof registrations.$inferSelect;

export type UserProduct = 'iba' | 'fbs' | 'fbs_detailed';
export type UserRole    = 'super_admin' | 'admin' | 'instructor' | 'student';
export type UserStatus  = 'active' | 'inactive' | 'pending';

export interface UserWithProducts extends User {
  products: UserProduct[];
}

// ══════════════════════════════════════════════════════════════════════════════
// LEXICORE — Vocabulary Learning App
// ══════════════════════════════════════════════════════════════════════════════

// ─── Content ──────────────────────────────────────────────────────────────────

export const vocabUnits = sqliteTable('vocab_units', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  name:        text('name').notNull(),
  description: text('description'),
  order:       integer('order').notNull().default(0),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const vocabThemes = sqliteTable('vocab_themes', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  unitId:    integer('unit_id').notNull().references(() => vocabUnits.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  order:     integer('order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const vocabWords = sqliteTable('vocab_words', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  themeId:         integer('theme_id').notNull().references(() => vocabThemes.id, { onDelete: 'cascade' }),
  unitId:          integer('unit_id').notNull().references(() => vocabUnits.id, { onDelete: 'cascade' }),
  word:            text('word').notNull(),
  definition:      text('definition').notNull(),
  synonyms:        text('synonyms').notNull().default('[]'),      // JSON string[]
  antonyms:        text('antonyms').notNull().default('[]'),      // JSON string[]
  exampleSentence: text('example_sentence').notNull(),
  partOfSpeech:    text('part_of_speech').notNull(),
  difficultyBase:  integer('difficulty_base').notNull().default(3), // 1–5
  createdAt:       integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:       integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_vocab_words_theme_id').on(t.themeId),
]);

// ─── User Progress ────────────────────────────────────────────────────────────
// One row per user — overall stats, streak, points, deadline, phase.

export const vocabUserProgress = sqliteTable('vocab_user_progress', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  userId:               integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  // 1 = full access (phase 1 / admin-upgraded), 2 = limited (Units 1–8 only)
  phase:                integer('phase').notNull().default(2),
  totalPoints:          integer('total_points').notNull().default(0),
  weeklyPoints:         integer('weekly_points').notNull().default(0),
  streakDays:           integer('streak_days').notNull().default(0),
  longestStreak:        integer('longest_streak').notNull().default(0),
  lastStudyDate:        integer('last_study_date', { mode: 'timestamp' }),
  deadline:             integer('deadline', { mode: 'timestamp' }),
  dailyTarget:          integer('daily_target').notNull().default(10),
  onboardingComplete:   integer('onboarding_complete', { mode: 'boolean' }).notNull().default(false),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).notNull().default(false),
  emailSummaryEnabled:  integer('email_summary_enabled', { mode: 'boolean' }).notNull().default(true),
  pushSubscription:     text('push_subscription'), // JSON string of PushSubscriptionJSON
  dailyMessage:         text('daily_message'),
  dailyMessageDate:     text('daily_message_date'),  // ISO date string "2026-04-15"
  createdAt:            integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:            integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Per-Word Mastery ─────────────────────────────────────────────────────────
// One row per (user × word) pair — mastery score, SRS state, accuracy stats.

export const vocabUserWordRecords = sqliteTable('vocab_user_word_records', {
  id:                    integer('id').primaryKey({ autoIncrement: true }),
  userId:                integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wordId:                integer('word_id').notNull().references(() => vocabWords.id, { onDelete: 'cascade' }),
  // Mastery
  masteryScore:          real('mastery_score').notNull().default(0),
  // 'new' | 'learning' | 'familiar' | 'strong' | 'mastered'
  masteryLevel:          text('mastery_level').notNull().default('new'),
  // SRS (SM-2)
  srsIntervalDays:       integer('srs_interval_days').notNull().default(1),
  srsEaseFactor:         real('srs_ease_factor').notNull().default(2.5),
  srsNextReviewDate:     integer('srs_next_review_date', { mode: 'timestamp' }),
  srsRepetitions:        integer('srs_repetitions').notNull().default(0),
  inSrsPool:             integer('in_srs_pool', { mode: 'boolean' }).notNull().default(false),
  // Quiz stats
  totalAttempts:         integer('total_attempts').notNull().default(0),
  correctAttempts:       integer('correct_attempts').notNull().default(0),
  accuracyRate:          real('accuracy_rate').notNull().default(0),
  consecutiveCorrect:    integer('consecutive_correct').notNull().default(0),
  consecutiveWrong:      integer('consecutive_wrong').notNull().default(0),
  timesAsDistractor:     integer('times_as_distractor').notNull().default(0),
  exposureCount:         integer('exposure_count').notNull().default(0),
  exposurePoints:        real('exposure_points').notNull().default(0),  // cap 10
  // Flashcard self-assessment counts
  flashcardGotItCount:   integer('flashcard_got_it_count').notNull().default(0),
  flashcardUnsureCount:  integer('flashcard_unsure_count').notNull().default(0),
  flashcardMissedCount:  integer('flashcard_missed_count').notNull().default(0),
  // Timestamps
  lastInteractionAt:     integer('last_interaction_at', { mode: 'timestamp' }),
  lastSeenAt:            integer('last_seen_at', { mode: 'timestamp' }),
  lastCorrectAt:         integer('last_correct_at', { mode: 'timestamp' }),
  longGapCorrect:        integer('long_gap_correct', { mode: 'boolean' }).notNull().default(false),
  createdAt:             integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:             integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  unique().on(t.userId, t.wordId),
  index('idx_uwr_srs_due').on(t.userId, t.inSrsPool, t.srsNextReviewDate),
  index('idx_uwr_mastery').on(t.userId, t.masteryLevel),
]);

// ─── Confusion Pairs ──────────────────────────────────────────────────────────
// Tracks which words a user confuses with which other words.

export const vocabConfusionPairs = sqliteTable('vocab_confusion_pairs', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wordAId:   integer('word_a_id').notNull().references(() => vocabWords.id, { onDelete: 'cascade' }),
  wordBId:   integer('word_b_id').notNull().references(() => vocabWords.id, { onDelete: 'cascade' }),
  count:     integer('count').notNull().default(1),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [unique().on(t.userId, t.wordAId, t.wordBId)]);

// ─── Flashcard Sessions ───────────────────────────────────────────────────────
// One active session per (user × theme) — supports resume.

export const vocabFlashcardSessions = sqliteTable('vocab_flashcard_sessions', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  userId:           integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  themeId:          integer('theme_id').notNull().references(() => vocabThemes.id, { onDelete: 'cascade' }),
  currentCardIndex: integer('current_card_index').notNull().default(0),
  totalCards:       integer('total_cards').notNull(),
  // JSON: { [wordId]: 'got_it' | 'unsure' | 'missed_it' }
  ratings:          text('ratings').notNull().default('{}'),
  // 'in_progress' | 'complete'
  status:           text('status').notNull().default('in_progress'),
  startedAt:        integer('started_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  completedAt:      integer('completed_at', { mode: 'timestamp' }),
}, (t) => [unique().on(t.userId, t.themeId)]);

// ─── Quiz Sessions ────────────────────────────────────────────────────────────

export const vocabQuizSessions = sqliteTable('vocab_quiz_sessions', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  userId:         integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // null for practice quiz (spans multiple themes)
  themeId:        integer('theme_id').references(() => vocabThemes.id),
  // 'study' | 'practice'
  sessionType:    text('session_type').notNull(),
  // JSON: array of generated question objects
  questions:      text('questions').notNull().default('[]'),
  // 'in_progress' | 'complete'
  status:         text('status').notNull().default('in_progress'),
  totalQuestions: integer('total_questions').notNull(),
  correctAnswers: integer('correct_answers').notNull().default(0),
  score:          integer('score'),
  passed:         integer('passed', { mode: 'boolean' }),
  // 'beginner' | 'intermediate' | 'advanced'
  difficultyLevel: text('difficulty_level').notNull().default('beginner'),
  // Quiz config (from QuizConfigSheet)
  questionCount:    integer('question_count'),
  timedMode:        integer('timed_mode', { mode: 'boolean' }),
  secondsPerQuestion: integer('seconds_per_question'),
  // Letter-based sessions (null = theme-based or practice)
  letterGroup:      text('letter_group'),
  startedAt:      integer('started_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  completedAt:    integer('completed_at', { mode: 'timestamp' }),
}, (t) => [
  index('idx_quiz_sessions_user_status').on(t.userId, t.status, t.sessionType),
]);

// ─── Quiz Answers ─────────────────────────────────────────────────────────────

export const vocabQuizAnswers = sqliteTable('vocab_quiz_answers', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  sessionId:      integer('session_id').notNull().references(() => vocabQuizSessions.id, { onDelete: 'cascade' }),
  userId:         integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wordId:         integer('word_id').notNull().references(() => vocabWords.id, { onDelete: 'cascade' }),
  selectedWordId: integer('selected_word_id').references(() => vocabWords.id),
  isCorrect:      integer('is_correct', { mode: 'boolean' }).notNull(),
  pointsEarned:   integer('points_earned').notNull().default(0),
  // 'fill_blank' | 'analogy' | 'correct_usage'
  questionType:   text('question_type').notNull(),
  answeredAt:     integer('answered_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Badges ───────────────────────────────────────────────────────────────────
// One row per (user × badge) — tracks progress and earned status.

export const vocabUserBadges = sqliteTable('vocab_user_badges', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // slug: 'first_step' | 'quiz_starter' | 'on_a_roll' | 'week_warrior' | ...
  badgeId:   text('badge_id').notNull(),
  progress:  integer('progress').notNull().default(0),
  earnedAt:  integer('earned_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [unique().on(t.userId, t.badgeId)]);

// ─── Weekly Leaderboard ───────────────────────────────────────────────────────

export const vocabWeeklyLeaderboard = sqliteTable('vocab_weekly_leaderboard', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekStart: integer('week_start', { mode: 'timestamp' }).notNull(),
  points:    integer('points').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [unique().on(t.userId, t.weekStart)]);

// ─── Hall of Fame ─────────────────────────────────────────────────────────────

export const vocabHallOfFame = sqliteTable('vocab_hall_of_fame', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  sessionLabel: text('session_label').notNull(),
  rank:         integer('rank').notNull(),                 // 1 | 2 | 3
  userId:       integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  displayName:  text('display_name').notNull(),
  points:       integer('points').notNull(),
  weekEndDate:  integer('week_end_date', { mode: 'timestamp' }).notNull(),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Admin Settings ───────────────────────────────────────────────────────────
// Key-value store for configurable settings.
// Keys: 'phase_cutoff_date' | 'quiz_pass_threshold' | 'ultimate_achievements_visible'

export const vocabAdminSettings = sqliteTable('vocab_admin_settings', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  key:       text('key').notNull().unique(),
  value:     text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Upgrade Interest (WTP) ───────────────────────────────────────────────────
// Non-VH-students expressing willingness-to-pay for full access.

export const vocabUpgradeRequests = sqliteTable('vocab_upgrade_requests', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  userId:         integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'tutor' | 'printing' | 'notebook' | 'nothing'
  selectedOption: text('selected_option').notNull(),
  submittedAt:    integer('submitted_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [unique().on(t.userId)]);

// ─── Access Requests ──────────────────────────────────────────────────────────
// Phase-2 users requesting full (phase-1) access.

export const vocabAccessRequests = sqliteTable('vocab_access_requests', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  whatsapp:  text('whatsapp'),
  message:   text('message'),
  // 'pending' | 'approved' | 'rejected'
  status:    text('status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── LexiCore Type Exports ────────────────────────────────────────────────────

export type VocabUnit             = typeof vocabUnits.$inferSelect;
export type VocabTheme            = typeof vocabThemes.$inferSelect;
export type VocabWord             = typeof vocabWords.$inferSelect;
export type VocabUserProgress     = typeof vocabUserProgress.$inferSelect;
export type VocabUserWordRecord   = typeof vocabUserWordRecords.$inferSelect;
export type VocabFlashcardSession = typeof vocabFlashcardSessions.$inferSelect;
export type VocabQuizSession      = typeof vocabQuizSessions.$inferSelect;
export type VocabQuizAnswer       = typeof vocabQuizAnswers.$inferSelect;
export type VocabUserBadge        = typeof vocabUserBadges.$inferSelect;

export type VocabMasteryLevel = 'new' | 'learning' | 'familiar' | 'strong' | 'mastered';
export type VocabPhase        = 1 | 2;
export type VocabSessionType  = 'study' | 'practice';
export type VocabQuestionType = 'fill_blank' | 'analogy' | 'correct_usage';
export type VocabRating       = 'got_it' | 'unsure' | 'missed_it';
