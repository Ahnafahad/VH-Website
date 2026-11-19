import { describe, expect, it } from 'vitest';
import { pickJourney, sectionOf, type Candidate } from '../pick';

let n = 0;
const q = (section: Candidate['section'], pct: number, topRight = false, mock = 1): Candidate =>
  ({ id: ++n, section, mock, order: n, pct, topRight });

describe('pickJourney', () => {
  it('caps each section at its target and takes the easiest misses first', () => {
    n = 0;
    const english = Array.from({ length: 30 }, (_, i) => q('english', 51 + i));   // pct 51..80
    const ids = pickJourney(english);
    expect(ids).toHaveLength(20);
    const picked = english.filter(c => ids.includes(c.id));
    expect(Math.min(...picked.map(c => c.pct))).toBe(61); // the 10 hardest are dropped
  });

  it('uses top-5 questions only after class-majority ones, and drops the rest', () => {
    n = 0;
    const easy = q('analytical', 90), topOnly = q('analytical', 20, true), hard = q('analytical', 20, false);
    expect(pickJourney([topOnly, hard, easy])).toEqual([topOnly.id, easy.id].sort((a, b) => a - b));
  });

  it('orders class-majority, then top-5, then the 30-49% band', () => {
    n = 0;
    const band = q('math', 40), top = q('math', 10, true), easy = q('math', 70);
    expect(pickJourney([band, top, easy])).toEqual([band.id, top.id, easy.id].sort((a, b) => a - b));
  });

  it('a short pool gives a short section, listed english -> math -> analytical', () => {
    n = 0;
    const a = q('analytical', 80), m = q('math', 80), e = q('english', 80);
    expect(pickJourney([a, m, e])).toEqual([e.id, m.id, a.id]);
  });

  it('classifies mock section titles', () => {
    expect(sectionOf('Language and Communication')).toBe('english');
    expect(sectionOf('Mathematics')).toBe('math');
    expect(sectionOf('Analytical Ability')).toBe('analytical');
    expect(sectionOf('Economics')).toBeNull();
  });
});
