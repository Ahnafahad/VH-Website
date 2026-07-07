'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { Megaphone, Pin, ChevronDown } from 'lucide-react';
import type { DashboardAnnouncement } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  announcements: DashboardAnnouncement[];
}

const tileVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.005, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

export default function AnnouncementsTile({ announcements }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(
    // Auto-expand first pinned
    announcements.find((a) => a.pinned)?.id ?? null,
  );

  if (announcements.length === 0) {
    return (
      <motion.div
        variants={tileVariants}
        initial="rest"
        whileHover="hover"
        className="rounded-2xl border border-[#E8DDD5] bg-[#FAF5EF] p-5 flex flex-col items-center justify-center gap-2 min-h-[100px]"
      >
        <Megaphone className="w-7 h-7 text-[#D4B094]" strokeWidth={1.25} />
        <p className="text-sm text-[#A86E58]/70">No announcements at the moment.</p>
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
          <Megaphone className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />
          <p className="text-[10px] font-sans uppercase tracking-widest text-[#A86E58]">Announcements</p>
        </div>

        <div className="flex flex-col gap-1.5">
          {announcements.map((ann, i) => {
            const isExpanded = expandedId === ann.id;
            return (
              <div
                key={ann.id}
                className={`border rounded-xl overflow-hidden transition-colors ${
                  ann.pinned ? 'border-[#D4B094]/50 bg-[#FAF5EF]' : 'border-[#F0E8E0]'
                }`}
              >
                <motion.button
                  onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, type: 'spring' as const, stiffness: 300, damping: 26 }}
                  className="w-full flex items-center gap-2.5 p-3 text-left hover:bg-[#F5EDE3]/50 transition-colors"
                >
                  {ann.pinned && (
                    <Pin className="w-3 h-3 text-[#A86E58] flex-shrink-0 rotate-45" strokeWidth={2} />
                  )}
                  <span className="flex-1 text-sm font-medium text-[#1A0507] line-clamp-1">{ann.title}</span>
                  <span className="text-[10px] text-[#A86E58] flex-shrink-0">
                    {formatDhaka(new Date(ann.createdAt), 'date')}
                  </span>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 28 }}
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-[#D4B094]" strokeWidth={1.5} />
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
                      <div className="px-3 pb-3 border-t border-[#F0E8E0]">
                        <p className="text-sm text-[#5A0B0F]/75 leading-relaxed pt-2 whitespace-pre-line">
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
    </motion.div>
  );
}
