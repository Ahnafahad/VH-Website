-- Migration: add push_subscription column to vocab_user_progress
-- Run against Turso DB before deploying push notification feature.
--
-- Usage (Turso CLI):
--   turso db shell <your-db-name> < scripts/migrations/add-push-subscription.sql
--
-- This column stores a serialised PushSubscriptionJSON object (endpoint + keys).
-- NULL means the user has not granted push permission / subscription not yet created.

ALTER TABLE vocab_user_progress ADD COLUMN push_subscription TEXT;
