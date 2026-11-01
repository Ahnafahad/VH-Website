import { describe, expect, it } from 'vitest';
import type { Test } from '@/lib/db/schema';
import { canAccessTest } from '../access';

const test = (over: Partial<Test>) =>
  ({ status: 'published', isMock: true, mockBatch: null, allowedProducts: null, ...over }) as Test;
const student = (over: Record<string, unknown> = {}) =>
  ({ role: 'student', email: 's@gmail.com', batch: '2026-27', products: ['iba'], mockAccess: false, ...over }) as Parameters<typeof canAccessTest>[0];

describe('canAccessTest for mocks', () => {
  it('needs Mock Access when the mock names no products', () => {
    expect(canAccessTest(student(), test({}))).toBe(false);
    expect(canAccessTest(student({ mockAccess: true }), test({}))).toBe(true);
  });
  it('Mock Access holders without any LMS product still get in', () => {
    expect(canAccessTest(student({ products: [], batch: null, mockAccess: true }), test({}))).toBe(true);
  });
  it('a mock that names products follows them (the FBS Pre-Mock), whatever Mock Access says', () => {
    const pre = test({ allowedProducts: '["fbs","fbs_detailed"]' });
    expect(canAccessTest(student({ products: ['fbs'] }), pre)).toBe(true);
    expect(canAccessTest(student({ mockAccess: true }), pre)).toBe(false);
  });
  it('a batch-scoped mock excludes other batches, even with Mock Access', () => {
    const m = test({ mockBatch: 'tester-only' });
    expect(canAccessTest(student({ mockAccess: true }), m)).toBe(false);
  });
  it('is hidden until published, except to staff and the tester account', () => {
    const draft = test({ status: 'draft' });
    expect(canAccessTest(student({ mockAccess: true }), draft)).toBe(false);
    expect(canAccessTest(student({ role: 'instructor' }), draft)).toBe(true);
    expect(canAccessTest(student({ email: 'ahnafahad16@gmail.com' }), draft)).toBe(true);
  });
});
