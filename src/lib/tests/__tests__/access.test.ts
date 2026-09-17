import { describe, expect, it } from 'vitest';
import { canActivateTestWindow } from '@/lib/tests/access';

describe('test window activation access', () => {
  it('allows admins and super admins', () => {
    expect(canActivateTestWindow({ role: 'admin' })).toBe(true);
    expect(canActivateTestWindow({ role: 'super_admin' })).toBe(true);
  });

  it('rejects instructors', () => {
    expect(canActivateTestWindow({ role: 'instructor' })).toBe(false);
  });
});
