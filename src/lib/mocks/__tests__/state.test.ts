import { describe, expect, it } from 'vitest';
import { mockPhase, PROVISIONAL_DELAY_MS } from '../state';

const closes = new Date('2026-11-10T10:00:00Z');
const windows = [{ closesAt: closes }, { closesAt: new Date('2026-11-10T08:00:00Z') }];
const submitted = { status: 'submitted' };
const unpublished = { resultsPublishedAt: null };

describe('mockPhase', () => {
  it('is official once published, whatever the attempt', () => {
    expect(mockPhase({ resultsPublishedAt: new Date() }, windows, null)).toBe('official');
  });

  it('stays locked until 10 minutes after the LAST window closes', () => {
    const justBefore = new Date(closes.getTime() + PROVISIONAL_DELAY_MS - 1);
    const atDelay = new Date(closes.getTime() + PROVISIONAL_DELAY_MS);
    expect(mockPhase(unpublished, windows, submitted, justBefore)).toBe('locked');
    expect(mockPhase(unpublished, windows, submitted, atDelay)).toBe('provisional');
  });

  it('is locked without a submitted attempt or without windows', () => {
    const later = new Date(closes.getTime() + 60 * 60_000);
    expect(mockPhase(unpublished, windows, null, later)).toBe('locked');
    expect(mockPhase(unpublished, windows, { status: 'in_progress' }, later)).toBe('locked');
    expect(mockPhase(unpublished, [], submitted, later)).toBe('locked');
  });
});
