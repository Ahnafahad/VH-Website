CREATE TABLE `free_signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`whatsapp` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `free_signups_email_unique` ON `free_signups` (`email`);--> statement-breakpoint
CREATE TABLE `vocab_upgrade_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`selected_option` text NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_upgrade_requests_user_id_unique` ON `vocab_upgrade_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `workbook_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`chapter_slug` text NOT NULL,
	`anchor` text NOT NULL,
	`label` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wb_user_chapter` ON `workbook_bookmarks` (`user_id`,`chapter_slug`);--> statement-breakpoint
CREATE TABLE `workbook_chapter_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`chapter_slug` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`last_anchor` text,
	`percent_read` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wcp_user_id` ON `workbook_chapter_progress` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workbook_chapter_progress_user_id_chapter_slug_unique` ON `workbook_chapter_progress` (`user_id`,`chapter_slug`);--> statement-breakpoint
CREATE TABLE `workbook_mcq_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`chapter_slug` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_option` text NOT NULL,
	`is_correct` integer NOT NULL,
	`attempted_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wma_user_chapter` ON `workbook_mcq_attempts` (`user_id`,`chapter_slug`);--> statement-breakpoint
ALTER TABLE `users` ADD `whatsapp` text;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_skips` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarded_at` integer;--> statement-breakpoint
ALTER TABLE `vocab_user_progress` ADD `daily_message` text;--> statement-breakpoint
ALTER TABLE `vocab_user_progress` ADD `daily_message_date` text;--> statement-breakpoint
CREATE INDEX `idx_quiz_sessions_user_status` ON `vocab_quiz_sessions` (`user_id`,`status`,`session_type`);--> statement-breakpoint
CREATE INDEX `idx_uwr_srs_due` ON `vocab_user_word_records` (`user_id`,`in_srs_pool`,`srs_next_review_date`);--> statement-breakpoint
CREATE INDEX `idx_uwr_mastery` ON `vocab_user_word_records` (`user_id`,`mastery_level`);--> statement-breakpoint
CREATE INDEX `idx_vocab_words_theme_id` ON `vocab_words` (`theme_id`);