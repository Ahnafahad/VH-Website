import { describe, expect, it, vi } from 'vitest';
import { MAX_ESSAYS, essayMax, parseEssays, seriesMax, validateEssays } from '../prompts';

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/notifications/notify-students', () => ({ notifyStudents: vi.fn() }));

const { assertEssaysFit, parseSeriesInput } = await import('../service');

const base = { title: 'Essay Series 1', prompt: '', product: 'iba', deadline: '2026-11-01T12:00:00.000Z' };

describe('parseEssays', () => {
  it('reads the essays column', () => {
    expect(parseEssays({ essays: '[{"prompt":"A","max":10},{"prompt":"B","max":15}]', essayCount: 2, prompt: '', totalMarks: 25 }))
      .toEqual([{ prompt: 'A', max: 10 }, { prompt: 'B', max: 15 }]);
  });

  it('derives legacy rows from essayCount and the per-essay totalMarks', () => {
    expect(parseEssays({ essays: '[]', essayCount: 2, prompt: 'Old', totalMarks: 20 })).toEqual([{ prompt: '', max: 20 }, { prompt: '', max: 20 }]);
    expect(parseEssays({ essays: 'not json', essayCount: 1, prompt: '', totalMarks: 20 })).toEqual([{ prompt: '', max: 20 }]);
  });
});

describe('validateEssays', () => {
  it('accepts 2 × 10 and 10 + 15', () => {
    const a = validateEssays([{ prompt: 'One', max: 10 }, { prompt: 'Two', max: 10 }]);
    const b = validateEssays([{ prompt: ' One ', max: '10' }, { prompt: 'Two', max: 15 }]);
    expect('essays' in a && seriesMax(a.essays)).toBe(20);
    expect('essays' in b && b.essays).toEqual([{ prompt: 'One', max: 10 }, { prompt: 'Two', max: 15 }]);
    expect('essays' in b && essayMax(b.essays, 2)).toBe(15);
  });

  it('rejects empty lists and bad maxima', () => {
    expect(validateEssays([])).toHaveProperty('error');
    expect(validateEssays([{ prompt: 'x', max: 0 }])).toHaveProperty('error');
    expect(validateEssays(Array.from({ length: MAX_ESSAYS + 1 }, () => ({ prompt: '', max: 5 })))).toHaveProperty('error');
  });
});

describe('parseSeriesInput', () => {
  it('passes the essays through (2 × 10, 10 + 15)', () => {
    expect(parseSeriesInput({ ...base, essays: [{ prompt: 'A', max: 10 }, { prompt: 'B', max: 10 }] }).essays).toHaveLength(2);
    const input = parseSeriesInput({ ...base, essays: [{ prompt: 'A', max: 10 }, { prompt: 'B', max: 15 }] });
    expect(seriesMax(input.essays)).toBe(25);
  });

  it('rejects a series without essays', () => {
    expect(() => parseSeriesInput({ ...base, essays: [] })).toThrow('Add at least one essay');
  });
});

describe('assertEssaysFit (editing a series with submissions)', () => {
  const essays = [{ prompt: 'A', max: 10 }, { prompt: 'B', max: 15 }];

  it('allows edits that keep submitted essays and marks in range', () => {
    expect(() => assertEssaysFit(essays, [{ essayIndex: 2, topMark: 12 }])).not.toThrow();
  });

  it('refuses removing an essay with submissions', () => {
    expect(() => assertEssaysFit(essays.slice(0, 1), [{ essayIndex: 2, topMark: null }])).toThrow("can't be removed");
  });

  it('refuses lowering a maximum below a given mark', () => {
    expect(() => assertEssaysFit([{ prompt: 'A', max: 10 }, { prompt: 'B', max: 10 }], [{ essayIndex: 2, topMark: 12 }])).toThrow("can't go below");
  });
});
