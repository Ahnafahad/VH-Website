'use client';

import { useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import type { DashboardResults, DashboardSectionScore } from '@/lib/lms/dashboard-data';

interface Props {
  results: DashboardResults;
}

function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(epochMs));
}

function SectionBar({ section, prefersReduced }: { section: DashboardSectionScore; prefersReduced: boolean | null }) {
  const ratio = section.maxScore > 0 ? section.score / section.maxScore : 0;
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!barRef.current) return;
    if (prefersReduced) {
      barRef.current.style.transform = `scaleX(${ratio})`;
      return;
    }
    // Slight delay so it animates on mount
    const t = setTimeout(() => {
      if (barRef.current) barRef.current.style.transform = `scaleX(${ratio})`;
    }, 80);
    return () => clearTimeout(t);
  }, [ratio, prefersReduced]);

  return (
    <div className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid rgba(212,176,148,0.16)' }}>
      <span className="text-sm flex-1 min-w-0" style={{ color: 'rgba(250,245,239,0.64)' }}>
        {section.title}
      </span>
      <span
        className="text-sm flex-shrink-0"
        style={{
          fontFamily: 'var(--font-math-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: '#FAF5EF',
        }}
      >
        {section.score}/{section.maxScore}
      </span>
      {/* Track */}
      <div
        className="w-20 h-0.5 flex-shrink-0 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(212,176,148,0.16)' }}
      >
        <div
          ref={barRef}
          className="h-full rounded-full origin-left"
          style={{
            backgroundColor: '#D4B094',
            transform: 'scaleX(0)',
            transition: prefersReduced ? 'none' : 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
    </div>
  );
}

export default function ResultsHub({ results }: Props) {
  const prefersReduced = useReducedMotion();
  const { latest, history } = results;

  return (
    <div>
      {/* Section marker */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className="font-heading italic text-sm flex-shrink-0"
          style={{ color: '#D4B094' }}
        >
          results
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
      </div>

      {!latest ? (
        /* Empty state */
        <div className="flex flex-col items-start gap-2 py-4">
          <FlaskConical
            className="w-6 h-6"
            style={{ color: 'rgba(250,245,239,0.40)' }}
            strokeWidth={1.25}
          />
          <p className="text-base" style={{ color: 'rgba(250,245,239,0.64)' }}>
            No published results yet — your first mock is coming.
          </p>
          <Link
            href="/tests"
            className="text-sm transition-all"
            style={{ color: '#D4B094' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Browse available tests
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Latest result feature block */}
          <div>
            <h3
              className="font-heading font-medium text-xl mb-1"
              style={{ color: '#FAF5EF', letterSpacing: '-0.01em' }}
            >
              {latest.title}
            </h3>
            <p
              className="text-sm mb-4"
              style={{
                fontFamily: 'var(--font-math-mono)',
                fontVariantNumeric: 'tabular-nums',
                color: 'rgba(250,245,239,0.64)',
              }}
            >
              <span style={{ color: '#FAF5EF' }}>{latest.totalScore}/{latest.totalMarks}</span>
              {' · '}rank{' '}
              <span style={{ color: '#FAF5EF' }}>#{latest.rank}</span>
              {' '}of{' '}
              <span style={{ color: '#FAF5EF' }}>{latest.totalStudents}</span>
              {' · '}
              <span style={{ color: '#FAF5EF' }}>{latest.percentile}th</span> percentile
            </p>

            {/* Section bars */}
            {latest.sections.length > 0 && (
              <div className="flex flex-col">
                {latest.sections.map((section, i) => (
                  <SectionBar key={i} section={section} prefersReduced={prefersReduced} />
                ))}
              </div>
            )}
          </div>

          {/* History rows (skip index 0 = latest) */}
          {history.length > 1 && (
            <div className="flex flex-col">
              {history.slice(1).map((entry) => (
                <Link
                  key={entry.testId}
                  href={`/tests/${entry.bucket}/${entry.slug}/results`}
                  className="flex items-center gap-3 py-2.5 transition-colors min-h-[44px]"
                  style={{ borderBottom: '1px solid rgba(212,176,148,0.16)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#D4B094'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ''; }}
                >
                  <span
                    className="flex-1 text-sm min-w-0 truncate"
                    style={{ color: '#FAF5EF' }}
                  >
                    {entry.title}
                  </span>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{
                      fontFamily: 'var(--font-math-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'rgba(250,245,239,0.64)',
                    }}
                  >
                    {formatDate(entry.submittedAt)}
                  </span>
                  <span
                    className="text-sm flex-shrink-0"
                    style={{
                      fontFamily: 'var(--font-math-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#FAF5EF',
                    }}
                  >
                    {entry.totalScore}/{entry.totalMarks}
                  </span>
                  <span
                    className="text-sm flex-shrink-0"
                    style={{ color: '#D4B094', fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    #{entry.rank}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Footer link */}
          <Link
            href="/tests"
            className="text-sm w-fit transition-all"
            style={{ color: '#D4B094' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            All results →
          </Link>
        </div>
      )}
    </div>
  );
}
