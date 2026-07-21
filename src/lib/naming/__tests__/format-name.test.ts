import { describe, it, expect } from 'vitest';
import { formatMaterialName, formatClassName } from '../format-name';

describe('formatMaterialName', () => {
  it('formats a lecture with number, no topic', () => {
    expect(formatMaterialName({ course: 'iba', subject: 'math', docType: 'lecture', number: '1.3' }))
      .toBe('IBA Math Lecture 1.3');
  });

  it('formats a solution with number, no topic', () => {
    expect(formatMaterialName({ course: 'iba', subject: 'math', docType: 'solution', number: '1.3' }))
      .toBe('IBA Math Solution 1.3');
  });

  it('formats a lecture with number and topic', () => {
    expect(formatMaterialName({
      course: 'iba', subject: 'english', docType: 'lecture', number: '4', topic: 'Advanced Sentence Structures',
    })).toBe('IBA English Lecture 4 — Advanced Sentence Structures');
  });

  it('formats a question paper with number, no topic', () => {
    expect(formatMaterialName({ course: 'iba', subject: 'english', docType: 'question_paper', number: '2' }))
      .toBe('IBA English Question Paper 2');
  });

  it('omits the number cleanly when absent', () => {
    expect(formatMaterialName({ course: 'iba', subject: 'math', docType: 'lecture' }))
      .toBe('IBA Math Lecture');
  });

  it('omits the em-dash and topic cleanly when topic is absent', () => {
    expect(formatMaterialName({ course: 'iba', subject: 'math', docType: 'lecture', number: '1.3', topic: null }))
      .toBe('IBA Math Lecture 1.3');
  });

  it('omits both number and topic cleanly when both are absent', () => {
    expect(formatMaterialName({ course: 'iba', subject: 'math', docType: 'notes' }))
      .toBe('IBA Math Notes');
  });
});

describe('formatClassName', () => {
  it('formats a class with number and topic', () => {
    expect(formatClassName({ course: 'iba', subject: 'math', classNumber: 3, topic: 'Lecture 1.3' }))
      .toBe('IBA Math Class 3 — Lecture 1.3');
  });

  it('formats a class with number and topic (english)', () => {
    expect(formatClassName({ course: 'iba', subject: 'english', classNumber: 2, topic: 'Punctuation & Commas' }))
      .toBe('IBA English Class 2 — Punctuation & Commas');
  });

  it('omits the topic cleanly when absent', () => {
    expect(formatClassName({ course: 'iba', subject: 'math', classNumber: 3 }))
      .toBe('IBA Math Class 3');
  });

  it('omits the number cleanly when absent', () => {
    expect(formatClassName({ course: 'iba', subject: 'math', topic: 'Intro' }))
      .toBe('IBA Math Class — Intro');
  });

  it('omits both number and topic cleanly when both are absent', () => {
    expect(formatClassName({ course: 'iba', subject: 'math' }))
      .toBe('IBA Math Class');
  });
});
