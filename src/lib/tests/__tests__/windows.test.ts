import { describe, expect, it } from 'vitest';
import type { Test, TestWindow } from '@/lib/db/schema';
import { resultsVisible } from '../windows';

const closedWindow = { status: 'closed', opensAt: new Date(0), closesAt: new Date(1000) } as TestWindow;
const test = (over: Partial<Test>) => ({ resultsPublishedAt: null, isMock: false, ...over }) as Test;

describe('resultsVisible', () => {
  it('shows a normal test once every window has closed', () => {
    expect(resultsVisible(test({}), [closedWindow])).toBe(true);
  });

  it('keeps a mock hidden after its windows close — only publishing reveals it', () => {
    expect(resultsVisible(test({ isMock: true }), [closedWindow])).toBe(false);
    expect(resultsVisible(test({ isMock: true, resultsPublishedAt: new Date() }), [closedWindow])).toBe(true);
  });
});
