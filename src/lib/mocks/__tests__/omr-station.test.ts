import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/api-utils', () => ({
  ApiException: class extends Error { constructor(m: string, public status = 500, public code?: string) { super(m); } },
}));
vi.mock('@/lib/storage/r2', () => ({ r2PutStream: vi.fn() }));

import { bearerMatches, requireStation, toAnswerMap, imageKey } from '../omr-station';

const req = (auth?: string) => new Request('http://x', { headers: auth ? { authorization: auth } : {} });

describe('bearerMatches', () => {
  it('accepts only the exact secret', () => {
    expect(bearerMatches('Bearer s3cret', 's3cret')).toBe(true);
    expect(bearerMatches('Bearer s3cre', 's3cret')).toBe(false);
    expect(bearerMatches('Bearer wrong!', 's3cret')).toBe(false);
    expect(bearerMatches('s3cret', 's3cret')).toBe(false);
    expect(bearerMatches(null, 's3cret')).toBe(false);
  });
});

describe('requireStation', () => {
  it('503 when unset, 401 when wrong, passes when right', () => {
    delete process.env.OMR_STATION_SECRET;
    expect(() => requireStation(req('Bearer a'))).toThrow(expect.objectContaining({ status: 503 }));
    process.env.OMR_STATION_SECRET = 'a';
    expect(() => requireStation(req('Bearer b'))).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => requireStation(req())).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => requireStation(req('Bearer a'))).not.toThrow();
  });
});

describe('toAnswerMap', () => {
  const ordered = [{ id: 10 }, { id: 11 }, { id: 12 }];
  it('maps letters by position and blanks the rest', () => {
    expect([...toAnswerMap(ordered, ['b', null, 'AB'])]).toEqual([[10, 'B']]);
  });
  it('rejects wrong length', () => {
    expect(() => toAnswerMap(ordered, ['A'])).toThrow();
  });
});

it('imageKey', () => expect(imageKey(5, 9)).toBe('omr-sheets/5/9.jpg'));
