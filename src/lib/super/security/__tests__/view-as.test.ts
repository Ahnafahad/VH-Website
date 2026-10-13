import { describe, it, expect } from 'vitest';
import { signViewAs, verifyViewAs, blockedWhileViewingAs } from '../view-as';

const S = 'test-secret';
const now = 1_000_000;

describe('view-as cookie', () => {
  it('round-trips and rejects tampering, expiry, wrong secret', async () => {
    const v = await signViewAs({ a: 1, t: 2, e: now + 60 }, S);
    expect(await verifyViewAs(v, S, now)).toEqual({ a: 1, t: 2, e: now + 60 });
    expect(await verifyViewAs(v, 'other', now)).toBeNull();
    expect(await verifyViewAs(v, S, now + 61)).toBeNull();
    const forged = await signViewAs({ a: 1, t: 3, e: now + 60 }, S);
    const tampered = forged.split('.')[0] + '.' + v.split('.')[1];
    expect(await verifyViewAs(tampered, S, now)).toBeNull();
    expect(await verifyViewAs(undefined, S, now)).toBeNull();
    expect(await verifyViewAs('garbage', S, now)).toBeNull();
  });
});

describe('blockedWhileViewingAs', () => {
  it('blocks writes, allows reads and the exit/auth/analytics exceptions', () => {
    expect(blockedWhileViewingAs('GET', '/api/admin/users')).toBe(false);
    expect(blockedWhileViewingAs('POST', '/api/admin/users')).toBe(true);
    expect(blockedWhileViewingAs('DELETE', '/api/x')).toBe(true);
    expect(blockedWhileViewingAs('POST', '/api/auth/signout')).toBe(false);
    expect(blockedWhileViewingAs('POST', '/api/analytics/ingest')).toBe(false);
    expect(blockedWhileViewingAs('DELETE', '/api/admin/super/impersonate')).toBe(false);
    expect(blockedWhileViewingAs('POST', '/api/admin/super/impersonate')).toBe(true);
  });
});
