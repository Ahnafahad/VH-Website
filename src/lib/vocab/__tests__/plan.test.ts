import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/db', () => ({}));
import { dhakaDay, normalizeTrxId } from '../plan';

describe('dhakaDay', () => {
  it('rolls over at midnight Dhaka (18:00 UTC), not UTC midnight', () => {
    expect(dhakaDay(new Date('2026-11-19T17:59:59Z'))).toBe('2026-11-19');
    expect(dhakaDay(new Date('2026-11-19T18:00:00Z'))).toBe('2026-11-20');
    expect(dhakaDay(new Date('2026-11-19T23:30:00Z'))).toBe('2026-11-20');
  });
});

describe('normalizeTrxId', () => {
  it('uppercases and strips spaces/dashes', () => {
    expect(normalizeTrxId(' 9jk4-abc 123 ')).toBe('9JK4ABC123');
  });
  it('rejects junk', () => {
    expect(normalizeTrxId('abc')).toBeNull();
    expect(normalizeTrxId('<script>alert1</script>')).toBeNull();
    expect(normalizeTrxId(42)).toBeNull();
  });
});
