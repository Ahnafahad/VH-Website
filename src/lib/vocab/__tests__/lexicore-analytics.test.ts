import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));
const { featureOf, sourceOf } = await import('../lexicore-analytics');

describe('featureOf', () => {
  it('buckets LexiCore paths', () => {
    expect(featureOf('/vocab/study/98')).toBe('Flashcards by theme');
    expect(featureOf('/vocab/study/98/quiz')).toBe('Quizzes');
    expect(featureOf('/vocab/practice/quiz')).toBe('Quizzes');
    expect(featureOf('/vocab/study/letter/A')).toBe('Flashcards A–Z');
    expect(featureOf('/vocab/study/review')).toBe('Review');
    expect(featureOf('/vocab/review')).toBe('Review');
    expect(featureOf('/vocab/games/word-hunt')).toBe('Game: word hunt');
    expect(featureOf('/vocab/games')).toBe('Games menu');
    expect(featureOf('/vocab/home')).toBe('Home');
    expect(featureOf('/lexicore')).toBe('Landing page');
    expect(featureOf('/lexicore/upgrade')).toBe('Upgrade page');
    expect(featureOf('/vocab/whatever')).toBe('Other');
  });
});

describe('sourceOf', () => {
  it('names traffic sources', () => {
    expect(sourceOf('https://www.facebook.com/', null)).toBe('Facebook');
    expect(sourceOf('http://m.facebook.com', null)).toBe('Facebook');
    expect(sourceOf(null, null)).toBe('Direct / app link');
    expect(sourceOf('https://www.google.com/', null)).toBe('Google');
  });
});
