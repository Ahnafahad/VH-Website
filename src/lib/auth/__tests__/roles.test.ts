import { describe, it, expect } from 'vitest';
import { isStaffRole, isAdminRole, isSuperAdminRole } from '../roles';

const ROLES = ['student', 'instructor', 'admin', 'super_admin'] as const;

describe('role tiers', () => {
  it('isStaffRole admits exactly admin, super_admin and instructor', () => {
    expect(ROLES.filter(isStaffRole)).toEqual(['instructor', 'admin', 'super_admin']);
  });

  it('isAdminRole admits exactly admin and super_admin — NOT instructor', () => {
    expect(ROLES.filter(isAdminRole)).toEqual(['admin', 'super_admin']);
    expect(isAdminRole('instructor')).toBe(false);
  });

  it('isSuperAdminRole admits exactly super_admin', () => {
    expect(ROLES.filter(isSuperAdminRole)).toEqual(['super_admin']);
  });

  it('separates the staff and admin tiers only at instructor', () => {
    // This is the distinction the four old inline spellings disagreed about.
    for (const role of ROLES) {
      if (role === 'instructor') {
        expect(isStaffRole(role)).toBe(true);
        expect(isAdminRole(role)).toBe(false);
      } else {
        expect(isStaffRole(role)).toBe(isAdminRole(role));
      }
    }
  });

  it('treats missing/unknown roles as unprivileged', () => {
    for (const value of [null, undefined, '', 'Admin', 'SUPER_ADMIN', 'teacher']) {
      expect(isStaffRole(value), String(value)).toBe(false);
      expect(isAdminRole(value), String(value)).toBe(false);
      expect(isSuperAdminRole(value), String(value)).toBe(false);
    }
  });
});
