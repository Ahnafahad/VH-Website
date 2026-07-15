/**
 * local-reminders.ts — on-device scheduled notifications for LexiCore.
 *
 * Two notifications:
 *   1001  Daily streak reminder  — repeating daily at 19:30 local time.
 *   1002  Reviews-due reminder   — one-shot at the next SRS due timestamp.
 *
 * All public functions are no-ops when not running on a native platform.
 * Scheduling is idempotent: cancel then reschedule on every call so duplicate
 * notifications are impossible regardless of how many times this is called.
 *
 * Permission is requested the first time scheduling is attempted AND the user
 * has completed onboarding (detected by the presence of vocabUserProgress,
 * which the shell layout only renders after redirect-from-onboarding).
 * If permission is denied, we remember that in localStorage and never nag again.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ScheduleOptions } from '@capacitor/local-notifications';

// ─── Constants ────────────────────────────────────────────────────────────────

export const NOTIF_ID_DAILY  = 1001;
export const NOTIF_ID_REVIEW = 1002;

const LS_REMINDER_ENABLED = 'lx-daily-reminder-enabled';
const LS_NOTIF_DENIED     = 'lx-notif-permission-denied';
const LS_REMINDER_DATA    = 'lx-reminder-data';

/** Minutes in the future within which we skip scheduling a one-shot review notification. */
const REVIEW_SKIP_WITHIN_MS = 15 * 60 * 1000;

// ─── Persistence helpers ───────────────────────────────────────────────────────

/** Returns true if the user has enabled daily reminders (default: true). */
export function readReminderEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = window.localStorage.getItem(LS_REMINDER_ENABLED);
  return v === null ? true : v === '1';
}

/** Persist the daily-reminder preference. */
export function writeReminderEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_REMINDER_ENABLED, enabled ? '1' : '0');
}

interface ReminderData { dueCount: number; nextDueIso: string | null }

/** Last-known SRS data, written whenever the home screen schedules with fresh
 * data. Lets launch/resume/toggle reschedule without wiping the review
 * notification when no fresh data is at hand. */
function readCachedData(): ReminderData {
  if (typeof window === 'undefined') return { dueCount: 0, nextDueIso: null };
  try {
    const raw = window.localStorage.getItem(LS_REMINDER_DATA);
    if (!raw) return { dueCount: 0, nextDueIso: null };
    const parsed = JSON.parse(raw) as Partial<ReminderData>;
    return {
      dueCount:   typeof parsed.dueCount === 'number' ? parsed.dueCount : 0,
      nextDueIso: typeof parsed.nextDueIso === 'string' ? parsed.nextDueIso : null,
    };
  } catch {
    return { dueCount: 0, nextDueIso: null };
  }
}

function writeCachedData(data: ReminderData): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_REMINDER_DATA, JSON.stringify(data));
}

/** True if the user previously denied permission — we stop nagging. */
function wasPermissionDenied(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LS_NOTIF_DENIED) === '1';
}

function markPermissionDenied(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_NOTIF_DENIED, '1');
}

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Request permission if not already granted.
 * Returns true if permission is (now) granted.
 */
async function ensurePermission(): Promise<boolean> {
  if (wasPermissionDenied()) return false;

  const { display } = await LocalNotifications.checkPermissions();
  if (display === 'granted') return true;
  if (display === 'denied') {
    markPermissionDenied();
    return false;
  }

  // 'prompt' or 'prompt-with-rationale' — ask once
  const result = await LocalNotifications.requestPermissions();
  if (result.display !== 'granted') {
    markPermissionDenied();
    return false;
  }
  return true;
}

// ─── Core scheduling ──────────────────────────────────────────────────────────

/** Android requires the channel to exist before a notification posts to it —
 * posting to an unknown channelId is silently dropped. createChannel with the
 * same id is idempotent. */
let channelCreated = false;
async function ensureChannel(): Promise<void> {
  if (channelCreated || Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.createChannel({
    id:          'reminders',
    name:        'Reminders',
    description: 'Daily streak and review reminders',
    importance:  4,
  }).catch(() => {/* channel creation failure must not block scheduling */});
  channelCreated = true;
}

/**
 * Reschedule from the last-known cached SRS data and the stored preference.
 * Safe to call from launch/resume/toggle where no fresh data is available —
 * it never wipes the review reminder with empty data.
 */
export async function rescheduleFromCache(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const data = readCachedData();
  await scheduleReminders({ ...data, remindersEnabled: readReminderEnabled() });
}

/**
 * Cancel both managed notification ids, then rebuild the schedule.
 * Callers with fresh SRS data (the home screen) call this directly; the fresh
 * data is cached for later rescheduleFromCache calls.
 *
 * @param dueCount        Current SRS due count (0 means no review notification).
 * @param nextDueIso      ISO timestamp of the earliest upcoming SRS due date
 *                        (a future date — past dates are already "due now").
 * @param remindersEnabled Whether the user has the daily-reminder toggle ON.
 */
export async function scheduleReminders(opts: {
  dueCount:         number;
  nextDueIso:       string | null;
  remindersEnabled: boolean;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const { dueCount, nextDueIso, remindersEnabled } = opts;
  writeCachedData({ dueCount, nextDueIso });

  // Cancel both ids first — idempotent.
  await LocalNotifications.cancel({ notifications: [
    { id: NOTIF_ID_DAILY },
    { id: NOTIF_ID_REVIEW },
  ] }).catch(() => {/* ignore if nothing was scheduled */});

  if (!remindersEnabled) return;

  const granted = await ensurePermission();
  if (!granted) return;
  await ensureChannel();

  const toSchedule: ScheduleOptions['notifications'] = [];

  // ── 1001: Daily streak reminder — repeating at 19:30 ─────────────────────
  // Calendar-based `on` trigger repeats daily at the given local time.
  toSchedule.push({
    id:    NOTIF_ID_DAILY,
    title: '5 minutes keeps your streak alive',
    body:  'One short session tonight locks in what you learned.',
    schedule: { on: { hour: 19, minute: 30 } },
    channelId: 'reminders',
  });

  // ── 1002: Reviews-due — one-shot at next SRS due timestamp ───────────────
  {
    const reviewAt = nextDueIso ? new Date(nextDueIso) : null;
    const now = Date.now();

    const shouldScheduleReview =
      reviewAt !== null &&
      !isNaN(reviewAt.getTime()) &&
      reviewAt.getTime() - now > REVIEW_SKIP_WITHIN_MS;

    if (shouldScheduleReview && reviewAt) {
      const body = dueCount > 0
        ? `${dueCount} words are ready for review. Reviewing on time is when memory locks in.`
        : 'Reviewing on time is when memory locks in.';

      toSchedule.push({
        id:    NOTIF_ID_REVIEW,
        title: 'Words are ready for review',
        body,
        schedule: { at: reviewAt, repeats: false },
        channelId: 'reminders',
      });
    }
  }

  if (toSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: toSchedule });
  }
}

/**
 * Cancel both reminder notifications immediately.
 * Called when the user toggles the reminder off.
 */
export async function cancelReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [
    { id: NOTIF_ID_DAILY },
    { id: NOTIF_ID_REVIEW },
  ] }).catch(() => {/* ignore */});
}

// ─── Register tap listener ────────────────────────────────────────────────────

/**
 * Register the localNotificationActionPerformed listener.
 * Returns a cleanup function.
 *
 * Must be called once inside a useEffect on native platform only.
 * Routes taps via window.location to avoid needing a hook reference here;
 * NativeAppBridge already pushes safely for push-notification taps, but
 * since we can't use a hook here we delegate back to the caller via the
 * returned navigate callback signature.
 */
export async function registerTapListener(
  onTap: (path: string) => void,
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};

  const handle = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    ({ notification }) => {
      if (notification.id === NOTIF_ID_DAILY) {
        onTap('/vocab/home');
      } else if (notification.id === NOTIF_ID_REVIEW) {
        onTap('/vocab/review');
      }
    },
  );

  return () => { void handle.remove(); };
}

