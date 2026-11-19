import { describe, it, expect } from 'vitest';
import { lxFs } from '../ui';

describe('lxFs', () => {
  it('scales the size by --lx-text-scale with a 1 fallback', () => {
    expect(lxFs(14)).toBe('calc(14px * var(--lx-text-scale, 1))');
    expect(lxFs('1.2rem')).toBe('calc(1.2rem * var(--lx-text-scale, 1))');
    expect(lxFs('clamp(1rem, 5vw, 2rem)')).toBe('calc(clamp(1rem, 5vw, 2rem) * var(--lx-text-scale, 1))');
  });
});
