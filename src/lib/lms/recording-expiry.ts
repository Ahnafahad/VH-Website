// ─── Recording Expiry — Algorithm A (pure logic) ─────────────────────────────
// No DB imports in this file — fully unit-testable without a DB connection.
// The DB helper (countSubsequentCompletedClasses) lives in recording-expiry-db.ts.

import { RECORDING_EXPIRY_CLASS_COUNT } from './constants';

export type WatchReason =
  | 'not_ready'
  | 'within_window'
  | 'granted'
  | 'expired_window'
  | 'staff';

export interface WatchabilityResult {
  watchable: boolean;
  reason: WatchReason;
}

export interface IsRecordingWatchableArgs {
  /** recordings.status column value */
  recordingStatus: string;
  /**
   * Count of class_sessions with the same subject+product+batch scope,
   * status='completed', scheduledAt > this session's scheduledAt.
   * Obtained separately via countSubsequentCompletedClasses().
   */
  subsequentCompletedCount: number;
  /** True if an active recording_access_grants row exists for this user (or batch) */
  activeGrantExists: boolean;
  /** True when the requesting user is admin, super_admin, or instructor */
  isStaff: boolean;
}

/**
 * Pure function — algorithm A.
 * Unit-testable without a DB connection.
 */
export function isRecordingWatchable(
  args: IsRecordingWatchableArgs,
): WatchabilityResult {
  // Staff always have access
  if (args.isStaff) {
    return { watchable: true, reason: 'staff' };
  }

  // Step 1: recording must be available
  if (args.recordingStatus !== 'available') {
    return { watchable: false, reason: 'not_ready' };
  }

  // Step 2: within expiry window?
  if (args.subsequentCompletedCount < RECORDING_EXPIRY_CLASS_COUNT) {
    return { watchable: true, reason: 'within_window' };
  }

  // Step 3: active grant?
  if (args.activeGrantExists) {
    return { watchable: true, reason: 'granted' };
  }

  // Step 4: expired
  return { watchable: false, reason: 'expired_window' };
}
