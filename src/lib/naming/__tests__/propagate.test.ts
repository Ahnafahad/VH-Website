import { describe, it, expect } from 'vitest';
import { planPropagation, LinkedClass, AppliedRename } from '../propagate';

const MAT = { course: 'iba', subject: 'english', docType: 'lecture', number: '3', topic: 'Vocabulary Guide' } as const;

describe('planPropagation — decision logic (pure, no DB)', () => {
  it('leaves a protected class (already has a real lesson name) untouched', () => {
    const classes: LinkedClass[] = [
      { id: 1, title: 'English Class 1 – Foundation Grammar Skills', subject: 'english', topic: null, product: 'iba', classNumber: null },
    ];
    expect(planPropagation(classes, MAT)).toEqual([]);
  });

  it('renames an unnamed class ("Thursday Class") to inherit the material identity', () => {
    const classes: LinkedClass[] = [
      { id: 2, title: 'Thursday Class', subject: 'tbd', topic: null, product: 'iba', classNumber: null },
    ];
    expect(planPropagation(classes, MAT)).toEqual([
      { id: 2, subject: 'english', topic: 'Vocabulary Guide', classNumber: null, title: 'IBA English Class — Vocabulary Guide' },
    ]);
  });

  it('is idempotent — applying the rename once protects the class on the next run', () => {
    const classes: LinkedClass[] = [
      { id: 3, title: 'English Class 3', subject: 'english', topic: null, product: 'iba', classNumber: 3 },
    ];
    const firstRun = planPropagation(classes, MAT);
    expect(firstRun).toHaveLength(1);

    // Simulate the DB write the caller performs with the first run's result,
    // then run propagation again on the now-renamed class.
    const applied: AppliedRename = firstRun[0];
    const afterWrite: LinkedClass[] = [
      { id: applied.id, title: applied.title, subject: applied.subject, topic: applied.topic, product: 'iba', classNumber: applied.classNumber },
    ];
    expect(planPropagation(afterWrite, MAT)).toEqual([]);
  });

  it('mixes protected and unnamed classes linked to the same material', () => {
    const classes: LinkedClass[] = [
      { id: 4, title: 'Monday Class', subject: 'tbd', topic: null, product: 'iba', classNumber: null },
      { id: 5, title: 'Tuesday Class – Idioms', subject: 'english', topic: null, product: 'iba', classNumber: null },
    ];
    const result = planPropagation(classes, MAT);
    expect(result.map(r => r.id)).toEqual([4]);
  });

  it('returns an empty array when there are no linked classes', () => {
    expect(planPropagation([], MAT)).toEqual([]);
  });
});
