CREATE TABLE `accounting_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_email` text NOT NULL,
	`mastered_questions` text DEFAULT '[]' NOT NULL,
	`lecture_progress` text DEFAULT '{}' NOT NULL,
	`total_mastered` integer DEFAULT 0 NOT NULL,
	`total_questions` integer DEFAULT 281 NOT NULL,
	`last_updated` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounting_progress_player_email_unique` ON `accounting_progress` (`player_email`);--> statement-breakpoint
CREATE TABLE `accounting_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_email` text NOT NULL,
	`player_name` text,
	`simple_score` real NOT NULL,
	`dynamic_score` real NOT NULL,
	`total_speed_bonus` real DEFAULT 0,
	`lecture_coverage_bonus` real DEFAULT 0,
	`questions_answered` integer NOT NULL,
	`correct_answers` integer,
	`wrong_answers` integer,
	`skipped_answers` integer,
	`accuracy` real,
	`selected_lectures` text,
	`time_taken` integer,
	`is_admin` integer DEFAULT false,
	`played_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `math_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_email` text NOT NULL,
	`player_name` text,
	`score` integer NOT NULL,
	`questions_correct` integer NOT NULL,
	`questions_answered` integer NOT NULL,
	`accuracy` real,
	`difficulty` text,
	`operations` text,
	`time_limit` real,
	`is_admin` integer DEFAULT false,
	`played_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`education_type` text,
	`hsc_year` text,
	`ssc_year` text,
	`a_level_year` text,
	`o_level_year` text,
	`program_mode` text,
	`selected_mocks` text,
	`mock_intent` text,
	`selected_full_courses` text,
	`pricing_subtotal` real,
	`pricing_discount` real,
	`pricing_final_price` real,
	`referral_name` text,
	`referral_institution` text,
	`referral_batch` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_access` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`product` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`granted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`granted_by` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_access_user_id_product_unique` ON `user_access` (`user_id`,`product`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`student_id` text,
	`batch` text,
	`class` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_student_id_unique` ON `users` (`student_id`);--> statement-breakpoint
CREATE TABLE `vocab_access_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`whatsapp` text,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vocab_admin_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_admin_settings_key_unique` ON `vocab_admin_settings` (`key`);--> statement-breakpoint
CREATE TABLE `vocab_confusion_pairs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`word_a_id` integer NOT NULL,
	`word_b_id` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_a_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_b_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_confusion_pairs_user_id_word_a_id_word_b_id_unique` ON `vocab_confusion_pairs` (`user_id`,`word_a_id`,`word_b_id`);--> statement-breakpoint
CREATE TABLE `vocab_flashcard_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`theme_id` integer NOT NULL,
	`current_card_index` integer DEFAULT 0 NOT NULL,
	`total_cards` integer NOT NULL,
	`ratings` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`theme_id`) REFERENCES `vocab_themes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_flashcard_sessions_user_id_theme_id_unique` ON `vocab_flashcard_sessions` (`user_id`,`theme_id`);--> statement-breakpoint
CREATE TABLE `vocab_hall_of_fame` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_label` text NOT NULL,
	`rank` integer NOT NULL,
	`user_id` integer,
	`display_name` text NOT NULL,
	`points` integer NOT NULL,
	`week_end_date` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `vocab_quiz_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`word_id` integer NOT NULL,
	`selected_word_id` integer,
	`is_correct` integer NOT NULL,
	`points_earned` integer DEFAULT 0 NOT NULL,
	`question_type` text NOT NULL,
	`answered_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `vocab_quiz_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`selected_word_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vocab_quiz_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`theme_id` integer,
	`session_type` text NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`total_questions` integer NOT NULL,
	`correct_answers` integer DEFAULT 0 NOT NULL,
	`score` integer,
	`passed` integer,
	`difficulty_level` text DEFAULT 'beginner' NOT NULL,
	`question_count` integer,
	`timed_mode` integer,
	`seconds_per_question` integer,
	`letter_group` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`theme_id`) REFERENCES `vocab_themes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vocab_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_email` text NOT NULL,
	`player_name` text,
	`questions_answered` integer NOT NULL,
	`questions_correct` integer NOT NULL,
	`total_sections` integer,
	`selected_sections` text,
	`difficulty` text,
	`is_admin` integer DEFAULT false,
	`played_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vocab_themes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`unit_id` integer NOT NULL,
	`name` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `vocab_units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vocab_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vocab_user_badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`badge_id` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`earned_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_user_badges_user_id_badge_id_unique` ON `vocab_user_badges` (`user_id`,`badge_id`);--> statement-breakpoint
CREATE TABLE `vocab_user_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`phase` integer DEFAULT 2 NOT NULL,
	`total_points` integer DEFAULT 0 NOT NULL,
	`weekly_points` integer DEFAULT 0 NOT NULL,
	`streak_days` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_study_date` integer,
	`deadline` integer,
	`daily_target` integer DEFAULT 10 NOT NULL,
	`onboarding_complete` integer DEFAULT false NOT NULL,
	`notifications_enabled` integer DEFAULT false NOT NULL,
	`email_summary_enabled` integer DEFAULT true NOT NULL,
	`push_subscription` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_user_progress_user_id_unique` ON `vocab_user_progress` (`user_id`);--> statement-breakpoint
CREATE TABLE `vocab_user_word_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`word_id` integer NOT NULL,
	`mastery_score` real DEFAULT 0 NOT NULL,
	`mastery_level` text DEFAULT 'new' NOT NULL,
	`srs_interval_days` integer DEFAULT 1 NOT NULL,
	`srs_ease_factor` real DEFAULT 2.5 NOT NULL,
	`srs_next_review_date` integer,
	`srs_repetitions` integer DEFAULT 0 NOT NULL,
	`in_srs_pool` integer DEFAULT false NOT NULL,
	`total_attempts` integer DEFAULT 0 NOT NULL,
	`correct_attempts` integer DEFAULT 0 NOT NULL,
	`accuracy_rate` real DEFAULT 0 NOT NULL,
	`consecutive_correct` integer DEFAULT 0 NOT NULL,
	`consecutive_wrong` integer DEFAULT 0 NOT NULL,
	`times_as_distractor` integer DEFAULT 0 NOT NULL,
	`exposure_count` integer DEFAULT 0 NOT NULL,
	`exposure_points` real DEFAULT 0 NOT NULL,
	`flashcard_got_it_count` integer DEFAULT 0 NOT NULL,
	`flashcard_unsure_count` integer DEFAULT 0 NOT NULL,
	`flashcard_missed_count` integer DEFAULT 0 NOT NULL,
	`last_interaction_at` integer,
	`last_seen_at` integer,
	`last_correct_at` integer,
	`long_gap_correct` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `vocab_words`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_user_word_records_user_id_word_id_unique` ON `vocab_user_word_records` (`user_id`,`word_id`);--> statement-breakpoint
CREATE TABLE `vocab_weekly_leaderboard` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`week_start` integer NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_weekly_leaderboard_user_id_week_start_unique` ON `vocab_weekly_leaderboard` (`user_id`,`week_start`);--> statement-breakpoint
CREATE TABLE `vocab_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`theme_id` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`word` text NOT NULL,
	`definition` text NOT NULL,
	`synonyms` text DEFAULT '[]' NOT NULL,
	`antonyms` text DEFAULT '[]' NOT NULL,
	`example_sentence` text NOT NULL,
	`part_of_speech` text NOT NULL,
	`difficulty_base` integer DEFAULT 3 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`theme_id`) REFERENCES `vocab_themes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `vocab_units`(`id`) ON UPDATE no action ON DELETE cascade
);
