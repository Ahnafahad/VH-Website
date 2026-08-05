import { describe, it, expect } from 'vitest';
import { computeClassNumbers, type NumberableSession } from '../class-numbering-pure';

function s(
  over: { id: number; scheduledAt: string } & Partial<Omit<NumberableSession, 'id' | 'scheduledAt'>>,
): NumberableSession {
  return {
    subject: 'math',
    product: 'iba',
    batch: '2026-27',
    status: 'scheduled',
    classNumber: null,
    ...over,
    scheduledAt: new Date(over.scheduledAt),
  };
}

describe('computeClassNumbers', () => {
  it("numbers each batch's series independently", () => {
    const sessions = [
      s({ id: 1, batch: 'A', scheduledAt: '2026-01-01' }),
      s({ id: 2, batch: 'A', scheduledAt: '2026-01-08' }),
      s({ id: 3, batch: 'B', scheduledAt: '2026-01-01' }),
      s({ id: 4, batch: 'B', scheduledAt: '2026-01-08' }),
    ];
    const result = computeClassNumbers(sessions);
    expect(result.get(1)).toBe(1);
    expect(result.get(2)).toBe(2);
    expect(result.get(3)).toBe(1);
    expect(result.get(4)).toBe(2);
  });

  it('a cancelled class in the middle gets no number and does not consume one', () => {
    const sessions = [
      s({ id: 1, scheduledAt: '2026-01-01' }),
      s({ id: 2, scheduledAt: '2026-01-08', status: 'cancelled' }),
      s({ id: 3, scheduledAt: '2026-01-15' }),
    ];
    const result = computeClassNumbers(sessions);
    expect(result.get(1)).toBe(1);
    expect(result.get(2)).toBe(null);
    expect(result.get(3)).toBe(2); // next real class, no gap
  });

  it('a tbd subject gets no number', () => {
    const sessions = [
      s({ id: 1, scheduledAt: '2026-01-01' }),
      s({ id: 2, scheduledAt: '2026-01-08', subject: 'tbd' }),
      s({ id: 3, scheduledAt: '2026-01-15' }),
    ];
    const result = computeClassNumbers(sessions);
    expect(result.get(1)).toBe(1);
    expect(result.get(2)).toBe(null);
    expect(result.get(3)).toBe(2);
  });

  it('a back-dated insertion renumbers the later classes', () => {
    const before = [
      s({ id: 1, scheduledAt: '2026-01-08' }),
      s({ id: 2, scheduledAt: '2026-01-15' }),
    ];
    const beforeResult = computeClassNumbers(before);
    expect(beforeResult.get(1)).toBe(1);
    expect(beforeResult.get(2)).toBe(2);

    // Insert a class dated earlier than both existing ones.
    const after = [...before, s({ id: 3, scheduledAt: '2026-01-01' })];
    const afterResult = computeClassNumbers(after);
    expect(afterResult.get(3)).toBe(1); // takes the earliest slot
    expect(afterResult.get(1)).toBe(2); // pushed back
    expect(afterResult.get(2)).toBe(3); // pushed back
  });

  it('a manual override wins for its own row without shifting siblings', () => {
    const sessions = [
      s({ id: 1, scheduledAt: '2026-01-01' }),
      s({ id: 2, scheduledAt: '2026-01-08', classNumber: 99 }), // manual override
      s({ id: 3, scheduledAt: '2026-01-15' }),
    ];
    const result = computeClassNumbers(sessions);
    expect(result.get(1)).toBe(1);
    expect(result.get(2)).toBe(99); // override displayed verbatim
    expect(result.get(3)).toBe(3);  // still its natural chronological rank
  });
});
