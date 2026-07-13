ALTER TABLE vocab_user_progress ADD COLUMN learning_goal text NOT NULL DEFAULT 'general';
--> statement-breakpoint
ALTER TABLE vocab_user_progress ADD COLUMN onboarding_completed_at integer;
--> statement-breakpoint
ALTER TABLE vocab_user_progress ADD COLUMN activated_at integer;
