import { describe, expect, it } from 'vitest';
import { classifyResponse, countSwitches, type ClassifyInput } from '../classify';

const base: ClassifyInput = {
  selectedKey: 'B', isCorrect: true, confidence: 'sure', hint1Ms: null, hint2Ms: null, switches: 0, transferCorrect: null,
};

describe('classifyResponse', () => {
  it('correct, sure, unaided → mastered', () => {
    expect(classifyResponse(base)).toBe('mastered');
  });
  it('correct but guessed → lucky', () => {
    expect(classifyResponse({ ...base, confidence: 'guess' })).toBe('lucky');
  });
  it('correct but unsure, hinted or wavering → fragile', () => {
    expect(classifyResponse({ ...base, confidence: 'unsure' })).toBe('fragile');
    expect(classifyResponse({ ...base, hint1Ms: 4000 })).toBe('fragile');
    expect(classifyResponse({ ...base, switches: 2 })).toBe('fragile');
    expect(classifyResponse({ ...base, switches: 1 })).toBe('mastered');
  });
  it('wrong and sure → misconception; wrong and unsure/guess → gap', () => {
    expect(classifyResponse({ ...base, isCorrect: false })).toBe('misconception');
    expect(classifyResponse({ ...base, isCorrect: false, confidence: 'unsure' })).toBe('gap');
    expect(classifyResponse({ ...base, isCorrect: false, confidence: 'guess' })).toBe('gap');
  });
  it('a skipped question is a gap', () => {
    expect(classifyResponse({ ...base, isCorrect: false, selectedKey: null, confidence: null })).toBe('gap');
  });
  it('wrong but solved the transfer item → slip, even when sure', () => {
    expect(classifyResponse({ ...base, isCorrect: false, transferCorrect: true })).toBe('slip');
    expect(classifyResponse({ ...base, isCorrect: false, transferCorrect: false })).toBe('misconception');
  });
});

describe('countSwitches', () => {
  it('counts changes of option, not repeat clicks', () => {
    expect(countSwitches([])).toBe(0);
    expect(countSwitches([{ key: 'A' }, { key: 'A' }])).toBe(0);
    expect(countSwitches([{ key: 'A' }, { key: 'C' }, { key: 'A' }])).toBe(2);
  });
});
