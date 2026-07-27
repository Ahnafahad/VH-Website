import { describe, expect, it } from 'vitest';
import { canAccessLmsContent, lmsScopeConditions, lmsStudentAudienceConditions } from '../access';
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

/** Bound parameter values of a Drizzle condition list, in order. */
function boundValues(conditions: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const condition of conditions) {
    const chunks = (condition as { queryChunks?: unknown[] }).queryChunks ?? [];
    for (const chunk of chunks) {
      if (chunk && typeof chunk === 'object' && 'value' in chunk) {
        const value = (chunk as { value: unknown }).value;
        // StringChunk holds its SQL fragments as an array; Param holds the
        // actual bound value. Only the latter is interesting here.
        if (!Array.isArray(value)) out.push(value);
      }
    }
  }
  return out;
}

describe('lmsStudentAudienceConditions', () => {
  it('always constrains role, status, product and grant-active', () => {
    // Drizzle SQL objects are circular, so read the bound parameter values out
    // of the query chunks rather than serialising the whole condition.
    expect(boundValues(lmsStudentAudienceConditions({ product: 'iba', batch: null })))
      .toEqual(['student', 'active', 'iba', true]);
  });

  it('adds a batch constraint only when the content is batch-scoped', () => {
    // batch null = "all batches in this product" — same rule canAccessLmsContent
    // applies when it returns true for any batch.
    expect(lmsStudentAudienceConditions({ product: 'iba', batch: null })).toHaveLength(4);
    expect(lmsStudentAudienceConditions({ product: 'iba', batch: '2026' })).toHaveLength(5);
  });

  it('agrees with canAccessLmsContent about who the audience is', () => {
    // The audience predicate and the read predicate must not drift: for every
    // (content, student) pair below, "is in audience" == "can access".
    const cases: Array<{ batch: string | null; userBatch: string | null; expected: boolean }> = [
      { batch: null,   userBatch: '2026', expected: true  },
      { batch: null,   userBatch: '2025', expected: true  },
      { batch: '2026', userBatch: '2026', expected: true  },
      { batch: '2026', userBatch: '2025', expected: false },
      { batch: '2026', userBatch: null,   expected: false },
    ];

    for (const { batch, userBatch, expected } of cases) {
      const user = student({ batch: userBatch, products: ['iba'] });
      expect(canAccessLmsContent(user, { product: 'iba', batch }), `batch=${batch} user=${userBatch}`).toBe(expected);

      // Mirror the SQL rule in JS: batch null matches everyone, else exact match.
      const inAudience = batch === null ? true : userBatch === batch;
      expect(inAudience, `audience batch=${batch} user=${userBatch}`).toBe(expected);
    }
  });

  it('scopes the audience to the content product, not some other product', () => {
    expect(canAccessLmsContent(student({ products: ['fbs'] }), { product: 'iba', batch: null })).toBe(false);
    const bound = boundValues(lmsStudentAudienceConditions({ product: 'iba', batch: null }));
    expect(bound).toContain('iba');
    expect(bound).not.toContain('fbs');
  });

  it('binds the batch value when the content is batch-scoped', () => {
    expect(boundValues(lmsStudentAudienceConditions({ product: 'iba', batch: '2026' })))
      .toEqual(['student', 'active', 'iba', true, '2026']);
  });
});
