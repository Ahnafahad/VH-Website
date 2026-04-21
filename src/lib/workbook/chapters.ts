import type { WorkbookPart, WorkbookChapter } from './types';

// ─── Chapter registry ─────────────────────────────────────────────────────────
// Add new chapters here as they are parsed and reviewed.

export const WORKBOOK_PARTS: WorkbookPart[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    chapters: [
      // { slug: 'introduction', part: 'Introduction', partSlug: 'introduction', chapterNumber: 0, title: 'Introduction', estimatedMinutes: 30 },
    ],
  },
  {
    slug: 'mathematics',
    title: 'Mathematics',
    chapters: [
      { slug: 'ratio-percentages', part: 'Mathematics', partSlug: 'mathematics', chapterNumber: 1, title: 'Ratio & Percentages', estimatedMinutes: 45 },
      // { slug: 'average', part: 'Mathematics', partSlug: 'mathematics', chapterNumber: 2, title: 'Average', estimatedMinutes: 35 },
      // { slug: 'profit-loss', part: 'Mathematics', partSlug: 'mathematics', chapterNumber: 3, title: 'Profit & Loss', estimatedMinutes: 35 },
      // { slug: 'factors-divisibility', part: 'Mathematics', partSlug: 'mathematics', chapterNumber: 4, title: 'Factors & Divisibility', estimatedMinutes: 35 },
      // { slug: 'inequality', part: 'Mathematics', partSlug: 'mathematics', chapterNumber: 5, title: 'Inequality', estimatedMinutes: 30 },
    ],
  },
  {
    slug: 'verbal',
    title: 'Verbal',
    chapters: [
      // { slug: 'grammar', part: 'Verbal', partSlug: 'verbal', chapterNumber: 6, title: 'Grammar', estimatedMinutes: 40 },
      // { slug: 'vocabulary', part: 'Verbal', partSlug: 'verbal', chapterNumber: 8, title: 'Vocabulary', estimatedMinutes: 50 },
      // { slug: 'reading-comprehension', part: 'Verbal', partSlug: 'verbal', chapterNumber: 9, title: 'Reading Comprehension', estimatedMinutes: 45 },
    ],
  },
  {
    slug: 'analytical',
    title: 'Analytical Reasoning',
    chapters: [
      // { slug: 'analytical-puzzles', part: 'Analytical Reasoning', partSlug: 'analytical', chapterNumber: 10, title: 'Analytical Puzzles', estimatedMinutes: 40 },
    ],
  },
];

export function getAllChapters() {
  return WORKBOOK_PARTS.flatMap(p => p.chapters);
}

export function getChapterMeta(partSlug: string, chapterSlug: string) {
  const part = WORKBOOK_PARTS.find(p => p.slug === partSlug);
  return part?.chapters.find(c => c.slug === chapterSlug) ?? null;
}

export function loadChapter(chapterSlug: string): WorkbookChapter {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(`@/content/workbook/${chapterSlug}.json`) as WorkbookChapter;
}

export function getAdjacentChapters(chapterSlug: string) {
  const all = getAllChapters();
  const idx = all.findIndex(c => c.slug === chapterSlug);
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}

export const TOTAL_CHAPTERS = getAllChapters().length;
