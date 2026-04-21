'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WORKBOOK_PARTS } from '@/lib/workbook/chapters';
import type { WorkbookProgressStatus } from '@/lib/workbook/types';
import { CheckCircle, Circle, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarProps {
  progressMap: Record<string, WorkbookProgressStatus>;
  onClose?: () => void;
}

export default function WorkbookSidebar({ progressMap, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [openParts, setOpenParts] = React.useState<Record<string, boolean>>(
    Object.fromEntries(WORKBOOK_PARTS.map(p => [p.slug, true]))
  );

  function togglePart(slug: string) {
    setOpenParts(prev => ({ ...prev, [slug]: !prev[slug] }));
  }

  return (
    <nav className="wb-sidebar">
      {/* Logo / title */}
      <Link href="/workbook" className="wb-sidebar-brand" onClick={onClose}>
        <BookOpen size={16} />
        <span>Workbook</span>
      </Link>

      <div className="wb-sidebar-parts">
        {WORKBOOK_PARTS.map(part => {
          const hasChapters = part.chapters.length > 0;
          return (
            <div key={part.slug} className="wb-sidebar-part">
              <button
                className="wb-sidebar-part-header"
                onClick={() => togglePart(part.slug)}
                disabled={!hasChapters}
              >
                <span className="wb-sidebar-part-title">{part.title}</span>
                {hasChapters && (
                  openParts[part.slug]
                    ? <ChevronDown size={13} />
                    : <ChevronRight size={13} />
                )}
              </button>

              {openParts[part.slug] && hasChapters && (
                <ul className="wb-sidebar-chapters">
                  {part.chapters.map(ch => {
                    const href = `/workbook/${ch.partSlug}/${ch.slug}`;
                    const active = pathname === href;
                    const status = progressMap[ch.slug] ?? 'not_started';

                    return (
                      <li key={ch.slug}>
                        <Link
                          href={href}
                          onClick={onClose}
                          className={`wb-sidebar-chapter ${active ? 'wb-sidebar-chapter--active' : ''}`}
                        >
                          <span className="wb-sidebar-chapter-icon">
                            {status === 'completed'
                              ? <CheckCircle size={14} className="text-green-600" />
                              : <Circle size={14} className={status === 'in_progress' ? 'text-amber-500' : 'text-stone-300'} />
                            }
                          </span>
                          <span className="wb-sidebar-chapter-title">{ch.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!hasChapters && (
                <p className="wb-sidebar-coming-soon">Coming soon</p>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
