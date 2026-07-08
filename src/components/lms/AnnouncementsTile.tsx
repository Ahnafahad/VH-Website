'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Pin, ChevronDown } from 'lucide-react';
import type { DashboardAnnouncement } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  announcements: DashboardAnnouncement[];
}

export default function AnnouncementsTile({ announcements }: Props) {
  const prefersReduced = useReducedMotion();
  const [expandedId, setExpandedId] = useState<number | null>(
    announcements.find((a) => a.pinned)?.id ?? null,
  );

  if (announcements.length === 0) return null;

  return (
    <div>
      {/* Section marker */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className="font-heading italic text-sm flex-shrink-0"
          style={{ color: '#D4B094' }}
        >
          announcements
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
      </div>

      <div className="flex flex-col">
        {announcements.map((ann) => {
          const isExpanded = expandedId === ann.id;

          return (
            <div
              key={ann.id}
              style={{ borderBottom: '1px solid rgba(212,176,148,0.16)' }}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                className="w-full flex items-center gap-2.5 py-3 min-h-[44px] text-left transition-opacity hover:opacity-80"
              >
                {ann.pinned && (
                  <Pin
                    className="w-3.5 h-3.5 flex-shrink-0 rotate-45"
                    style={{ color: '#D4B094' }}
                    strokeWidth={1.5}
                  />
                )}
                <span
                  className="flex-1 text-sm truncate"
                  style={{ color: '#FAF5EF' }}
                >
                  {ann.title}
                </span>
                <span
                  className="text-xs flex-shrink-0"
                  style={{
                    fontFamily: 'var(--font-math-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'rgba(250,245,239,0.40)',
                  }}
                >
                  {formatDhaka(new Date(ann.createdAt), 'date')}
                </span>
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
                    className="w-3.5 h-3.5"
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
                      className="pb-4"
                      style={{ borderTop: '1px solid rgba(212,176,148,0.16)', paddingTop: '0.5rem' }}
                    >
                      <p
                        className="text-sm leading-relaxed whitespace-pre-line"
                        style={{ color: 'rgba(250,245,239,0.64)' }}
                      >
                        {ann.body}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
