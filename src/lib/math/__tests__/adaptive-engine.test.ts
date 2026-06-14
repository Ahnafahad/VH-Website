import { describe, it, expect } from 'vitest';
import {
  applyAttempt,
  chooseNextQuestion,
  expectedWin,
  skillLevelCrossings,
} from '../adaptive/engine';
import { createInitialState } from '../adaptive/state';
import { ADAPTIVE_SKILL_MAX, ADAPTIVE_SKILL_MIN, OPERATIONS } from '../constants';

describe('expectedWin', () => {
  it('returns 0.5 when skill equals difficulty', () => {
    expect(expectedWin(3, 3)).toBeCloseTo(0.5, 5);
  });
  it('monotonic in skill-diff', () => {
    expect(expectedWin(4, 3)).toBeGreaterThan(expectedWin(3, 3));
    expect(expectedWin(2, 3)).toBeLessThan(expectedWin(3, 3));
  });
});

describe('applyAttempt — convergence', () => {
  it('pushes skill up after sustained correct answers at higher difficulty', () => {
    let state = createInitialState();
    for (let i = 0; i < 200; i++) {
      state = applyAttempt(state, {
        operation: 'addition',
        difficulty: 3.0,
        isCorrect: true,
        wasSkipped: false,
        wasSuspicious: false,
        responseTimeMs: 4000,
      }, { expectedTimeMs: 4000 });
    }
    expect(state.skill.addition).toBeGreaterThan(2.5);
  });

  it('pushes skill down after sustained wrong answers', () => {
    let state = createInitialState();
    for (let i = 0; i < 200; i++) {
      state = applyAttempt(state, {
        operation: 'addition',
        difficulty: 2.0,
        isCorrect: false,
        wasSkipped: false,
        wasSuspicious: false,
        responseTimeMs: 5000,
      }, { expectedTimeMs: 5000 });
    }
    expect(state.skill.addition).toBeLessThan(2.5);
  });

  it('skill stays clamped to [1, 5]', () => {
    let state = createInitialState({ addition: 4.9 });
    for (let i = 0; i < 500; i++) {
      state = applyAttempt(state, {
        operation: 'addition',
        difficulty: 1.0,
        isCorrect: true,
        wasSkipped: false,
        wasSuspicious: false,
        responseTimeMs: 1500,
      }, { expectedTimeMs: 4000 });
    }
    expect(state.skill.addition).toBeLessThanOrEqual(ADAPTIVE_SKILL_MAX);
    expect(state.skill.addition).toBeGreaterThanOrEqual(ADAPTIVE_SKILL_MIN);
  });

  it('discounts suspicious attempts', () => {
    let cleanState = createInitialState();
    let suspState  = createInitialState();
    for (let i = 0; i < 50; i++) {
      cleanState = applyAttempt(cleanState, {
        operation: 'addition',
        difficulty: 3.5,
        isCorrect: true,
        wasSkipped: false,
        wasSuspicious: false,
        responseTimeMs: 3000,
      }, { expectedTimeMs: 3000 });
      suspState = applyAttempt(suspState, {
        operation: 'addition',
        difficulty: 3.5,
        isCorrect: true,
        wasSkipped: false,
        wasSuspicious: true,
        responseTimeMs: 3000,
      }, { expectedTimeMs: 3000 });
    }
    expect(cleanState.skill.addition).toBeGreaterThan(suspState.skill.addition);
  });
});

describe('chooseNextQuestion', () => {
  it('produces difficulty within clamp range', () => {
    const state = createInitialState();
    for (let i = 0; i < 50; i++) {
      const plan = chooseNextQuestion(state, [...OPERATIONS]);
      expect(plan.difficulty).toBeGreaterThanOrEqual(ADAPTIVE_SKILL_MIN);
      expect(plan.difficulty).toBeLessThanOrEqual(ADAPTIVE_SKILL_MAX);
      expect(OPERATIONS).toContain(plan.operation);
    }
  });

  it('targets roughly 70–80% expected win rate given the difficulty offset', () => {
    const state = createInitialState({ addition: 3.0 });
    const plan  = chooseNextQuestion(state, ['addition'], () => 0.5);
    const win   = expectedWin(state.skill.addition, plan.difficulty);
    expect(win).toBeGreaterThan(0.65);
    expect(win).toBeLessThan(0.85);
  });
});

describe('skillLevelCrossings', () => {
  it('reports integer threshold crossings', () => {
    const prev = createInitialState({ addition: 2.98 });
    const next = { ...prev, skill: { ...prev.skill, addition: 3.02 } };
    const crossings = skillLevelCrossings(prev, next);
    expect(crossings).toHaveLength(1);
    expect(crossings[0]).toMatchObject({ operation: 'addition', from: 2, to: 3 });
  });

  it('returns empty when no threshold crossed', () => {
    const prev = createInitialState({ addition: 2.2 });
    const next = { ...prev, skill: { ...prev.skill, addition: 2.8 } };
    expect(skillLevelCrossings(prev, next)).toHaveLength(0);
  });
});
