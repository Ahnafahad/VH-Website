'use client';

import Link from 'next/link';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { DashboardAssignment } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  assignments: DashboardAssignment[];
}

function getDueUrgency(dueAt: number): 'overdue' | 'urgent' | 'normal' {
  const msLeft = dueAt - Date.now();
  if (msLeft < 0) return 'overdue';
  if (msLeft < 48 * 3600_000) return 'urgent';
  return 'normal';
}

function UrgencyLabel({ dueAt }: { dueAt: number }) {
  const urgency = getDueUrgency(dueAt);

  if (urgency === 'overdue') {
    return (
      <span className="flex items-center gap-1 text-xs" style={{ color: '#FF8A8F' }}>
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
        overdue
      </span>
    );
  }
  if (urgency === 'urgent') {
    return (
      <span
        className="text-xs"
        style={{ color: '#D4B094', fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
      >
        due {formatDhaka(new Date(dueAt), 'datetime')} · due soon
      </span>
    );
  }
  return (
    <span
      className="text-xs"
      style={{
        color: 'rgba(250,245,239,0.64)',
        fontFamily: 'var(--font-math-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      due {formatDhaka(new Date(dueAt), 'datetime')}
    </span>
  );
}

function StatusLabel({ status }: { status: string }) {
  if (status === 'submitted') {
    return <span className="text-xs lowercase" style={{ color: '#D4B094' }}>submitted</span>;
  }
  if (status === 'reviewed') {
    return <span className="text-xs lowercase" style={{ color: '#7DDFA3' }}>reviewed</span>;
  }
  return <span className="text-xs lowercase" style={{ color: 'rgba(250,245,239,0.40)' }}>pending</span>;
}

export default function HomeworkTile({ assignments }: Props) {
  return (
    <div id="homework">
      {/* Section marker */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className="font-heading italic text-sm flex-shrink-0"
          style={{ color: '#D4B094' }}
        >
          homework
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
      </div>

      {assignments.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-4">
          <CheckCircle2
            className="w-6 h-6"
            style={{ color: 'rgba(250,245,239,0.40)' }}
            strokeWidth={1.25}
          />
          <p className="text-base" style={{ color: 'rgba(250,245,239,0.64)' }}>
            All clear — nothing due.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {assignments.map((a) => {
            const subStatus =
              a.mySubmission === 'pending' ? 'pending' : a.mySubmission.status;

            return (
              <Link
                key={a.id}
                href={`/dashboard/assignments/${a.id}`}
                className="flex items-center gap-3 py-3 min-h-[44px] transition-opacity hover:opacity-80"
                style={{ borderBottom: '1px solid rgba(212,176,148,0.16)' }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm truncate mb-1"
                    style={{ color: '#FAF5EF' }}
                  >
                    {a.title}
                  </p>
                  <UrgencyLabel dueAt={a.dueAt} />
                </div>
                <StatusLabel status={subStatus} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
