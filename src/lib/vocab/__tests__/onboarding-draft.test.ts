import { describe, it, expect } from 'vitest';
import { draftToParam, draftFromParam } from '../onboarding/state';
import { DEFAULT_CARD_PREFS } from '../card-prefs';

describe('draft link param', () => {
  it('round-trips and rebuilds weak words', () => {
    const d = { prefs: DEFAULT_CARD_PREFS, answers: [{ wordId: 12, correct: true, tier: 2 }, { wordId: 40, correct: false, tier: 3 }], weakWordIds: [40] };
    const p = draftToParam(d);
    expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(draftFromParam(p)).toEqual(d);
  });
  it('rejects junk', () => {
    expect(draftFromParam(undefined)).toBeNull();
    expect(draftFromParam('not-base64!!')).toBeNull();
    expect(draftFromParam(btoa(JSON.stringify({ a: [['x', 1, 1]] })))).toBeNull();
  });
});
