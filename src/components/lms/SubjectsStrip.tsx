'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { BookOpen, Calculator, Waypoints } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { DashboardSubjectSummary } from '@/lib/lms/dashboard-data';
import { SUBJECT_LABELS } from '@/lib/lms/subject-data';

interface Props {
  subjects: DashboardSubjectSummary[];
}

const SUBJECT_META: Record<
  DashboardSubjectSummary['subject'],
  { icon: React.ComponentType<LucideProps>; accent: string }
> = {
  english:    { icon: BookOpen,    accent: '#8FAED1' },
  math:       { icon: Calculator, accent: '#8FCBB0' },
  analytical: { icon: Waypoints,  accent: '#D4956E' },
};

export default function SubjectsStrip({ subjects }: Props) {
  const prefersReduced = useReducedMotion();

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="font-heading italic text-sm flex-shrink-0" style={{ color: '#D4B094' }}>
          your subjects
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-3 rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(212,176,148,0.16)' }}
      >
        {subjects.map((s, i) => {
          const { icon: Icon, accent } = SUBJECT_META[s.subject];
          const label = SUBJECT_LABELS[s.subject];
          const stat = s.pendingHomeworkCount > 0
            ? `${s.pendingHomeworkCount} homework due`
            : s.lectureSheetCount > 0
              ? `${s.lectureSheetCount} lecture sheet${s.lectureSheetCount === 1 ? '' : 's'}`
              : 'Open →';

          return (
            <motion.div
              key={s.subject}
              whileTap={prefersReduced ? {} : { scale: 0.99 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
              style={{
                borderRight: i < subjects.length - 1 ? '1px solid rgba(212,176,148,0.16)' : undefined,
              }}
            >
              <Link
                href={`/dashboard/subjects/${s.subject}`}
                className="flex flex-col gap-2 p-5 h-full transition-colors group"
                style={{ minHeight: '44px' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(250,245,239,0.04)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
              >
                <Icon className="w-5 h-5 flex-shrink-0" style={{ color: accent }} strokeWidth={1.5} />
                <span
                  className="font-heading text-lg leading-tight"
                  style={{ color: '#FAF5EF', letterSpacing: '-0.01em' }}
                >
                  {label}
                </span>
                <span
                  className="text-sm"
                  style={{
                    fontFamily: 'var(--font-math-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'rgba(250,245,239,0.64)',
                  }}
                >
                  {stat}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
