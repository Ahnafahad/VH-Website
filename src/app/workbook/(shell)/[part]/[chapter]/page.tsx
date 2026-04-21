'use client';

import React from 'react';
import { notFound } from 'next/navigation';
import { getChapterMeta, loadChapter, getAdjacentChapters } from '@/lib/workbook/chapters';
import ChapterReader from '@/components/workbook/ChapterReader';
import MiniTOC from '@/components/workbook/MiniTOC';
import { useWorkbookProgress } from '../../WorkbookShellClient';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WorkbookProgressStatus } from '@/lib/workbook/types';

interface PageProps {
  params: Promise<{ part: string; chapter: string }>;
}

export default function ChapterPage({ params }: PageProps) {
  const { part, chapter: chapterSlug } = React.use(params);
  const { progressMap, updateProgress } = useWorkbookProgress();

  const meta = getChapterMeta(part, chapterSlug);
  if (!meta) notFound();

  const chapterData = loadChapter(chapterSlug);
  const { prev, next } = getAdjacentChapters(chapterSlug);

  const progress: WorkbookProgressStatus = progressMap[chapterSlug] ?? 'not_started';

  function handleAnchorChange(anchor: string, percent: number) {
    // POST progress update to API
    fetch('/api/workbook/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterSlug,
        status: 'in_progress',
        lastAnchor: anchor,
        percentRead: percent,
      }),
    }).catch(() => {});

    if (progress === 'not_started') {
      updateProgress(chapterSlug, 'in_progress');
    }
  }

  function handleComplete() {
    fetch('/api/workbook/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterSlug,
        status: 'completed',
        percentRead: 100,
      }),
    }).catch(() => {});

    updateProgress(chapterSlug, 'completed');
  }

  return (
    <div className="wb-chapter-layout">
      <div className="wb-chapter-col">
        <ChapterReader
          chapter={chapterData}
          progress={progress}
          onComplete={handleComplete}
          onAnchorChange={handleAnchorChange}
        />

        {/* Prev / Next navigation */}
        <div className="wb-chapter-nav">
          {prev ? (
            <Link href={`/workbook/${prev.partSlug}/${prev.slug}`} className="wb-nav-btn wb-nav-btn--prev">
              <ChevronLeft size={16} />
              <div>
                <span className="wb-nav-label">Previous</span>
                <span className="wb-nav-title">{prev.title}</span>
              </div>
            </Link>
          ) : <div />}

          {next ? (
            <Link href={`/workbook/${next.partSlug}/${next.slug}`} className="wb-nav-btn wb-nav-btn--next">
              <div>
                <span className="wb-nav-label">Next</span>
                <span className="wb-nav-title">{next.title}</span>
              </div>
              <ChevronRight size={16} />
            </Link>
          ) : <div />}
        </div>
      </div>

      {/* Right mini-TOC (desktop xl+) */}
      <aside className="wb-minitoc-col">
        <MiniTOC sections={chapterData.sections} />
      </aside>
    </div>
  );
}
