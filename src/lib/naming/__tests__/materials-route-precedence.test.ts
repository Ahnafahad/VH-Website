import { describe, it, expect } from 'vitest';

// Tests the linked-session-vs-client-value precedence rule used by
// POST /api/lms/admin/materials (src/app/api/lms/admin/materials/route.ts,
// function `resolveLinkedField`).
//
// This is a literal copy of that function, not an import. Next.js's App
// Router route contract (enforced by the "next" TS plugin via generated
// .next/types) only permits GET/POST/etc. and a few config exports from a
// route.ts file — exporting `resolveLinkedField` there for import here broke
// `tsc --noEmit` (confirmed: no other route.ts in this codebase exports a
// helper either). Keep this copy byte-for-byte in sync with route.ts's
// `resolveLinkedField` whenever either changes.
function resolveLinkedField(
  sessionValue: string | null | undefined,
  clientValue: unknown,
): string | null | undefined {
  if (sessionValue != null && sessionValue !== 'tbd') return sessionValue;
  if (typeof clientValue === 'string' && clientValue.trim() !== '') return clientValue;
  return sessionValue;
}

describe('resolveLinkedField — linked-session vs client-value precedence (pure, no DB)', () => {
  it('a real session value wins over the client value', () => {
    expect(resolveLinkedField('math', 'english')).toBe('math');
  });

  it('a real session value wins even when the client sent nothing', () => {
    expect(resolveLinkedField('math', undefined)).toBe('math');
  });

  it('a "tbd" placeholder session value loses to a confident client value', () => {
    expect(resolveLinkedField('tbd', 'math')).toBe('math');
  });

  it('"tbd" is still used when the client sent nothing', () => {
    expect(resolveLinkedField('tbd', undefined)).toBe('tbd');
  });

  it('"tbd" is still used when the client sent an empty string', () => {
    expect(resolveLinkedField('tbd', '')).toBe('tbd');
  });

  it('falls back to the client value when there is no linked session', () => {
    expect(resolveLinkedField(undefined, 'math')).toBe('math');
  });

  it('returns undefined when there is no linked session and the client sent nothing', () => {
    expect(resolveLinkedField(undefined, undefined)).toBeUndefined();
  });

  it('ignores a non-string client value (e.g. accidental number/object)', () => {
    expect(resolveLinkedField('tbd', 42)).toBe('tbd');
  });
});
