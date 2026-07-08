'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { FlaskConical, ChevronDown, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import type { DashboardUpcomingTest } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  upcomingTests: DashboardUpcomingTest[];
}

const tileVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.005, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

const STATE_STYLES: Record<string, { label: string; color: string }> = {
  upcoming:  { label: 'Opens soon', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  open:      { label: 'Open now',   color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  closed:    { label: 'Closed',     color: 'text-stone-500 bg-stone-50 border-stone-200' },
};

export default function UpcomingTestTile({ upcomingTests }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (upcomingTests.length === 0) {
    return (
      <motion.div
        variants={tileVariants}
        initial="rest"
        whileHover="hover"
        className="rounded-2xl border border-[#E8DDD5] bg-[#FAF5EF] p-4 flex flex-col items-center justify-center gap-2 min-h-[80px]"
      >
        <FlaskConical className="w-6 h-6 text-[#D4B094]" strokeWidth={1.25} />
        <p className="text-xs text-[#7A4A35]">No upcoming tests right now.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={tileVariants}
      initial="rest"
      whileHover="hover"
      className="rounded-2xl border border-[#E8DDD5] bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06), 0 4px 16px rgba(90,11,15,0.03)' }}
    >
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />
          <p className="text-[10px] font-sans uppercase tracking-widest text-[#A86E58]">Upcoming tests</p>
        </div>

        <div className="flex flex-col gap-2">
          {upcomingTests.map((t, i) => {
            const isExpanded = expandedId === t.id;
            const firstWindow = t.windows[0];
            const windowState = firstWindow?.state ?? 'closed';
            const stateStyle = STATE_STYLES[windowState] ?? STATE_STYLES.closed;
            const attempted = t.myAttempt !== null;

            return (
              <div key={t.id} className="border border-[#F0E8E0] rounded-xl overflow-hidden">
                <motion.button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, type: 'spring' as const, stiffness: 300, damping: 26 }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-[#FAF5EF] transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A0507] line-clamp-1">{t.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${stateStyle.color}`}>
                        {stateStyle.label}
                      </span>
                      {firstWindow && (
                        <span className="text-[10px] text-[#A86E58]">
                          {formatDhaka(new Date(firstWindow.opensAt), 'date')}
                        </span>
                      )}
                      {attempted && (
                        <span className="flex items-center gap-0.5 text-[10px] text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                          {t.myAttempt?.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 28 }}
                  >
                    <ChevronDown className="w-4 h-4 text-[#D4B094]" strokeWidth={1.5} />
                  </motion.span>
                </motion.button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring' as const, stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 border-t border-[#F0E8E0] pt-2 flex flex-col gap-2">
                        {t.syllabus && (
                          <div className="text-xs text-[#5A0B0F]/70 leading-relaxed whitespace-pre-line line-clamp-4">
                            {t.syllabus}
                          </div>
                        )}
                        <Link
                          href={`/tests/${t.bucket}/${t.slug}`}
                          className="flex items-center gap-1.5 text-xs font-medium text-[#760F13] hover:text-[#5A0B0F] transition-colors w-fit"
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
      </div>
    </motion.div>
  );
}
