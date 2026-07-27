import { describe, it, expect } from 'vitest';
import { MAX_TX_ATTEMPTS, isTursoConflict } from '../tx-retry';

describe('MAX_TX_ATTEMPTS', () => {
  it('keeps the 3-attempt budget the retrying writers were built against', () => {
    expect(MAX_TX_ATTEMPTS).toBe(3);
  });
});

describe('isTursoConflict', () => {
  it('recognises the Turso write-contention shapes', () => {
    for (const msg of [
      'SERVER_ERROR: something went wrong',
      'Server returned HTTP status 400',
      'SQLITE_BUSY: database is locked',
      'database is locked',
      'write conflict detected',
    ]) {
      expect(isTursoConflict(new Error(msg)), msg).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(isTursoConflict(new Error('sqlite_busy'))).toBe(true);
    expect(isTursoConflict(new Error('Write Conflict'))).toBe(true);
  });

  it('matches non-Error values by their string form', () => {
    expect(isTursoConflict('SQLITE_BUSY')).toBe(true);
    expect(isTursoConflict('nope')).toBe(false);
  });

  it('rejects ordinary application errors', () => {
    expect(isTursoConflict(new Error('User not found'))).toBe(false);
    expect(isTursoConflict(new Error('returned HTTP status 500'))).toBe(false);
    expect(isTursoConflict(null)).toBe(false);
    expect(isTursoConflict(undefined)).toBe(false);
  });

  it('unwraps nested causes up to 4 levels deep', () => {
    const nested = new Error('outer', {
      cause: new Error('middle', { cause: new Error('SQLITE_BUSY') }),
    });
    expect(isTursoConflict(nested)).toBe(true);
  });

  it('stops unwrapping past 4 levels', () => {
    const deep = new Error('l1', {
      cause: new Error('l2', {
        cause: new Error('l3', {
          cause: new Error('l4', { cause: new Error('SQLITE_BUSY') }),
        }),
      }),
    });
    expect(isTursoConflict(deep)).toBe(false);
  });
});
