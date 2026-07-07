import { describe, it, expect } from 'vitest';
import { isRecordingWatchable } from '../recording-expiry';
import { RECORDING_EXPIRY_CLASS_COUNT } from '../constants';

describe('isRecordingWatchable — pure logic', () => {
  // ── Staff override ──────────────────────────────────────────────────────────

  it('returns watchable=true with reason="staff" for staff regardless of status', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'expired',
      subsequentCompletedCount: 10,
      activeGrantExists: false,
      isStaff: true,
    });
    expect(result).toEqual({ watchable: true, reason: 'staff' });
  });

  it('staff even with not_ready status', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'pending',
      subsequentCompletedCount: 0,
      activeGrantExists: false,
      isStaff: true,
    });
    expect(result).toEqual({ watchable: true, reason: 'staff' });
  });

  // ── not_ready ───────────────────────────────────────────────────────────────

  it('returns not_ready when status is "pending"', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'pending',
      subsequentCompletedCount: 0,
      activeGrantExists: false,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: false, reason: 'not_ready' });
  });

  it('returns not_ready when status is "processing"', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'processing',
      subsequentCompletedCount: 0,
      activeGrantExists: false,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: false, reason: 'not_ready' });
  });

  it('returns not_ready when status is "failed"', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'failed',
      subsequentCompletedCount: 0,
      activeGrantExists: false,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: false, reason: 'not_ready' });
  });

  // ── within_window ───────────────────────────────────────────────────────────

  it('returns within_window when 0 subsequent classes completed', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'available',
      subsequentCompletedCount: 0,
      activeGrantExists: false,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: true, reason: 'within_window' });
  });

  it('returns within_window when 1 subsequent class completed (< 2)', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'available',
      subsequentCompletedCount: 1,
      activeGrantExists: false,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: true, reason: 'within_window' });
  });

  it(`returns within_window at count = RECORDING_EXPIRY_CLASS_COUNT - 1 (${RECORDING_EXPIRY_CLASS_COUNT - 1})`, () => {
    const result = isRecordingWatchable({
      recordingStatus: 'available',
      subsequentCompletedCount: RECORDING_EXPIRY_CLASS_COUNT - 1,
      activeGrantExists: false,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: true, reason: 'within_window' });
  });

  // ── expired_window ──────────────────────────────────────────────────────────

  it('returns expired_window when 2 subsequent classes completed and no grant', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'available',
      subsequentCompletedCount: 2,
      activeGrantExists: false,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: false, reason: 'expired_window' });
  });

  it('returns expired_window when many subsequent classes and no grant', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'available',
      subsequentCompletedCount: 99,
      activeGrantExists: false,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: false, reason: 'expired_window' });
  });

  // ── granted ─────────────────────────────────────────────────────────────────

  it('returns granted when 2 subsequent classes completed but active grant exists', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'available',
      subsequentCompletedCount: 2,
      activeGrantExists: true,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: true, reason: 'granted' });
  });

  it('returns granted even with many subsequent classes if grant exists', () => {
    const result = isRecordingWatchable({
      recordingStatus: 'available',
      subsequentCompletedCount: 50,
      activeGrantExists: true,
      isStaff: false,
    });
    expect(result).toEqual({ watchable: true, reason: 'granted' });
  });
});
