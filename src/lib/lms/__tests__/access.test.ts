import { describe, expect, it } from 'vitest';
import { canAccessLmsContent, lmsScopeConditions } from '../access';
import type { UserWithProducts } from '@/lib/db/schema';
import { materials } from '@/lib/db/schema';

function student(overrides: Partial<UserWithProducts> = {}): UserWithProducts {
  return {
    id: 42,
    email: 'student@example.com',
    name: 'Student',
    image: null,
    role: 'student',
    status: 'active',
    batch: '2026',
    createdAt: new Date(),
    updatedAt: new Date(),
    products: ['iba'],
    ...overrides,
  } as UserWithProducts;
}

describe('LMS material access', () => {
  it('allows a student to open material for their product and batch', () => {
    expect(canAccessLmsContent(student(), { product: 'iba', batch: '2026' })).toBe(true);
  });

  it('rejects the class/material product mismatch that caused dashboard bounces', () => {
    expect(canAccessLmsContent(student(), { product: 'fbs', batch: '2026' })).toBe(false);
  });

  it('rejects a material assigned to a different batch', () => {
    expect(canAccessLmsContent(student(), { product: 'iba', batch: '2025' })).toBe(false);
  });

  it('allows product-wide material when batch is not restricted', () => {
    expect(canAccessLmsContent(student(), { product: 'iba', batch: null })).toBe(true);
  });

  it('always allows instructors and admins to verify teaching material', () => {
    expect(canAccessLmsContent(student({ role: 'instructor', products: [] }), { product: 'fbs', batch: '2025' })).toBe(true);
    expect(canAccessLmsContent(student({ role: 'super_admin', products: [] }), { product: 'fbs', batch: '2025' })).toBe(true);
  });

  it('produces student scope filters for material-list queries', () => {
    expect(lmsScopeConditions(student(), materials)).toHaveLength(2);
  });
});
