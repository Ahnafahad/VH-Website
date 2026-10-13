import { describe, it, expect } from 'vitest';
import { rootLockViolation } from '../root-lock';

describe('rootLockViolation', () => {
  it('never blocks non-root targets', () => {
    expect(rootLockViolation(false, { role: 'student', status: 'inactive', delete: true })).toBe(false);
  });
  it('blocks demote, suspend, readOnly, re-email and delete of root', () => {
    expect(rootLockViolation(true, { role: 'admin' })).toBe(true);
    expect(rootLockViolation(true, { status: 'inactive' })).toBe(true);
    expect(rootLockViolation(true, { readOnly: true })).toBe(true);
    expect(rootLockViolation(true, { email: 'x@gmail.com' })).toBe(true);
    expect(rootLockViolation(true, { delete: true })).toBe(true);
  });
  it('allows harmless root edits', () => {
    expect(rootLockViolation(true, { role: 'super_admin', status: 'active' })).toBe(false);
    expect(rootLockViolation(true, {})).toBe(false);
  });
});
