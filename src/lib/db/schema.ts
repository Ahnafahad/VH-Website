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
  whatsapp:          text('whatsapp'),
  isTeaching:        integer('is_teaching', { mode: 'boolean' }).default(false),
  onboardingSkips:   integer('onboarding_skips').notNull().default(0),
  onboardedAt:       integer('onboarded_at', { mode: 'timestamp' }),
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

// ─── Math Sessions ────────────────────────────────────────────────────────────
// One row per started game. Replaces math_scores for new flow but math_scores
// is still dual-written for legacy leaderboard compatibility.

export const mathSessions = sqliteTable('math_sessions', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  userId:            integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  operations:        text('operations').notNull(),      // JSON string[]
  startDifficulty:   real('start_difficulty').notNull(),
  adaptive:          integer('adaptive', { mode: 'boolean' }).notNull().default(false),
  timeLimit:         real('time_limit').notNull(),      // minutes
  totalScore:        integer('total_score').notNull().default(0),
  questionsAnswered: integer('questions_answered').notNull().default(0),
  questionsCorrect:  integer('questions_correct').notNull().default(0),
  endingSkill:       text('ending_skill'),              // JSON { addition: 2.8, ... }
  // 'in_progress' | 'complete' | 'abandoned'
  status:            text('status').notNull().default('in_progress'),
  startedAt:         integer('started_at',  { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  finishedAt:        integer('finished_at', { mode: 'timestamp' }),
}, (t) => [
  index('idx_math_sessions_user_started').on(t.userId, t.startedAt),
]);

// ─── Math Question Attempts ───────────────────────────────────────────────────
// One row per question answered/skipped within a session.

export const mathQuestionAttempts = sqliteTable('math_question_attempts', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  sessionId:      integer('session_id').notNull().references(() => mathSessions.id, { onDelete: 'cascade' }),
  userId:         integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  operation:      text('operation').notNull(),
  difficulty:     real('difficulty').notNull(),
  num1:           integer('num1').notNull(),
  num2:           integer('num2').notNull(),
  correctAnswer:  integer('correct_answer').notNull(),
  userAnswer:     integer('user_answer'),
  isCorrect:      integer('is_correct',   { mode: 'boolean' }).notNull(),
  wasSkipped:     integer('was_skipped',  { mode: 'boolean' }).notNull().default(false),
  responseTimeMs: integer('response_time_ms').notNull(),
  wasSuspicious:  integer('was_suspicious', { mode: 'boolean' }).notNull().default(false),
  pointsEarned:   integer('points_earned').notNull().default(0),
  answeredAt:     integer('answered_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_mqa_user_op_time').on(t.userId, t.operation, t.answeredAt),
  index('idx_mqa_session').on(t.sessionId),
]);

// ─── Math User Progress ───────────────────────────────────────────────────────
// Per-user rollup: totals, adaptive skill state, settings.

export const mathUserProgress = sqliteTable('math_user_progress', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  userId:              integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  totalGames:          integer('total_games').notNull().default(0),
  totalQuestions:      integer('total_questions').notNull().default(0),
  totalCorrect:        integer('total_correct').notNull().default(0),
  overallAccuracy:     real('overall_accuracy').notNull().default(0),
  bestScore:           integer('best_score').notNull().default(0),
  skillAddition:       real('skill_addition').notNull().default(2.5),
  skillSubtraction:    real('skill_subtraction').notNull().default(2.5),
  skillMultiplication: real('skill_multiplication').notNull().default(2.5),
  skillDivision:       real('skill_division').notNull().default(2.5),
  preferredDifficulty: real('preferred_difficulty').notNull().default(2.5),
  soundEnabled:        integer('sound_enabled',   { mode: 'boolean' }).notNull().default(true),
  hapticsEnabled:      integer('haptics_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt:           integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:           integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
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
  // Email delivery tracking — 'sent' | 'failed' | null (null = not attempted yet)
  studentEmailStatus:   text('student_email_status'),
  adminEmailStatus:     text('admin_email_status'),
  createdAt:            integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:            integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Free Signups ─────────────────────────────────────────────────────────────
// Path A registrations — users who want free games/resources access only.
// Row in `users` is created simultaneously; this table stores the WhatsApp contact.

export const freeSignups = sqliteTable('free_signups', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  email:     text('email').notNull().unique(),
  whatsapp:  text('whatsapp').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User         = typeof users.$inferSelect;
export type NewUser      = typeof users.$inferInsert;
export type UserAccess   = typeof userAccess.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type FreeSignup   = typeof freeSignups.$inferSelect;
export type NewFreeSignup = typeof freeSignups.$inferInsert;

export type UserProduct = 'iba' | 'fbs' | 'fbs_detailed';
export type UserRole    = 'super_admin' | 'admin' | 'instructor' | 'student';
export type UserStatus  = 'active' | 'inactive' | 'pending';

export type MathSession         = typeof mathSessions.$inferSelect;
export type NewMathSession      = typeof mathSessions.$inferInsert;
export type MathQuestionAttempt = typeof mathQuestionAttempts.$inferSelect;
export type NewMathAttempt      = typeof mathQuestionAttempts.$inferInsert;
export type MathUserProgress    = typeof mathUserProgress.$inferSelect;
export type NewMathUserProgress = typeof mathUserProgress.$inferInsert;
export type MathOperation       = 'addition' | 'subtraction' | 'multiplication' | 'division';
export type MathSessionStatus   = 'in_progress' | 'complete' | 'abandoned';

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
  // Word Charge connotation: 'positive' | 'negative' | 'inapplicable' | NULL
  connotation:     text('connotation'),
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
  // Set once the student has set (or dismissed) a target date after being
  // upgraded to full access (phase 1). Null = still needs to be asked.
  fullAccessDeadlineSetAt: integer('full_access_deadline_set_at', { mode: 'timestamp' }),
  dailyTarget:          integer('daily_target').notNull().default(10),
  learningGoal:         text('learning_goal').notNull().default('general'),
  onboardingComplete:   integer('onboarding_complete', { mode: 'boolean' }).notNull().default(false),
  onboardingCompletedAt: integer('onboarding_completed_at', { mode: 'timestamp' }),
  activatedAt:          integer('activated_at', { mode: 'timestamp' }),
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
}, (t) => [
  unique('uq_vocab_quiz_answer_session_word').on(t.sessionId, t.wordId),
]);

// ─── SRS Events (audit trail) ────────────────────────────────────────────────
// One row per flashcard rating or quiz answer. Lets us trace how each word's
// SRS interval and mastery evolve over time — essential for validating the
// spaced-repetition engine against real user data.

export const vocabSrsEvents = sqliteTable('vocab_srs_events', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  userId:           integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wordId:           integer('word_id').notNull().references(() => vocabWords.id, { onDelete: 'cascade' }),
  // 'flashcard' | 'quiz'
  eventType:        text('event_type').notNull(),
  // flashcard: 'got_it' | 'unsure' | 'missed_it'  /  quiz: 'correct' | 'wrong'
  rating:           text('rating').notNull(),
  masteryBefore:    real('mastery_before').notNull(),
  masteryAfter:     real('mastery_after').notNull(),
  intervalBefore:   real('interval_before').notNull(),   // srs_interval_days before
  intervalAfter:    real('interval_after').notNull(),    // srs_interval_days after
  repetitionsBefore: integer('repetitions_before').notNull(),
  repetitionsAfter:  integer('repetitions_after').notNull(),
  nextReviewBefore: integer('next_review_before', { mode: 'timestamp' }),
  nextReviewAfter:  integer('next_review_after',  { mode: 'timestamp' }),
  createdAt:        integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_srs_events_user_word').on(t.userId, t.wordId),
  index('idx_srs_events_user_time').on(t.userId, t.createdAt),
]);

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

// ─── Workbook Tables ──────────────────────────────────────────────────────────

export const workbookChapterProgress = sqliteTable('workbook_chapter_progress', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  userId:      integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chapterSlug: text('chapter_slug').notNull(),
  // 'not_started' | 'in_progress' | 'completed'
  status:      text('status').notNull().default('not_started'),
  lastAnchor:  text('last_anchor'),
  percentRead: integer('percent_read').notNull().default(0),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:   integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (t) => [
  unique().on(t.userId, t.chapterSlug),
  index('idx_wcp_user_id').on(t.userId),
]);

export const workbookBookmarks = sqliteTable('workbook_bookmarks', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  userId:      integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chapterSlug: text('chapter_slug').notNull(),
  anchor:      text('anchor').notNull(),
  label:       text('label'),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_wb_user_chapter').on(t.userId, t.chapterSlug),
]);

export const workbookMcqAttempts = sqliteTable('workbook_mcq_attempts', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  userId:         integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chapterSlug:    text('chapter_slug').notNull(),
  questionId:     text('question_id').notNull(),
  selectedOption: text('selected_option').notNull(),
  isCorrect:      integer('is_correct', { mode: 'boolean' }).notNull(),
  attemptedAt:    integer('attempted_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_wma_user_chapter').on(t.userId, t.chapterSlug),
]);

export type WorkbookChapterProgress = typeof workbookChapterProgress.$inferSelect;
export type WorkbookBookmark        = typeof workbookBookmarks.$inferSelect;
export type WorkbookMcqAttempt      = typeof workbookMcqAttempts.$inferSelect;
export type WorkbookProgressStatus  = 'not_started' | 'in_progress' | 'completed';

// ─── Error Logs ───────────────────────────────────────────────────────────────
// Server-side LexiCore failure log: quiz generation AI failures, API 5xx errors,
// and merged client_error/unhandled_rejection analytics events (source='client').
// Rows older than 30 days are pruned on each admin fetch.

export const vocabErrorLogs = sqliteTable('vocab_error_logs', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
  // 'quiz_generation' | 'api' | 'client'
  source:    text('source').notNull(),
  // 'error' | 'warning'
  severity:  text('severity').notNull().default('error'),
  context:   text('context').notNull(),   // route path or operation name
  message:   text('message').notNull(),
  detail:    text('detail'),              // JSON string, max 8000 chars
  userEmail: text('user_email'),
}, (t) => [
  index('idx_vocab_error_logs_created_at').on(t.createdAt),
]);

// ─── Word Hunt Game ────────────────────────────────────────────────────────────
// Daily Wordle-style vocabulary guessing game. One round per calendar day
// (Dhaka/UTC+6). content stores the JSON-serialized RoundContent (see
// src/lib/vocab/game/types.ts) — clues, accepted answers, teaching feedback.

export const vocabGameRounds = sqliteTable('vocab_game_rounds', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  roundDate: text('round_date').notNull().unique(),   // ISO 'YYYY-MM-DD', Dhaka calendar day
  wordId:    integer('word_id').notNull().references(() => vocabWords.id, { onDelete: 'cascade' }),
  content:   text('content').notNull(),               // JSON RoundContent
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const vocabGameSessions = sqliteTable('vocab_game_sessions', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  userId:         integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roundId:        integer('round_id').notNull().references(() => vocabGameRounds.id, { onDelete: 'cascade' }),
  // 'in_progress' | 'won' | 'lost'
  status:         text('status').notNull().default('in_progress'),
  guessCount:     integer('guess_count').notNull().default(0),      // consumed attempts (1-6)
  wordPoints:     integer('word_points').notNull().default(0),
  sentencePoints: integer('sentence_points').notNull().default(0),
  isCatchUp:      integer('is_catch_up', { mode: 'boolean' }).notNull().default(false),
  startedAt:      integer('started_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  completedAt:    integer('completed_at', { mode: 'timestamp' }),
}, (t) => [
  unique().on(t.userId, t.roundId),
  index('idx_game_sessions_user_status').on(t.userId, t.status),
]);

export const vocabGameGuesses = sqliteTable('vocab_game_guesses', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  sessionId:            integer('session_id').notNull().references(() => vocabGameSessions.id, { onDelete: 'cascade' }),
  userId:               integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  guessNumber:          integer('guess_number').notNull(),   // 1-6
  word:                 text('word').notNull(),
  normalizedWord:       text('normalized_word').notNull(),
  sentence:             text('sentence').notNull(),          // latest submitted sentence
  // 'pending' | 'accepted_clear' | 'accepted_basic' | 'accepted_revised' | 'rejected'
  sentenceStatus:       text('sentence_status').notNull().default('pending'),
  revisionCount:        integer('revision_count').notNull().default(0),
  sentenceFeedback:     text('sentence_feedback'),            // latest judge explanation
  // 'correct' | 'very_close' | 'related' | 'same_topic' | 'opposite' | 'unrelated'
  relation:             text('relation'),
  relationFeedback:     text('relation_feedback'),
  sentencePointsEarned: integer('sentence_points_earned').notNull().default(0),
  createdAt:            integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:            integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  unique().on(t.sessionId, t.guessNumber),
]);

// ─── Word Charge Rounds ───────────────────────────────────────────────────────
// One row per started round. wordIds/answers are JSON-serialised arrays.

export const vocabChargeRounds = sqliteTable('vocab_charge_rounds', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  userId:       integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'active' | 'finished'
  status:       text('status').notNull().default('active'),
  wordIds:      text('word_ids').notNull(),      // JSON int[] — order preserved
  answers:      text('answers'),                  // JSON ChargeAnswer[] | null until finish
  correctCount: integer('correct_count').notNull().default(0),
  wrongCount:   integer('wrong_count').notNull().default(0),
  helpedCount:  integer('helped_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  bestStreak:   integer('best_streak').notNull().default(0),
  pointsEarned: integer('points_earned').notNull().default(0),
  startedAt:    integer('started_at',  { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  finishedAt:   integer('finished_at', { mode: 'timestamp' }),
}, (t) => [
  index('idx_charge_rounds_user').on(t.userId, t.startedAt),
]);

// ─── LexiCore Type Exports ────────────────────────────────────────────────────

export type VocabUnit             = typeof vocabUnits.$inferSelect;
export type VocabTheme            = typeof vocabThemes.$inferSelect;
export type VocabWord             = typeof vocabWords.$inferSelect;
export type VocabUserProgress     = typeof vocabUserProgress.$inferSelect;
export type VocabUserWordRecord   = typeof vocabUserWordRecords.$inferSelect;
export type VocabFlashcardSession = typeof vocabFlashcardSessions.$inferSelect;
export type VocabQuizSession      = typeof vocabQuizSessions.$inferSelect;
export type VocabQuizAnswer       = typeof vocabQuizAnswers.$inferSelect;
export type VocabSrsEvent         = typeof vocabSrsEvents.$inferSelect;
export type VocabUserBadge        = typeof vocabUserBadges.$inferSelect;
export type VocabGameRound        = typeof vocabGameRounds.$inferSelect;
export type VocabGameSession      = typeof vocabGameSessions.$inferSelect;
export type VocabGameGuess        = typeof vocabGameGuesses.$inferSelect;
export type VocabChargeRound      = typeof vocabChargeRounds.$inferSelect;
export type NewVocabChargeRound   = typeof vocabChargeRounds.$inferInsert;

export type VocabErrorLog     = typeof vocabErrorLogs.$inferSelect;
export type NewVocabErrorLog  = typeof vocabErrorLogs.$inferInsert;

export type VocabMasteryLevel = 'new' | 'learning' | 'familiar' | 'strong' | 'mastered';
export type VocabPhase        = 1 | 2;
export type VocabSessionType  = 'study' | 'practice';
// Recognition (MCQ): fill_blank, analogy, correct_usage, synonym, antonym.
// Production (typed recall): type_word (definition → type the word),
// type_cloze (sentence with blank → type the word).
export type VocabQuestionType =
  | 'fill_blank' | 'analogy' | 'correct_usage'
  | 'synonym' | 'antonym'
  | 'type_word' | 'type_cloze';
export type VocabRating       = 'got_it' | 'unsure' | 'missed_it';

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS — Behavioral / clickstream tracking (anonymous + logged-in)
// ══════════════════════════════════════════════════════════════════════════════

// ─── Analytics Sessions ───────────────────────────────────────────────────────
// One row per visit. A "session" is a continuous period of activity from one
// device/tab group. anonId is a stable per-browser id (localStorage); userId is
// attached once the visitor authenticates (may stay null for anonymous visits).

export const analyticsSessions = sqliteTable('analytics_sessions', {
  id:              text('id').primaryKey(),                 // client-generated uuid
  anonId:          text('anon_id').notNull(),               // stable per-browser id
  userId:          integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  isAuthenticated: integer('is_authenticated', { mode: 'boolean' }).notNull().default(false),
  entryPath:       text('entry_path'),
  exitPath:        text('exit_path'),
  referrer:        text('referrer'),
  utmSource:       text('utm_source'),
  utmMedium:       text('utm_medium'),
  utmCampaign:     text('utm_campaign'),
  device:          text('device'),                          // 'mobile' | 'tablet' | 'desktop'
  userAgent:       text('user_agent'),
  pageCount:       integer('page_count').notNull().default(0),
  eventCount:      integer('event_count').notNull().default(0),
  durationMs:      integer('duration_ms').notNull().default(0),
  startedAt:       integer('started_at',  { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastSeenAt:      integer('last_seen_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_an_sessions_started').on(t.startedAt),
  index('idx_an_sessions_user').on(t.userId, t.startedAt),
  index('idx_an_sessions_anon').on(t.anonId),
]);

// ─── Analytics Events ─────────────────────────────────────────────────────────
// One row per tracked event. Pageviews, page-exits (carry time-on-page in
// durationMs), feature clicks, and arbitrary custom events.

export const analyticsEvents = sqliteTable('analytics_events', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  sessionId:  text('session_id').notNull(),
  anonId:     text('anon_id').notNull(),
  userId:     integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  // 'pageview' | 'page_exit' | 'feature' | 'click' | 'custom'
  type:       text('type').notNull(),
  // 'site' | 'vocab' | 'math' | 'accounting' | 'workbook' | 'auth' | 'admin'
  module:     text('module'),
  path:       text('path'),
  name:       text('name'),                                 // feature/event name
  props:      text('props'),                                // JSON blob
  durationMs: integer('duration_ms'),                       // time-on-page for page_exit
  createdAt:  integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_an_events_created').on(t.createdAt),
  index('idx_an_events_type_created').on(t.type, t.createdAt),
  index('idx_an_events_module_created').on(t.module, t.createdAt),
  index('idx_an_events_user_created').on(t.userId, t.createdAt),
  index('idx_an_events_session').on(t.sessionId),
  index('idx_an_events_name').on(t.name),
]);

export type AnalyticsSession    = typeof analyticsSessions.$inferSelect;
export type NewAnalyticsSession = typeof analyticsSessions.$inferInsert;
export type AnalyticsEvent      = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent   = typeof analyticsEvents.$inferInsert;

export type AnalyticsEventType = 'pageview' | 'page_exit' | 'feature' | 'click' | 'custom';
export type AnalyticsModule    = 'site' | 'vocab' | 'math' | 'accounting' | 'workbook' | 'auth' | 'admin' | 'lms';

// ══════════════════════════════════════════════════════════════════════════════
// ONLINE TESTS — Reusable MCQ test templates, timed windows, attempts, results
// ══════════════════════════════════════════════════════════════════════════════

// ─── Tests ────────────────────────────────────────────────────────────────────
// One row per reusable test template (imported from LaTeX via the test-import
// skill). Access: allowedProducts NULL → every logged-in user; later set a JSON
// array of products (e.g. ["iba"]) to restrict per course without migration.

export const tests = sqliteTable('tests', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  slug:            text('slug').notNull().unique(),
  title:           text('title').notNull(),
  // 'iba' | 'du_fbs'
  bucket:          text('bucket').notNull(),
  description:     text('description'),
  // 'draft' | 'published' | 'archived'
  status:          text('status').notNull().default('draft'),
  allowedProducts: text('allowed_products'),                 // JSON string[] | null = everyone
  // true = FBS public diagnostic; hidden from normal /tests listing
  isDiagnostic:    integer('is_diagnostic', { mode: 'boolean' }).notNull().default(false),
  totalQuestions:  integer('total_questions').notNull().default(0),
  totalMarks:      real('total_marks').notNull().default(0),
  // Set to force-publish results before every window has closed (admin override)
  resultsPublishedAt: integer('results_published_at', { mode: 'timestamp' }),
  sourceFile:      text('source_file'),                      // original .tex filename
  syllabus:        text('syllabus'),                         // LMS: topics covered by this test
  createdBy:       integer('created_by').references(() => users.id),
  createdAt:       integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt:       integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_tests_bucket_status').on(t.bucket, t.status),
]);

// ─── Test Sections ────────────────────────────────────────────────────────────
// Scoring is per section: IBA defaults +1 / −0.25; DU FBS configurable later.

export const testSections = sqliteTable('test_sections', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  testId:           integer('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  order:            integer('order').notNull(),
  title:            text('title').notNull(),
  totalQuestions:   integer('total_questions').notNull().default(0),
  totalMarks:       real('total_marks').notNull().default(0),
  marksPerCorrect:  real('marks_per_correct').notNull().default(1),
  penaltyPerWrong:  real('penalty_per_wrong').notNull().default(0.25),
  thresholdPercent: real('threshold_percent'),               // section pass mark, nullable
}, (t) => [
  index('idx_test_sections_test').on(t.testId, t.order),
]);

// ─── Test Question Groups ─────────────────────────────────────────────────────
// Shared context rendered above the questions that reference it: reading
// passages, analytical scenarios, instruction blocks, or shared option sets
// (e.g. data-sufficiency A–E).

export const testQuestionGroups = sqliteTable('test_question_groups', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  sectionId:     integer('section_id').notNull().references(() => testSections.id, { onDelete: 'cascade' }),
  order:         integer('order').notNull(),
  // 'instruction' | 'passage' | 'scenario' | 'shared_options'
  kind:          text('kind').notNull(),
  title:         text('title'),
  content:       text('content').notNull(),                  // HTML (KaTeX for math)
  sharedOptions: text('shared_options'),                     // JSON [{key,text}] | null
});

// ─── Test Questions ───────────────────────────────────────────────────────────

export const testQuestions = sqliteTable('test_questions', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  sectionId:   integer('section_id').notNull().references(() => testSections.id, { onDelete: 'cascade' }),
  groupId:     integer('group_id').references(() => testQuestionGroups.id, { onDelete: 'set null' }),
  order:       integer('order').notNull(),                   // position within section
  number:      integer('number').notNull(),                  // displayed question number
  // 'mcq' for now; schema extensible to other types later
  type:        text('type').notNull().default('mcq'),
  stem:        text('stem').notNull(),                       // HTML (KaTeX for math)
  options:     text('options').notNull(),                    // JSON [{key:'A',text:string}]
  correctKey:  text('correct_key'),                          // nullable until key is loaded
  imageUrl:    text('image_url'),                            // diagram under /tests/{slug}/
  explanation: text('explanation'),
}, (t) => [
  index('idx_test_questions_section').on(t.sectionId, t.order),
]);

// ─── Test Windows ─────────────────────────────────────────────────────────────
// A scheduled sitting of a test in one mode. Online: window + durationMinutes
// (e.g. 3:00–5:00, 90 min). Offline: the window itself is the answer-entry
// slot (e.g. 3:40–3:50), durationMinutes null.
// Effective state: 'closed' status always wins; 'open' forces open until
// closesAt; 'scheduled' follows opensAt/closesAt automatically.

export const testWindows = sqliteTable('test_windows', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  testId:          integer('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  // 'online' | 'offline'
  mode:            text('mode').notNull(),
  opensAt:         integer('opens_at',  { mode: 'timestamp' }).notNull(),
  closesAt:        integer('closes_at', { mode: 'timestamp' }).notNull(),
  durationMinutes: integer('duration_minutes'),
  // 'scheduled' | 'open' | 'closed'
  status:          text('status').notNull().default('scheduled'),
  createdBy:       integer('created_by').references(() => users.id),
  createdAt:       integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_test_windows_test').on(t.testId, t.opensAt),
]);

// ─── Test Attempts ────────────────────────────────────────────────────────────
// One attempt per student per test (unique) — the row is always reused, never
// duplicated. Reset (2nd tab-leave) wipes answers and bumps resetCount but
// keeps the row. Score fields are computed at submit; rank/percentile are
// computed on demand once results are visible.
//
// Staff exception (admin/super_admin/instructor) on FBS diagnostics: they may
// retake after submitting. A retake reuses the same row (still one row per
// user+test) and resets it to in_progress, stashing the prior score+answers
// in bestSnapshot until the next submit — which keeps whichever of the two is
// better and discards the other. Everyone else is one-and-done.

export const testAttempts = sqliteTable('test_attempts', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  testId:           integer('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  userId:           integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  windowId:         integer('window_id').notNull().references(() => testWindows.id),
  // 'online' | 'offline'
  mode:             text('mode').notNull(),
  // 'in_progress' | 'submitted' | 'banned'
  status:           text('status').notNull().default('in_progress'),
  startedAt:        integer('started_at',   { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  submittedAt:      integer('submitted_at', { mode: 'timestamp' }),
  bannedAt:         integer('banned_at',    { mode: 'timestamp' }),
  tabLeaveCount:    integer('tab_leave_count').notNull().default(0),
  resetCount:       integer('reset_count').notNull().default(0),
  totalScore:       real('total_score'),
  totalCorrect:     integer('total_correct'),
  totalWrong:       integer('total_wrong'),
  totalUnattempted: integer('total_unattempted'),
  sectionScores:    text('section_scores'),                  // JSON per-section breakdown
  // Diagnostic elective mechanic: JSON int[] of the section ids the taker will
  // attempt (2 compulsory English + 2 chosen electives = 4). Null for normal tests.
  chosenSections:   text('chosen_sections'),
  // Staff-only diagnostic retakes: while a retake is in_progress, this JSON
  // snapshot (BestSnapshot, see lib/tests/best-snapshot.ts) holds the prior
  // submission's score + answers so submit can keep whichever is better and
  // restore the loser. Null once resolved — the row's own fields are always
  // the current best. Never set for non-staff or non-diagnostic attempts.
  bestSnapshot:     text('best_snapshot'),
}, (t) => [
  unique().on(t.testId, t.userId),
  index('idx_test_attempts_user').on(t.userId),
  index('idx_test_attempts_test_status').on(t.testId, t.status),
]);

// ─── Test Answers ─────────────────────────────────────────────────────────────

export const testAnswers = sqliteTable('test_answers', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  attemptId:   integer('attempt_id').notNull().references(() => testAttempts.id, { onDelete: 'cascade' }),
  questionId:  integer('question_id').notNull().references(() => testQuestions.id, { onDelete: 'cascade' }),
  selectedKey: text('selected_key'),                         // null = cleared
  flagged:     integer('flagged', { mode: 'boolean' }).notNull().default(false),
  answeredAt:  integer('answered_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  unique().on(t.attemptId, t.questionId),
  index('idx_test_answers_question').on(t.questionId),
]);

// ─── Test Violations ──────────────────────────────────────────────────────────
// Audit log of anti-cheat events; the escalation ladder (warn → reset → ban)
// is enforced server-side from testAttempts.tabLeaveCount.

export const testViolations = sqliteTable('test_violations', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  attemptId: integer('attempt_id').notNull().references(() => testAttempts.id, { onDelete: 'cascade' }),
  // 'tab_leave'
  type:      text('type').notNull().default('tab_leave'),
  // 'warning' | 'reset' | 'ban'
  action:    text('action').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_test_violations_attempt').on(t.attemptId),
]);

// ─── Online Tests Type Exports ────────────────────────────────────────────────

export type Test              = typeof tests.$inferSelect;
export type TestSection       = typeof testSections.$inferSelect;
export type TestQuestionGroup = typeof testQuestionGroups.$inferSelect;
export type TestQuestion      = typeof testQuestions.$inferSelect;
export type TestWindow        = typeof testWindows.$inferSelect;
export type TestAttempt       = typeof testAttempts.$inferSelect;
export type TestAnswer        = typeof testAnswers.$inferSelect;
export type TestViolation     = typeof testViolations.$inferSelect;

export type TestBucket        = 'iba' | 'du_fbs';
export type TestMode          = 'online' | 'offline';
export type TestStatus        = 'draft' | 'published' | 'archived';
export type TestWindowStatus  = 'scheduled' | 'open' | 'closed';
export type TestAttemptStatus = 'in_progress' | 'submitted' | 'banned';
export type TestGroupKind     = 'instruction' | 'passage' | 'scenario' | 'shared_options';
export type TestOption        = { key: string; text: string };

// ══════════════════════════════════════════════════════════════════════════════
// LMS — Live Classes, Recordings, Materials, Homework, Booking
// ══════════════════════════════════════════════════════════════════════════════

// ─── Class Schedules ─────────────────────────────────────────────────────────
// Recurring rules: generator materialises class_sessions 14 days ahead.
// subject: 'english' | 'math' | 'analytical'
// dayOfWeek: 0 = Sunday … 6 = Saturday (Dhaka local)
// timeOfDay: 'HH:mm' Dhaka local

export const classSchedules = sqliteTable('class_schedules', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  titleTemplate:   text('title_template').notNull(),
  subject:         text('subject').notNull(),
  product:         text('product').notNull().default('iba'),
  batch:           text('batch'),                             // null = all batches
  dayOfWeek:       integer('day_of_week').notNull(),          // 0=Sun..6=Sat
  timeOfDay:       text('time_of_day').notNull(),             // 'HH:mm' Dhaka
  durationMinutes: integer('duration_minutes').notNull(),
  active:          integer('active', { mode: 'boolean' }).notNull().default(true),
  createdBy:       integer('created_by').notNull().references(() => users.id),
  createdAt:       integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Class Sessions ───────────────────────────────────────────────────────────
// One row per live class (either from generator or created manually).
// status: 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled'

export const classSessions = sqliteTable('class_sessions', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  scheduleId:      integer('schedule_id').references(() => classSchedules.id, { onDelete: 'set null' }),
  title:           text('title').notNull(),
  description:     text('description'),
  subject:         text('subject').notNull(),
  product:         text('product').notNull().default('iba'),
  batch:           text('batch'),                             // null = all batches
  scheduledAt:     integer('scheduled_at', { mode: 'timestamp' }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  // 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled'
  status:          text('status').notNull().default('scheduled'),
  meetLink:        text('meet_link'),
  googleEventId:   text('google_event_id'),
  recallBotId:     text('recall_bot_id'),
  instructorId:    integer('instructor_id').references(() => users.id),
  topic:           text('topic'),
  classNumber:     integer('class_number'),
  createdBy:       integer('created_by').notNull().references(() => users.id),
  createdAt:       integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_class_sessions_scheduled_at').on(t.scheduledAt),
  index('idx_class_sessions_status').on(t.status, t.scheduledAt),
  index('idx_class_sessions_product_batch').on(t.product, t.batch),
]);

// ─── Class Attendance ─────────────────────────────────────────────────────────
// One row per (session × user) — inserted on first Join click.

export const classAttendance = sqliteTable('class_attendance', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => classSessions.id, { onDelete: 'cascade' }),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt:  integer('joined_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  // 'online' | 'offline' — how the student attended
  mode:      text('mode').notNull().default('offline'),
}, (t) => [
  unique().on(t.sessionId, t.userId),
]);

// ─── Recordings ───────────────────────────────────────────────────────────────
// One row per session. status: 'pending' | 'processing' | 'available' | 'failed' | 'expired'

export const recordings = sqliteTable('recordings', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  classSessionId:   integer('class_session_id').notNull().references(() => classSessions.id, { onDelete: 'cascade' }),
  r2Key:            text('r2_key').notNull(),
  fileSize:         integer('file_size'),
  durationSeconds:  integer('duration_seconds'),
  // 'pending' | 'processing' | 'available' | 'failed' | 'expired'
  status:           text('status').notNull().default('pending'),
  source:           text('source').notNull().default('recall'),
  errorMessage:     text('error_message'),
  createdAt:        integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  unique().on(t.classSessionId),
  index('idx_recordings_status').on(t.status),
]);

// ─── Recording Access Grants ──────────────────────────────────────────────────
// Extension mechanism: userId null = whole batch.

export const recordingAccessGrants = sqliteTable('recording_access_grants', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  recordingId: integer('recording_id').notNull().references(() => recordings.id, { onDelete: 'cascade' }),
  userId:      integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  expiresAt:   integer('expires_at', { mode: 'timestamp' }).notNull(),
  grantedBy:   integer('granted_by').notNull().references(() => users.id),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_rag_recording_user').on(t.recordingId, t.userId),
]);

// ─── Recording Watch Progress ─────────────────────────────────────────────────
// 30s heartbeat upsert from the player. UNIQUE(recordingId, userId).

export const recordingWatchProgress = sqliteTable('recording_watch_progress', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  recordingId:          integer('recording_id').notNull().references(() => recordings.id, { onDelete: 'cascade' }),
  userId:               integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  secondsWatched:       integer('seconds_watched').notNull().default(0),
  lastPositionSeconds:  integer('last_position_seconds').notNull().default(0),
  completedPercent:     integer('completed_percent').notNull().default(0),
  updatedAt:            integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  unique().on(t.recordingId, t.userId),
]);

// ─── Materials ────────────────────────────────────────────────────────────────
// PDFs (Vercel Blob) or links, scoped to subject/product/batch.
// type: 'pdf' | 'link'

export const materials = sqliteTable('materials', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  title:          text('title').notNull(),
  // 'pdf' | 'link'
  type:           text('type').notNull(),
  blobUrl:        text('blob_url').notNull(),
  fileName:       text('file_name'),
  fileSize:       integer('file_size'),
  subject:        text('subject').notNull(),
  product:        text('product').notNull().default('iba'),
  batch:          text('batch'),
  // 'lecture' | 'solution' | 'question_paper' | 'notes' | 'homework' | 'practice' — see src/lib/naming/taxonomy.ts.
  // Distinct from `type` (pdf | link) above — do not confuse the two.
  docType:        text('doc_type'),
  number:         text('number'),
  topic:          text('topic'),
  classSessionId: integer('class_session_id').references(() => classSessions.id, { onDelete: 'set null' }),
  uploadedBy:     integer('uploaded_by').notNull().references(() => users.id),
  createdAt:      integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_materials_session').on(t.classSessionId),
  index('idx_materials_product_batch').on(t.product, t.batch),
]);

// ─── Material Highlights ──────────────────────────────────────────────────────
// Private per-user highlights + notes on PDF materials.

export const materialHighlights = sqliteTable('material_highlights', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  userId:       integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  materialId:   integer('material_id').notNull().references(() => materials.id, { onDelete: 'cascade' }),
  pageNumber:   integer('page_number').notNull(),
  position:     text('position').notNull(),                   // JSON from react-pdf-highlighter
  selectedText: text('selected_text').notNull(),
  note:         text('note'),
  color:        text('color').notNull().default('yellow'),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_mh_user_material').on(t.userId, t.materialId),
]);

// Private per-user freehand drawings on PDF materials. One row per page —
// `strokes` holds the full stroke array (points normalized 0–1 to page
// width/height so they replay correctly at any zoom level).
export const materialDrawings = sqliteTable('material_drawings', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  userId:     integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  materialId: integer('material_id').notNull().references(() => materials.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  strokes:    text('strokes').notNull().default('[]'),         // JSON: { points: {x,y}[], color, width }[]
  updatedAt:  integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  unique('uq_md_user_material_page').on(t.userId, t.materialId, t.pageNumber),
]);

// ─── Assignments ──────────────────────────────────────────────────────────────
// Homework tasks scoped to subject/product/batch.

export const assignments = sqliteTable('assignments', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  title:          text('title').notNull(),
  description:    text('description').notNull(),
  attachmentUrl:  text('attachment_url'),
  materialId:     integer('material_id'),                           // soft FK → materials.id (nullable)
  solutionMaterialId: integer('solution_material_id'),               // soft FK → materials.id (nullable) — instructor's answer key
  subject:        text('subject').notNull(),
  product:        text('product').notNull().default('iba'),
  batch:          text('batch'),
  classSessionId: integer('class_session_id').references(() => classSessions.id, { onDelete: 'set null' }),
  dueAt:          integer('due_at', { mode: 'timestamp' }).notNull(),
  createdBy:      integer('created_by').notNull().references(() => users.id),
  createdAt:      integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_assignments_due').on(t.dueAt),
  index('idx_assignments_product_batch').on(t.product, t.batch),
]);

// ─── Assignment Submissions ───────────────────────────────────────────────────
// UNIQUE(assignmentId, userId). "pending" = no row exists.
// status: 'submitted' | 'reviewed'
// mode: 'file' (uploaded a PDF) | 'offline' (will show physical work in next class)
// offlineChecked: instructor's own tracking mark for mode='offline' rows — does NOT gate solution access

export const assignmentSubmissions = sqliteTable('assignment_submissions', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  assignmentId:      integer('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  userId:            integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'submitted' | 'reviewed'
  status:            text('status').notNull().default('submitted'),
  // 'file' | 'offline'
  mode:              text('mode').notNull().default('file'),
  offlineChecked:    integer('offline_checked', { mode: 'boolean' }).notNull().default(false),
  fileUrl:           text('file_url'),
  note:              text('note'),
  instructorComment: text('instructor_comment'),
  submittedAt:       integer('submitted_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  reviewedAt:        integer('reviewed_at', { mode: 'timestamp' }),
}, (t) => [
  unique().on(t.assignmentId, t.userId),
  index('idx_asub_assignment_status').on(t.assignmentId, t.status),
]);

// ─── Class Questions ──────────────────────────────────────────────────────────
// Per-class Q&A thread. parentId != null ⇒ an answer.

export const classQuestions = sqliteTable('class_questions', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => classSessions.id, { onDelete: 'cascade' }),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // parentId != null ⇒ this row is an answer to that question
  parentId:  integer('parent_id'),
  body:      text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_cq_session').on(t.sessionId),
  index('idx_cq_parent').on(t.parentId),
]);

// ─── Booking Slots ────────────────────────────────────────────────────────────
// Instructor-published 1-on-1 slots.
// mode: 'online' | 'offline'   status: 'open' | 'booked' | 'cancelled'

export const bookingSlots = sqliteTable('booking_slots', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  instructorId:   integer('instructor_id').notNull().references(() => users.id),
  subject:        text('subject').notNull(),
  product:        text('product').notNull().default('iba'),
  batch:          text('batch'),
  startAt:        integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt:          integer('end_at',   { mode: 'timestamp' }).notNull(),
  // 'online' | 'offline'
  mode:           text('mode').notNull(),
  topic:          text('topic'),
  // 'open' | 'booked' | 'cancelled'
  status:         text('status').notNull().default('open'),
  meetLink:       text('meet_link'),
  googleEventId:  text('google_event_id'),
  bookedByUserId: integer('booked_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  bookedAt:       integer('booked_at', { mode: 'timestamp' }),
  createdAt:      integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_bslots_start').on(t.startAt, t.status),
]);

// ─── Session Requests ─────────────────────────────────────────────────────────
// Student-initiated requests for a 1-on-1 session.
// status: 'pending' | 'approved' | 'declined' | 'scheduled'

export const sessionRequests = sqliteTable('session_requests', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  userId:          integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subject:         text('subject').notNull(),
  product:         text('product').notNull().default('iba'),
  batch:           text('batch'),
  topic:           text('topic').notNull(),
  // 'online' | 'offline' | 'either'
  preferredMode:   text('preferred_mode').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  notes:           text('notes'),
  // 'pending' | 'approved' | 'declined' | 'scheduled'
  status:          text('status').notNull().default('pending'),
  resolvedSlotId:  integer('resolved_slot_id').references(() => bookingSlots.id, { onDelete: 'set null' }),
  staffNote:       text('staff_note'),
  createdAt:       integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_sreq_user_status').on(t.userId, t.status),
]);

// ─── LMS Announcements ────────────────────────────────────────────────────────
// Name avoids clash with existing email-announcements feature.

export const lmsAnnouncements = sqliteTable('lms_announcements', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  title:     text('title').notNull(),
  body:      text('body').notNull(),
  subject:   text('subject').notNull(),
  product:   text('product').notNull().default('iba'),
  batch:     text('batch'),
  pinned:    integer('pinned', { mode: 'boolean' }).notNull().default(false),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  index('idx_lms_ann_product_batch').on(t.product, t.batch),
]);

// ─── Google Credentials ───────────────────────────────────────────────────────
// Exactly one row in practice (the host). Separate from NextAuth OAuth tokens.

export const googleCredentials = sqliteTable('google_credentials', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  userId:       integer('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  accessToken:  text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt:    integer('expires_at', { mode: 'timestamp' }).notNull(),
  scope:        text('scope').notNull(),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// ─── Session Materials (junction) ─────────────────────────────────────────────
// Many-to-many: one material can be linked to multiple sessions,
// one session can have multiple materials.

export const sessionMaterials = sqliteTable('session_materials', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  sessionId:  integer('session_id').notNull().references(() => classSessions.id, { onDelete: 'cascade' }),
  materialId: integer('material_id').notNull().references(() => materials.id, { onDelete: 'cascade' }),
  addedAt:    integer('added_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  unique().on(t.sessionId, t.materialId),
  index('idx_sm_session').on(t.sessionId),
  index('idx_sm_material').on(t.materialId),
]);

// ─── LMS Settings ─────────────────────────────────────────────────────────────
// Generic key-value store for LMS feature flags and configuration.
// key: string PK (e.g. 'meet_auto_create')
// value: text (e.g. 'true' | 'false' | JSON)

export const lmsSettings = sqliteTable('lms_settings', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type LmsSettingsRow = typeof lmsSettings.$inferSelect;

// ─── LMS Type Exports ─────────────────────────────────────────────────────────

export type ClassSchedule            = typeof classSchedules.$inferSelect;
export type NewClassSchedule         = typeof classSchedules.$inferInsert;
export type ClassSession             = typeof classSessions.$inferSelect;
export type NewClassSession          = typeof classSessions.$inferInsert;
export type ClassAttendance          = typeof classAttendance.$inferSelect;
export type Recording                = typeof recordings.$inferSelect;
export type NewRecording             = typeof recordings.$inferInsert;
export type RecordingAccessGrant     = typeof recordingAccessGrants.$inferSelect;
export type RecordingWatchProgress   = typeof recordingWatchProgress.$inferSelect;
export type Material                 = typeof materials.$inferSelect;
export type NewMaterial              = typeof materials.$inferInsert;
export type MaterialHighlight        = typeof materialHighlights.$inferSelect;
export type MaterialDrawing          = typeof materialDrawings.$inferSelect;
export type Assignment               = typeof assignments.$inferSelect;
export type NewAssignment            = typeof assignments.$inferInsert;
export type AssignmentSubmission     = typeof assignmentSubmissions.$inferSelect;
export type ClassQuestion            = typeof classQuestions.$inferSelect;
export type BookingSlot              = typeof bookingSlots.$inferSelect;
export type SessionRequest           = typeof sessionRequests.$inferSelect;
export type LmsAnnouncement          = typeof lmsAnnouncements.$inferSelect;
export type GoogleCredential         = typeof googleCredentials.$inferSelect;
export type SessionMaterial          = typeof sessionMaterials.$inferSelect;
export type NewSessionMaterial       = typeof sessionMaterials.$inferInsert;

export type LmsSubject               = 'english' | 'math' | 'analytical';
export type ClassSessionStatus       = 'draft' | 'scheduled' | 'live' | 'completed' | 'cancelled';
export type RecordingStatus          = 'pending' | 'processing' | 'available' | 'failed' | 'expired';
export type MaterialType             = 'pdf' | 'link';
export type AssignmentSubmissionStatus = 'submitted' | 'reviewed';
export type BookingSlotStatus        = 'open' | 'booked' | 'cancelled';
export type SessionRequestStatus     = 'pending' | 'approved' | 'declined' | 'scheduled';
export type BookingMode              = 'online' | 'offline';
export type SessionPreferredMode     = 'online' | 'offline' | 'either';
