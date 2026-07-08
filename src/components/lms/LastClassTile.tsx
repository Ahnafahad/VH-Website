'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { FileText, Link2, PlayCircle, ChevronDown, BookOpen } from 'lucide-react';
import Link from 'next/link';
import type { DashboardLastClass } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  lastClass: DashboardLastClass | null;
}

const tileVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.005, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

const RECORDING_STATUS_MAP: Record<string, { label: string; color: string; linked: boolean }> = {
  pending:    { label: 'Recording pending',   color: 'text-[#A86E58] bg-amber-50 border-amber-200',    linked: false },
  processing: { label: 'Processing…',         color: 'text-blue-600 bg-blue-50 border-blue-200',        linked: false },
  available:  { label: 'Watch recording',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200', linked: true },
  failed:     { label: 'Recording failed',    color: 'text-red-600 bg-red-50 border-red-200',           linked: false },
  expired:    { label: 'Recording expired',   color: 'text-stone-500 bg-stone-50 border-stone-200',     linked: false },
};

export default function LastClassTile({ lastClass }: Props) {
  const [materialsExpanded, setMaterialsExpanded] = useState(false);

  if (!lastClass) {
    return (
      <motion.div
        variants={tileVariants}
        initial="rest"
        whileHover="hover"
        className="rounded-2xl border border-[#E8DDD5] bg-[#FAF5EF] p-4 flex flex-col items-center justify-center gap-2 min-h-[80px]"
      >
        <BookOpen className="w-6 h-6 text-[#D4B094]" strokeWidth={1.25} />
        <p className="text-xs text-[#7A4A35] text-center">No completed classes yet.</p>
      </motion.div>
    );
  }

  const scheduledDate = new Date(lastClass.scheduledAt);
  const recInfo = lastClass.recording ? RECORDING_STATUS_MAP[lastClass.recording.status] : null;

  const hasMaterials = lastClass.materials.length > 0;
  const visibleMaterials = materialsExpanded ? lastClass.materials : lastClass.materials.slice(0, 2);
  const hiddenCount = lastClass.materials.length - 2;

  return (
    <motion.div
      variants={tileVariants}
      initial="rest"
      whileHover="hover"
      className="rounded-2xl border border-[#E8DDD5] bg-white overflow-hidden flex flex-col"
      style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06), 0 4px 16px rgba(90,11,15,0.03)' }}
    >
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <p className="text-[10px] font-sans uppercase tracking-widest text-[#A86E58] mb-0.5">Last class</p>
          <h3 className="font-heading text-base font-semibold text-[#1A0507] line-clamp-2 leading-snug">
            {lastClass.title}
          </h3>
          <p className="text-xs text-[#A86E58] mt-1">{formatDhaka(scheduledDate, 'datetime')}</p>
        </div>

        {/* Recording chip */}
        {recInfo && (
          <div className="flex items-center gap-2">
            <PlayCircle className="w-3.5 h-3.5 flex-shrink-0 text-current" strokeWidth={1.5} />
            {recInfo.linked ? (
              <Link
                href={`/dashboard/classes/${lastClass.id}/recording`}
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full border hover:opacity-80 transition-opacity ${recInfo.color}`}
              >
                {recInfo.label}
              </Link>
            ) : (
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${recInfo.color}`}>
                {recInfo.label}
              </span>
            )}
          </div>
        )}

        {/* Materials */}
        {hasMaterials && (
          <div className="border-t border-[#F0E8E0] pt-3 flex flex-col gap-1.5">
            <p className="text-[10px] uppercase tracking-widest text-[#A86E58] font-sans mb-1">Materials</p>
            {visibleMaterials.map((mat) => (
              <motion.a
                key={mat.id}
                href={mat.type === 'pdf' ? `/dashboard/materials/${mat.id}` : mat.blobUrl}
                target={mat.type === 'pdf' ? undefined : '_blank'}
                rel={mat.type === 'pdf' ? undefined : 'noopener noreferrer'}
                whileHover={{ x: 2 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
                className="flex items-center gap-2 text-xs text-[#5A0B0F] hover:text-[#760F13] transition-colors group"
              >
                {mat.type === 'pdf' ? (
                  <FileText className="w-3.5 h-3.5 text-[#D4B094] flex-shrink-0" strokeWidth={1.5} />
                ) : (
                  <Link2 className="w-3.5 h-3.5 text-[#D4B094] flex-shrink-0" strokeWidth={1.5} />
                )}
                <span className="truncate group-hover:underline underline-offset-2">
                  {mat.fileName ?? mat.title}
                </span>
              </motion.a>
            ))}
            {hiddenCount > 0 && (
              <button
                onClick={() => setMaterialsExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-[#A86E58] hover:text-[#760F13] transition-colors mt-0.5 w-fit"
              >
                <motion.span
                  animate={{ rotate: materialsExpanded ? 180 : 0 }}
                  transition={{ type: 'spring' as const, stiffness: 300, damping: 28 }}
                >
                  <ChevronDown className="w-3 h-3" strokeWidth={2} />
                </motion.span>
                {materialsExpanded ? 'Show less' : `+${hiddenCount} more`}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
