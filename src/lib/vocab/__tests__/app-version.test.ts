import { describe, expect, it } from 'vitest';
import { compareVersions } from '../app-version';

describe('compareVersions', () => {
  it('compares semantic numeric segments', () => {
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.2.0', '1.2')).toBe(0);
  });
});
