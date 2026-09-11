import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {},
  users: {},
}));

import { qualifiesForStudentId } from '@/lib/students/assign-student-id';

describe('qualifiesForStudentId', () => {
  it('qualifies IBA and FBS students in the 2026-27 batch', () => {
    expect(qualifiesForStudentId('2026-27', ['iba'])).toBe(true);
    expect(qualifiesForStudentId('2026-27', ['fbs'])).toBe(true);
  });

  it('does not qualify other batches or products', () => {
    expect(qualifiesForStudentId('2025-26', ['fbs'])).toBe(false);
    expect(qualifiesForStudentId('2026-27', ['fbs_detailed'])).toBe(false);
    expect(qualifiesForStudentId(null, ['fbs'])).toBe(false);
  });
});
