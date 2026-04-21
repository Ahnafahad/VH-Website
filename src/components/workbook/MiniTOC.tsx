'use client';

import React from 'react';
import type { WorkbookSection } from '@/lib/workbook/types';

interface MiniTOCProps {
  sections: WorkbookSection[];
}

export default function MiniTOC({ sections }: MiniTOCProps) {
  const [active, setActive] = React.useState<string>('');

  React.useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { threshold: 0.1, rootMargin: '-10% 0px -70% 0px' }
    );

    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav className="wb-minitoc">
      <p className="wb-minitoc-label">On this page</p>
      <ul className="wb-minitoc-list">
        {sections.map(s => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={`wb-minitoc-link ${active === s.id ? 'wb-minitoc-link--active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
