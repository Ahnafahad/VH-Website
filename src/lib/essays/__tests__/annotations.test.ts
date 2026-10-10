import { describe, expect, it } from 'vitest';
import { erasePartial, parseAnnotations, type EssayAnnotation } from '../annotations';

describe('parseAnnotations', () => {
  it('accepts every item type', () => {
    const items = [
      { id: 'a', t: 'pen', color: '#DC2626', size: 0.004, points: [[0.1, 0.1, 0.5], [0.2, 0.2, 0.6]] },
      { id: 'b', t: 'hl', color: '#FDE047', size: 0.02, points: [[0.1, 0.1, 0.5]] },
      { id: 'c', t: 'shape', shape: 'arrow', color: '#2563EB', size: 0.003, a: [0, 0], b: [1, 1] },
      { id: 'd', t: 'stamp', kind: 'tick', color: '#16A34A', x: 0.5, y: 0.5, scale: 1 },
      { id: 'e', t: 'text', color: '#111827', x: 0.5, y: 0.5, text: '8/10', scale: 1 },
      { id: 'f', t: 'comment', color: '#EA580C', x: 0.5, y: 0.5, text: 'Topic sentence missing' },
    ];
    expect(parseAnnotations(items)).toHaveLength(6);
  });

  it('rejects malformed items instead of dropping them', () => {
    expect(parseAnnotations([{ id: 'a', t: 'pen', color: 'red', size: 0.004, points: [[0, 0, 0.5]] }])).toBeNull();
    expect(parseAnnotations([{ id: 'a', t: 'stamp', kind: 'nope', color: '#000000', x: 0, y: 0, scale: 1 }])).toBeNull();
    expect(parseAnnotations([{ id: 'a', t: 'script', color: '#000000' }])).toBeNull();
    expect(parseAnnotations('x')).toBeNull();
  });
});

describe('erasePartial', () => {
  it('splits a stroke where the eraser passes through it', () => {
    const stroke: EssayAnnotation = {
      id: 's', t: 'pen', color: '#DC2626', size: 0.004,
      points: [[0.1, 0.5, 0.5], [0.2, 0.5, 0.5], [0.3, 0.5, 0.5], [0.4, 0.5, 0.5], [0.5, 0.5, 0.5], [0.6, 0.5, 0.5]],
    };
    let n = 0;
    const out = erasePartial([stroke], 0.35, 0.5, 0.06, 1, () => `new${++n}`);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('s');
    expect(out[1].id).toBe('new1');
  });

  it('leaves non-ink items alone', () => {
    const stamp: EssayAnnotation = { id: 'x', t: 'stamp', kind: 'tick', color: '#16A34A', x: 0.5, y: 0.5, scale: 1 };
    expect(erasePartial([stamp], 0.5, 0.5, 0.1, 1, () => 'z')).toEqual([stamp]);
  });
});
