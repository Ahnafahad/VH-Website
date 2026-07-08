'use client';

import { motion, Variants } from 'motion/react';
import { ClipboardList, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { DashboardAssignment } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  assignments: DashboardAssignment[];
}

const tileVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.005, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

function getDueUrgency(dueAt: number): 'overdue' | 'urgent' | 'normal' {
  const msLeft = dueAt - Date.now();
  if (msLeft < 0) return 'overdue';
  if (msLeft < 48 * 3600_000) return 'urgent';
  return 'normal';
}

const URGENCY_STYLES = {
  overdue: { bg: 'bg-red-50',    text: 'text-red-600',   border: 'border-red-200',   icon: AlertCircle },
  urgent:  { bg: 'bg-amber-50',  text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  normal:  { bg: 'bg-stone-50',  text: 'text-stone-500', border: 'border-stone-200', icon: Clock },
};

const STATUS_STYLES = {
  pending:   { label: 'Pending',   color: 'text-[#A86E58]' },
  submitted: { label: 'Submitted', color: 'text-emerald-600' },
  reviewed:  { label: 'Reviewed',  color: 'text-blue-600' },
};

export default function HomeworkTile({ assignments }: Props) {
  if (assignments.length === 0) {
    return (
      <motion.div
        variants={tileVariants}
        initial="rest"
        whileHover="hover"
        className="rounded-2xl border border-[#E8DDD5] bg-[#FAF5EF] p-4 flex flex-col items-center justify-center gap-2 min-h-[80px]"
      >
        <CheckCircle2 className="w-6 h-6 text-emerald-500" strokeWidth={1.25} />
        <p className="text-xs text-[#7A4A35]">All clear — no pending homework.</p>
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
          <ClipboardList className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />
          <p className="text-[10px] font-sans uppercase tracking-widest text-[#A86E58]">Homework</p>
          <span className="ml-auto text-xs font-medium text-[#760F13] bg-[#F5EDE3] px-2 py-0.5 rounded-full">
            {assignments.length}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {assignments.map((a, i) => {
            const urgency = getDueUrgency(a.dueAt);
            const { bg, text, border, icon: Icon } = URGENCY_STYLES[urgency];
            const subStatus = a.mySubmission === 'pending' ? 'pending' : a.mySubmission.status;
            const statusStyle = STATUS_STYLES[subStatus as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.pending;

            return (
              <Link key={a.id} href={`/dashboard/assignments/${a.id}`}>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: 'spring' as const, stiffness: 300, damping: 26 }}
                className="flex items-start gap-3 p-3 rounded-xl border border-[#F0E8E0] hover:border-[#D4B094]/40 transition-colors cursor-pointer"
              >
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A0507] line-clamp-1 leading-snug">{a.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${bg} ${text} ${border}`}>
                      <Icon className="w-2.5 h-2.5" strokeWidth={2} />
                      Due {formatDhaka(new Date(a.dueAt), 'datetime')}
                    </span>
                    <span className={`text-[10px] font-medium ${statusStyle.color}`}>
                      {statusStyle.label}
                    </span>
                  </div>
                </div>
                {subStatus === 'submitted' || subStatus === 'reviewed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                ) : null}
              </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
