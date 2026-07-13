import { trackFeature } from '@/lib/analytics/tracker';

export const RETENTION_EVENTS = {
  onboardingStarted: 'onboarding_started',
  starterWordRevealed: 'starter_word_revealed',
  starterWordRated: 'starter_word_rated',
  firstRecallAttempted: 'first_recall_attempted',
  activationAchieved: 'activation_achieved',
  learningSessionStarted: 'learning_session_started',
  learningSessionCompleted: 'learning_session_completed',
  learningSessionAbandoned: 'learning_session_abandoned',
  reviewCompleted: 'review_completed',
  recommendationStarted: 'recommendation_started',
  recommendationCompleted: 'recommendation_completed',
  sessionRestored: 'session_restored',
  notificationOpened: 'notification_opened',
  notificationValueCompleted: 'notification_value_completed',
} as const;

export type RetentionEventName = typeof RETENTION_EVENTS[keyof typeof RETENTION_EVENTS];

export function trackRetention(
  name: RetentionEventName,
  props?: Record<string, string | number | boolean | null>,
) {
  trackFeature(name, 'vocab', props);
}
