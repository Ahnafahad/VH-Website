import { describe, expect, it } from 'vitest';
import { buildAnalysis, type AnalysisResponse } from '../analysis';
import { CLASS_CREDIT } from '../classify';
import type { ResponseClass } from '../types';

let seq = 0;
function resp(over: Partial<AnalysisResponse> & { klass: ResponseClass }): AnalysisResponse {
  seq++;
  const isCorrect = over.isCorrect ?? ['mastered', 'fragile', 'lucky'].includes(over.klass);
  return {
    questionId: seq, number: seq, level: 1, position: ((seq - 1) % 20) + 1,
    skillId: 'parallelism', secondarySkills: [], difficultyScore: 2, correctKey: 'B',
    selectedKey: isCorrect ? 'B' : 'C', isCorrect, confidence: 'sure', totalTimeMs: 40_000, changes: [],
    hint1Ms: null, hint2Ms: null, transferKey: null, transferCorrect: null,
    errorFamily: isCorrect ? null : 'parallel-break', trapType: isCorrect ? null : 'partial-fix',
    createdAt: 1_000_000 + seq, ...over,
  };
}
const many = (n: number, over: Partial<AnalysisResponse> & { klass: ResponseClass }) =>
  Array.from({ length: n }, () => resp(over));

describe('buildAnalysis', () => {
  it('handles an empty history', () => {
    const a = buildAnalysis([], 0);
    expect(a.answered).toBe(0);
    expect(a.mastery).toBeNull();
    expect(a.skills.every(s => s.state === 'insufficient')).toBe(true);
    expect(a.weaknesses).toEqual([]);
  });

  it('does not judge a skill on one or two answers', () => {
    const a = buildAnalysis(many(2, { klass: 'misconception' }), 0);
    expect(a.skills.find(s => s.id === 'parallelism')!.state).toBe('insufficient');
  });

  it('marks a consistently missed skill weak and a consistently mastered one strong', () => {
    const rows = [
      ...many(10, { klass: 'misconception', skillId: 'tense', errorFamily: 'tense-error' }),
      ...many(10, { klass: 'mastered', skillId: 'idiom' }),
    ];
    const a = buildAnalysis(rows, 1);
    expect(a.skills.find(s => s.id === 'tense')!.state).toBe('weak');
    expect(a.skills.find(s => s.id === 'idiom')!.state).toBe('strong');
    expect(a.weaknesses[0].id).toBe('tense');
    expect(a.strengths.map(s => s.id)).toContain('idiom');
  });

  it('shrinks toward 50% with thin evidence', () => {
    const few = buildAnalysis(many(3, { klass: 'mastered' }), 0).skills.find(s => s.id === 'parallelism')!;
    const lots = buildAnalysis(many(30, { klass: 'mastered' }), 0).skills.find(s => s.id === 'parallelism')!;
    expect(few.mastery).toBeLessThan(lots.mastery);
    expect(few.margin).toBeGreaterThan(lots.margin);
  });

  it('gives partial credit: lucky and fragile answers score below mastered', () => {
    expect(CLASS_CREDIT.lucky).toBeLessThan(CLASS_CREDIT.fragile);
    expect(CLASS_CREDIT.fragile).toBeLessThan(CLASS_CREDIT.mastered);
    const shaky = buildAnalysis(many(10, { klass: 'lucky' }), 0).skills.find(s => s.id === 'parallelism')!;
    const solid = buildAnalysis(many(10, { klass: 'mastered' }), 0).skills.find(s => s.id === 'parallelism')!;
    expect(shaky.mastery).toBeLessThan(solid.mastery);
  });

  it('credits secondary skills at reduced weight', () => {
    const rows = many(10, { klass: 'misconception', skillId: 'tense', secondarySkills: ['voice'], errorFamily: 'tense-error' });
    const a = buildAnalysis(rows, 0);
    const voice = a.skills.find(s => s.id === 'voice')!;
    expect(voice.answered).toBe(0);
    expect(voice.mastery).toBeLessThan(50);
  });

  it('reports overconfidence when "sure" answers are often wrong', () => {
    const rows = [...many(6, { klass: 'mastered' }), ...many(4, { klass: 'misconception' })];
    const a = buildAnalysis(rows, 0);
    expect(a.behavior.sureCount).toBe(10);
    expect(a.behavior.overconfidence).toBeCloseTo(0.4);
    expect(a.insights.some(i => /marked Sure were wrong/.test(i))).toBe(true);
  });

  it('flags first-instinct-correct answers that were changed to wrong', () => {
    const rows = many(4, {
      klass: 'gap', confidence: 'unsure', selectedKey: 'C',
      changes: [{ key: 'B', t: 3000 }, { key: 'C', t: 9000 }],
    });
    const a = buildAnalysis(rows, 0);
    expect(a.behavior.talkedOutOfCorrect).toBe(4);
    expect(a.insights.some(i => /first pick was right/.test(i))).toBe(true);
  });

  it('spots a trap the student falls for more than chance', () => {
    const rows = many(10, { klass: 'gap', confidence: 'unsure', trapType: 'sounds-sophisticated' });
    const t = buildAnalysis(rows, 0).traps.find(x => x.id === 'sounds-sophisticated')!;
    expect(t.share).toBe(1);
    expect(t.overIndex).toBeGreaterThan(1.4);
  });

  it('distinguishes slips from real gaps using the transfer result', () => {
    const rows = many(5, { klass: 'slip', transferKey: 'B', transferCorrect: true });
    const a = buildAnalysis(rows, 0);
    expect(a.behavior.transfer).toEqual({ offered: 5, attempted: 5, correct: 5 });
    expect(a.insights.some(i => /slips in execution/.test(i))).toBe(true);
  });

  it('builds a per-level trend', () => {
    const rows = [
      ...many(10, { klass: 'mastered', level: 1 }),
      ...many(10, { klass: 'gap', confidence: 'unsure', level: 2 }),
    ];
    const t = buildAnalysis(rows, 2).levelTrend;
    expect(t.map(p => p.accuracy)).toEqual([100, 0]);
  });
});
