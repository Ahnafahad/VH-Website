import { describe, it, expect, vi } from 'vitest';

// Prevent the @/lib/db module (loaded transitively via api-utils → db-access-control)
// from spinning up a real libsql client during test module eval.
vi.mock('@/lib/db', () => ({
  db: {},
  users: {},
  userAccess: {},
}));
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { assertRoleAssignable } from '../role-guards';
import { ApiException } from '@/lib/api-utils';

describe('assertRoleAssignable', () => {
  it('no-ops when targetRole is undefined', () => {
    expect(() => assertRoleAssignable(undefined, 'admin')).not.toThrow();
  });

  it('no-ops when targetRole is null', () => {
    expect(() => assertRoleAssignable(null, 'admin')).not.toThrow();
  });

  it('rejects unknown string with 400', () => {
    try {
      assertRoleAssignable('owner', 'super_admin');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiException);
      expect((e as ApiException).status).toBe(400);
      expect((e as ApiException).message).toContain('Invalid role');
    }
  });

  it('rejects non-string with 400', () => {
    try {
      assertRoleAssignable(42, 'super_admin');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiException);
      expect((e as ApiException).status).toBe(400);
    }
  });

  it('rejects assigning admin as admin with 403', () => {
    try {
      assertRoleAssignable('admin', 'admin');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiException);
      expect((e as ApiException).status).toBe(403);
      expect((e as ApiException).message).toContain('super admin');
    }
  });

  it('rejects assigning super_admin as admin with 403', () => {
    try {
      assertRoleAssignable('super_admin', 'admin');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiException);
      expect((e as ApiException).status).toBe(403);
    }
  });

  it('rejects assigning admin as instructor with 403', () => {
    expect(() => assertRoleAssignable('admin', 'instructor'))
      .toThrow(ApiException);
  });

  it('rejects assigning admin as undefined actor with 403', () => {
    expect(() => assertRoleAssignable('admin', undefined))
      .toThrow(ApiException);
  });

  it('allows super_admin to assign admin', () => {
    expect(() => assertRoleAssignable('admin', 'super_admin')).not.toThrow();
  });

  it('allows super_admin to assign super_admin', () => {
    expect(() => assertRoleAssignable('super_admin', 'super_admin')).not.toThrow();
  });

  it('allows admin to assign student', () => {
    expect(() => assertRoleAssignable('student', 'admin')).not.toThrow();
  });

  it('allows admin to assign instructor', () => {
    expect(() => assertRoleAssignable('instructor', 'admin')).not.toThrow();
  });

  it('allows super_admin to assign student', () => {
    expect(() => assertRoleAssignable('student', 'super_admin')).not.toThrow();
  });
});
