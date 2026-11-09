import { describe, expect, it } from 'vitest';
import { mockPhase } from '../state';

const closes = new Date('2026-11-10T10:00:00Z');
const win = (over: Record<string, unknown> = {}) => ({ status: 'scheduled', opensAt: new Date('2026-11-10T06:00:00Z'), closesAt: closes, ...over }) as Parameters<typeof mockPhase>[1][number];
const windows = [win(), win({ closesAt: new Date('2026-11-10T08:00:00Z') })];
const submitted = { status: 'submitted' };
const unpublished = { resultsPublishedAt: null };

describe('mockPhase', () => {
  it('is official once published, whatever the attempt', () => {
    expect(mockPhase({ resultsPublishedAt: new Date() }, windows, null)).toBe('official');
  });

  it('stays locked after the windows close until 8pm Dhaka (14:00Z) on the exam day', () => {
    expect(mockPhase(unpublished, windows, submitted, new Date(closes.getTime() + 1))).toBe('locked');
    expect(mockPhase(unpublished, windows, submitted, new Date('2026-11-10T13:59:59Z'))).toBe('locked');
    expect(mockPhase(unpublished, windows, submitted, new Date('2026-11-10T14:00:00Z'))).toBe('provisional');
  });

  it('is locked while a window is still open, even past 8pm', () => {
    expect(mockPhase(unpublished, windows, submitted, new Date(closes.getTime() - 1))).toBe('locked');
  });

  it('counts a window staff closed early (still 8pm)', () => {
    const early = [win({ status: 'closed' }), win({ status: 'closed' })];
    expect(mockPhase(unpublished, early, submitted, new Date('2026-11-10T07:00:00Z'))).toBe('locked');
    expect(mockPhase(unpublished, early, submitted, new Date('2026-11-10T14:00:00Z'))).toBe('provisional');
  });

  it('shows an elective mock result the moment its window closes', () => {
    const electives = { resultsPublishedAt: null, electiveCount: 2 };
    expect(mockPhase(electives, windows, submitted, new Date(closes.getTime() - 1))).toBe('locked');
    expect(mockPhase(electives, windows, submitted, new Date(closes.getTime() + 1))).toBe('provisional');
  });

  it('is locked without a submitted attempt or without windows', () => {
    const later = new Date(closes.getTime() + 60 * 60_000);
    expect(mockPhase(unpublished, windows, null, later)).toBe('locked');
    expect(mockPhase(unpublished, windows, { status: 'in_progress' }, later)).toBe('locked');
    expect(mockPhase(unpublished, [], submitted, later)).toBe('locked');
  });
});
