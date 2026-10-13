import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { parseDangerPayload, referencesTo } from '../danger-actions';

describe('danger actions', () => {
  it('derives FK references to users from the schema', () => {
    const refs = referencesTo('users');
    expect(refs.find(r => r.table === 'user_access' && r.column === 'user_id')?.onDelete).toBe('cascade');
    expect(refs.find(r => r.table === 'test_attempts')?.onDelete).toBe('cascade');
  });
  it('validates payloads', () => {
    expect(() => parseDangerPayload('analytics.purge', { days: 1 })).toThrow();
    expect(parseDangerPayload('analytics.purge', { days: 30 }).payload).toEqual({ days: 30 });
    expect(() => parseDangerPayload('user.delete_full', { userId: 'x' })).toThrow();
    expect(() => parseDangerPayload('rm.rf', {})).toThrow(/Unknown/);
  });
});
