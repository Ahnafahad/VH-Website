import { describe, it, expect } from 'vitest';
import { classUsableName, planClassRenameFromMaterial, cleanHeading } from '../class-link';

const MAT = { course: 'iba', subject: 'english', docType: 'lecture', number: '3', topic: 'Vocabulary Guide' } as const;

describe('classUsableName', () => {
  it('prefers an explicit topic', () =>
    expect(classUsableName({ title: 'Thursday Class', subject: 'tbd', topic: 'Ratios' })).toBe('Ratios'));

  it('falls back to the text after an en-dash separator', () =>
    expect(classUsableName({ title: 'English Class 2 – Punctuation & Commas', subject: 'english', topic: null }))
      .toBe('Punctuation & Commas'));

  it('handles a hyphen separator too', () =>
    expect(classUsableName({ title: 'Math Class 1 - Lecture 1.1', subject: 'math', topic: null }))
      .toBe('Lecture 1.1'));

  it('returns null for a bare placeholder title', () =>
    expect(classUsableName({ title: 'Thursday Class', subject: 'tbd', topic: null })).toBeNull());

  it('returns null for a null session', () =>
    expect(classUsableName(null)).toBeNull());
});

describe('planClassRenameFromMaterial — the never-clobber gate + inheritance', () => {
  const base = { product: 'iba', classNumber: null };

  it('returns null (never touched) for a class that already has a real name', () =>
    expect(planClassRenameFromMaterial(
      { ...base, title: 'English Class 1 – Foundation Grammar Skills', subject: 'english', topic: null }, MAT))
      .toBeNull());

  it('returns null for a class with an explicit topic', () =>
    expect(planClassRenameFromMaterial({ ...base, title: 'Thursday Class', subject: 'tbd', topic: 'Ratios' }, MAT))
      .toBeNull());

  it('"English Class 3" (no lesson name) inherits the material topic + keeps its number', () =>
    expect(planClassRenameFromMaterial({ ...base, title: 'English Class 3', subject: 'english', topic: null }, MAT))
      .toEqual({ subject: 'english', topic: 'Vocabulary Guide', classNumber: 3, title: 'IBA English Class 3 — Vocabulary Guide' }));

  it('a tbd "Thursday Class" inherits subject from the material', () =>
    expect(planClassRenameFromMaterial({ ...base, title: 'Thursday Class', subject: 'tbd', topic: null }, MAT))
      .toEqual({ subject: 'english', topic: 'Vocabulary Guide', classNumber: null, title: 'IBA English Class — Vocabulary Guide' }));

  it('a topic-less material contributes its type+number as the name', () =>
    expect(planClassRenameFromMaterial(
      { ...base, title: 'Monday Class', subject: 'tbd', topic: null },
      { course: 'iba', subject: 'math', docType: 'lecture', number: '1.1', topic: '' }))
      .toEqual({ subject: 'math', topic: 'Lecture 1.1', classNumber: null, title: 'IBA Math Class — Lecture 1.1' }));
});

describe('cleanHeading — PDF garbage guard', () => {
  it('accepts a plausible short title', () =>
    expect(cleanHeading('Punctuation & Commas')).toBe('Punctuation & Commas'));

  it('trims surrounding whitespace', () =>
    expect(cleanHeading('  Ratios  ')).toBe('Ratios'));

  it.each([
    ['', 'empty'],
    ['ab', 'too short'],
    ['Page 4', 'page number'],
    ['12345', 'all digits'],
    ['....', 'no letters'],
    ['Beyond the Horizons', 'brand name'],
    ['BTH', 'brand acronym'],
    ['This is clearly a full sentence of body text not a title', 'too many words'],
    ['x'.repeat(61), 'too long'],
  ])('rejects %s (%s)', input => expect(cleanHeading(input)).toBeNull());
});
