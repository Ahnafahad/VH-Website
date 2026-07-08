'use client';

import Link from 'next/link';
import { Play, FileText, BookOpen } from 'lucide-react';
import type { DashboardClassPulse } from '@/lib/lms/dashboard-data';

interface Props {
  classPulse: DashboardClassPulse;
}

function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(epochMs));
}

function RecordingChip({ status }: { status: string }) {
  if (status === 'available') {
    return (
      <span
        className="text-xs flex-shrink-0"
        style={{ color: '#D4B094', fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
      >
        recording
      </span>
    );
  }
  if (status === 'pending' || status === 'processing') {
    return (
      <span
        className="text-xs flex-shrink-0"
        style={{ color: 'rgba(250,245,239,0.40)', fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
      >
        processing
      </span>
    );
  }
  return null;
}

export default function ClassHistoryTile({ classPulse }: Props) {
  const { attendedCount, completedCount, recentClasses, resumeTarget } = classPulse;

  return (
    <div>
      {/* Section marker */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className="font-heading italic text-sm flex-shrink-0"
          style={{ color: '#D4B094' }}
        >
          recent classes
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
      </div>

      {/* Attendance meta */}
      {completedCount > 0 && (
        <p className="text-sm mb-4" style={{ color: 'rgba(250,245,239,0.64)' }}>
          attended{' '}
          <span style={{ fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums', color: '#FAF5EF' }}>
            {attendedCount}
          </span>{' '}
          of{' '}
          <span style={{ fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums', color: '#FAF5EF' }}>
            {completedCount}
          </span>{' '}
          classes
        </p>
      )}

      {/* Resume CTA */}
      {resumeTarget && (
        <Link
          href={`/dashboard/classes/${resumeTarget.sessionId}/recording`}
          className="flex flex-col gap-2 mb-5 pb-5"
          style={{ borderBottom: '1px solid rgba(212,176,148,0.16)' }}
        >
          <div className="flex items-center gap-2">
            <Play
              className="w-4 h-4 flex-shrink-0"
              style={{ color: '#D4B094' }}
              strokeWidth={1.5}
              fill="currentColor"
            />
            <span
              className="text-base font-medium"
              style={{ color: '#FAF5EF' }}
            >
              Resume: {resumeTarget.title}
            </span>
          </div>
          {/* Progress bar */}
          <div
            className="h-0.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(212,176,148,0.16)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: '#D4B094',
                width: `${resumeTarget.completedPercent}%`,
              }}
            />
          </div>
        </Link>
      )}

      {/* Class rows */}
      {recentClasses.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-4">
          <BookOpen
            className="w-6 h-6"
            style={{ color: 'rgba(250,245,239,0.40)' }}
            strokeWidth={1.25}
          />
          <p className="text-base" style={{ color: 'rgba(250,245,239,0.64)' }}>
            No completed classes yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col" id="classes">
          {recentClasses.map((cls, i) => (
            <div
              key={cls.id}
              style={{ borderBottom: '1px solid rgba(212,176,148,0.16)' }}
            >
              {/* Main row */}
              <Link
                href={`/dashboard/classes/${cls.id}`}
                className="flex items-center gap-3 py-3 min-h-[44px] transition-opacity hover:opacity-80"
              >
                <div className="flex-1 min-w-0">
                  <span
                    className="text-xs block lowercase"
                    style={{ color: 'rgba(250,245,239,0.40)' }}
                  >
                    {cls.subject}
                  </span>
                  <span
                    className="text-sm block truncate"
                    style={{ color: '#FAF5EF' }}
                  >
                    {cls.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {cls.watch && (
                    <span
                      className="text-xs"
                      style={{
                        fontFamily: 'var(--font-math-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'rgba(250,245,239,0.64)',
                      }}
                    >
                      {cls.watch.completedPercent}%
                    </span>
                  )}
                  {cls.recording && <RecordingChip status={cls.recording.status} />}
                  <span
                    className="text-xs"
                    style={{
                      fontFamily: 'var(--font-math-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      color: 'rgba(250,245,239,0.64)',
                    }}
                  >
                    {formatDate(cls.scheduledAt)}
                  </span>
                </div>
              </Link>

              {/* Materials — only for newest class (index 0) */}
              {i === 0 && cls.materials.length > 0 && (
                <div className="pb-3 pl-0 flex flex-col gap-1.5">
                  {cls.materials.map((mat) => (
                    <Link
                      key={mat.id}
                      href={`/dashboard/materials/${mat.id}`}
                      className="flex items-center gap-1.5 transition-opacity hover:opacity-80 min-h-[44px] py-1"
                    >
                      <FileText
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: 'rgba(250,245,239,0.40)' }}
                        strokeWidth={1.5}
                      />
                      <span
                        className="text-sm"
                        style={{ color: 'rgba(250,245,239,0.64)' }}
                      >
                        {mat.title}
                      </span>
                      <span
                        className="text-xs ml-1"
                        style={{ color: 'rgba(250,245,239,0.40)' }}
                      >
                        {mat.type}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
