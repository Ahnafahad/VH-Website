import { describe, it, expect } from 'vitest';
import { isJoinOpen } from '../join-window';

// Baseline session: starts at 14:00 UTC, 60 min long
// Window: 13:45 UTC → 15:30 UTC
const BASE = new Date('2026-01-12T14:00:00Z');
const session = { scheduledAt: BASE, durationMinutes: 60 };

describe('isJoinOpen', () => {
  it('returns false 16 minutes before scheduledAt', () => {
    const now = new Date(BASE.getTime() - 16 * 60_000);
    expect(isJoinOpen(session, now)).toBe(false);
  });

  it('returns true exactly 15 minutes before scheduledAt (boundary inclusive)', () => {
    const now = new Date(BASE.getTime() - 15 * 60_000);
    expect(isJoinOpen(session, now)).toBe(true);
  });

  it('returns true at scheduledAt', () => {
    expect(isJoinOpen(session, BASE)).toBe(true);
  });

  it('returns true during the session', () => {
    const now = new Date(BASE.getTime() + 30 * 60_000);
    expect(isJoinOpen(session, now)).toBe(true);
  });

  it('returns true exactly at scheduledAt + durationMinutes + 30 min (boundary inclusive)', () => {
    // 14:00 + 60 min + 30 min = 15:30
    const now = new Date(BASE.getTime() + (60 + 30) * 60_000);
    expect(isJoinOpen(session, now)).toBe(true);
  });

  it('returns false 1 ms after the closing boundary', () => {
    const now = new Date(BASE.getTime() + (60 + 30) * 60_000 + 1);
    expect(isJoinOpen(session, now)).toBe(false);
  });

  it('returns false long after the session ends', () => {
    const now = new Date(BASE.getTime() + 5 * 3600_000);
    expect(isJoinOpen(session, now)).toBe(false);
  });

  it('handles a session with durationMinutes=0', () => {
    const s = { scheduledAt: BASE, durationMinutes: 0 };
    // Window: 13:45 → 14:30
    expect(isJoinOpen(s, new Date(BASE.getTime() - 15 * 60_000))).toBe(true);
    expect(isJoinOpen(s, new Date(BASE.getTime() + 30 * 60_000))).toBe(true);
    expect(isJoinOpen(s, new Date(BASE.getTime() + 30 * 60_000 + 1))).toBe(false);
  });
});
