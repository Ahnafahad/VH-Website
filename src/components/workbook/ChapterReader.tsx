'use client';

import React from 'react';
import type { WorkbookChapter, WorkbookBlock, WorkbookProgressStatus } from '@/lib/workbook/types';
import {
  SectionHeading, SubsectionHeading, SubsubsectionHeading,
  ProseBlock, MathBlock, ListBlock, TableBlock,
  DefinitionCard, NoteCard, RuleCard, PassageCard, UsageNoteCard, ChallengeCard,
  McqBlock,
} from '@/components/workbook/blocks';
import RichText from '@/components/workbook/RichText';
import { Clock, CheckCircle } from 'lucide-react';

interface ChapterReaderProps {
  chapter: WorkbookChapter;
  progress: WorkbookProgressStatus;
  lastAnchor?: string | null;
  onComplete: () => void;
  onAnchorChange: (anchor: string, percent: number) => void;
}

export default function ChapterReader({
  chapter,
  progress,
  onComplete,
  onAnchorChange,
}: ChapterReaderProps) {
  const anchorRefs = React.useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const containerRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // IntersectionObserver for progress tracking
  React.useEffect(() => {
    const anchors = document.querySelectorAll('[data-wb-anchor]');
    if (anchors.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          anchorRefs.current.set(entry.target.id, entry);
        });

        // Debounce the progress update
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          // Find the last visible anchor
          const visible = [...anchorRefs.current.entries()]
            .filter(([, e]) => e.isIntersecting)
            .map(([id]) => id);

          if (visible.length === 0) return;
          const lastVisible = visible[visible.length - 1];

          // Estimate percent read
          const allIds = Array.from(anchors).map(a => a.id);
          const idx = allIds.indexOf(lastVisible);
          const percent = Math.round(((idx + 1) / allIds.length) * 100);
          onAnchorChange(lastVisible, percent);
        }, 600);
      },
      { threshold: 0.1, rootMargin: '0px 0px -30% 0px' }
    );

    anchors.forEach(a => observer.observe(a));
    return () => { observer.disconnect(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onAnchorChange]);

  const isCompleted = progress === 'completed';

  return (
    <div ref={containerRef} className="wb-reader">
      {/* Chapter header */}
      <div className="wb-chapter-header">
        {/* Ghost chapter number — decorative, sits behind the title */}
        <span className="wb-chapter-ghost-num" aria-hidden>
          {String(chapter.chapterNumber).padStart(2, '0')}
        </span>
        <div className="wb-chapter-meta">
          <Clock size={13} />
          <span>{chapter.estimatedMinutes} min read</span>
        </div>
        <h1 className="wb-chapter-title">
          <RichText content={chapter.title} />
        </h1>
        <div className="wb-chapter-divider" />
      </div>

      {/* Blocks */}
      {chapter.blocks.map(block => (
        <BlockRenderer key={block.id} block={block} chapterSlug={chapter.slug} />
      ))}

      {/* Footer: mark complete */}
      <div className="wb-chapter-footer">
        {isCompleted ? (
          <div className="wb-complete-badge">
            <CheckCircle size={18} />
            <span>Chapter completed</span>
          </div>
        ) : (
          <button onClick={onComplete} className="wb-complete-btn">
            Mark chapter as complete
          </button>
        )}
      </div>
    </div>
  );
}

function BlockRenderer({ block, chapterSlug }: { block: WorkbookBlock; chapterSlug: string }) {
  // Wrap heading blocks with an anchor sentinel for scrollspy
  const withAnchor = (node: React.ReactNode) => {
    if (!block.anchor) return node;
    return (
      <span id={block.anchor} data-wb-anchor>
        {node}
      </span>
    );
  };

  switch (block.type) {
    case 'section':      return withAnchor(<SectionHeading block={block} />);
    case 'subsection':   return withAnchor(<SubsectionHeading block={block} />);
    case 'subsubsection': return withAnchor(<SubsubsectionHeading block={block} />);
    case 'prose':        return <ProseBlock block={block} />;
    case 'math':         return <MathBlock block={block} />;
    case 'list':         return <ListBlock block={block} />;
    case 'table':        return <TableBlock block={block} />;
    case 'definition':   return <DefinitionCard block={block} />;
    case 'note':         return <NoteCard block={block} />;
    case 'rule':         return <RuleCard block={block} />;
    case 'passage':      return <PassageCard block={block} />;
    case 'usageNote':    return <UsageNoteCard block={block} />;
    case 'challenge':    return <ChallengeCard block={block} />;
    case 'mcq':          return <McqBlock block={block} chapterSlug={chapterSlug} />;
    default:             return null;
  }
}
