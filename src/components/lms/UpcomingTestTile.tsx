'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { FlaskConical, ChevronDown, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import type { DashboardUpcomingTest } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  upcomingTests: DashboardUpcomingTest[];
}

function WindowStateLabel({ state, opensAt }: { state: string; opensAt: number }) {
  if (state === 'open') {
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: '#7DDFA3' }}>
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: '#7DDFA3' }}
        />
        open now
      </span>
    );
  }
  if (state === 'upcoming') {
    return (
      <span
        className="text-xs"
        style={{
          color: 'rgba(250,245,239,0.64)',
          fontFamily: 'var(--font-math-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        opens {formatDhaka(new Date(opensAt), 'date')}
      </span>
    );
  }
  return (
    <span className="text-xs lowercase" style={{ color: 'rgba(250,245,239,0.40)' }}>
      closed
    </span>
  );
}

export default function UpcomingTestTile({ upcomingTests }: Props) {
  const prefersReduced = useReducedMotion();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div id="tests">
      {/* Section marker */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className="font-heading italic text-sm flex-shrink-0"
          style={{ color: '#D4B094' }}
        >
          upcoming tests
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
      </div>

      {upcomingTests.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-4">
          <FlaskConical
            className="w-6 h-6"
            style={{ color: 'rgba(250,245,239,0.40)' }}
            strokeWidth={1.25}
          />
          <p className="text-base" style={{ color: 'rgba(250,245,239,0.64)' }}>
            No upcoming tests right now.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {upcomingTests.map((t) => {
            const isExpanded = expandedId === t.id;
            const firstWindow = t.windows[0];
            const windowState = firstWindow?.state ?? 'closed';
            const attempted = t.myAttempt !== null;

            return (
              <div
                key={t.id}
                style={{ borderBottom: '1px solid rgba(212,176,148,0.16)' }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="w-full flex items-center gap-3 py-3 min-h-[44px] text-left transition-opacity hover:opacity-80"
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate mb-1"
                      style={{ color: '#FAF5EF' }}
                    >
                      {t.title}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {firstWindow && (
                        <WindowStateLabel state={windowState} opensAt={firstWindow.opensAt} />
                      )}
                      {attempted && (
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: 'rgba(250,245,239,0.64)' }}
                        >
                          <CheckCircle2
                            className="w-3 h-3"
                            style={{ color: '#7DDFA3' }}
                            strokeWidth={2}
                          />
                          {t.myAttempt?.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={
                      prefersReduced
                        ? { duration: 0 }
                        : { type: 'spring' as const, stiffness: 300, damping: 28 }
                    }
                    className="flex-shrink-0"
                  >
                    <ChevronDown
                      className="w-4 h-4"
                      style={{ color: 'rgba(212,176,148,0.40)' }}
                      strokeWidth={1.5}
                    />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={
                        prefersReduced
                          ? { duration: 0 }
                          : {
                              type: 'spring' as const,
                              stiffness: 300,
                              damping: 30,
                              opacity: { duration: 0.2 },
                            }
                      }
                      className="overflow-hidden"
                    >
                      <div
                        className="pb-3 flex flex-col gap-2"
                        style={{ borderTop: '1px solid rgba(212,176,148,0.16)', paddingTop: '0.5rem' }}
                      >
                        {t.syllabus && (
                          <p
                            className="text-sm leading-relaxed whitespace-pre-line line-clamp-4"
                            style={{ color: 'rgba(250,245,239,0.64)' }}
                          >
                            {t.syllabus}
                          </p>
                        )}
                        <Link
                          href={`/tests/${t.bucket}/${t.slug}`}
                          className="flex items-center gap-1.5 text-sm w-fit transition-all"
                          style={{ color: '#D4B094' }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {attempted ? 'View results' : 'Start test'}
                          <ArrowRight className="w-3 h-3" strokeWidth={2} />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
