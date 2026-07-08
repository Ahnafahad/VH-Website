'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type { DashboardWeekClass } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  weekClasses: DashboardWeekClass[];
}

const DHAKA_TZ = 'Asia/Dhaka';
const DHAKA_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDhakaWeekDay(epochMs: number): number {
  const d = new Date(epochMs);
  const str = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: DHAKA_TZ }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(str);
}

function getTodayDhakaWeekDay(): number {
  const now = new Date();
  const str = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: DHAKA_TZ }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(str);
}

function getDhakaWeekDates(): Date[] {
  const now = new Date();
  const todayDow = getTodayDhakaWeekDay();
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const offset = i - todayDow;
    const d = new Date(now.getTime() + offset * 86400_000);
    days.push(d);
  }
  return days;
}

interface DotProps {
  status: string;
  isActive: boolean;
}

function StatusDot({ status, isActive }: DotProps) {
  if (isActive) {
    return (
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: 'rgba(250,245,239,0.60)' }}
      />
    );
  }
  if (status === 'live') {
    return (
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: '#7DDFA3' }}
      />
    );
  }
  if (status === 'completed') {
    return (
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: 'rgba(212,176,148,0.50)' }}
      />
    );
  }
  // scheduled — gold outline
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ border: '1px solid #D4B094', backgroundColor: 'transparent' }}
    />
  );
}

export default function WeekStripTile({ weekClasses }: Props) {
  const prefersReduced = useReducedMotion();
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const weekDates = getDhakaWeekDates();
  const todayIdx = getTodayDhakaWeekDay();

  const classesByDow = new Map<number, DashboardWeekClass[]>();
  for (const cls of weekClasses) {
    const dow = getDhakaWeekDay(cls.scheduledAt);
    if (!classesByDow.has(dow)) classesByDow.set(dow, []);
    classesByDow.get(dow)!.push(cls);
  }

  const activeDayClasses = activeDay !== null ? (classesByDow.get(activeDay) ?? []) : [];

  return (
    <div>
      {/* Section marker */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="font-heading italic text-sm flex-shrink-0"
          style={{ color: '#D4B094' }}
        >
          this week
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,176,148,0.16)' }} />
      </div>

      {/* 7-day strip */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDates.map((date, i) => {
          const hasClasses = classesByDow.has(i);
          const dayClasses = classesByDow.get(i) ?? [];
          const isActive = activeDay === i;
          const isToday = i === todayIdx;

          return (
            <div key={i} className="relative flex flex-col items-center">
              <motion.button
                onClick={() => setActiveDay(isActive ? null : i)}
                whileTap={prefersReduced ? {} : { scale: 0.9 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
                className="flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg w-full transition-colors"
                style={{
                  minHeight: '44px',
                  color: isActive ? '#D4B094' : isToday ? '#FAF5EF' : 'rgba(250,245,239,0.40)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(250,245,239,0.04)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <span className="text-[10px] uppercase tracking-wide font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
                  {DHAKA_DAY_LABELS[i]}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{
                    fontFamily: 'var(--font-math-mono)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: DHAKA_TZ }).format(date)}
                </span>
                <div className="flex gap-0.5 h-2 items-center">
                  {dayClasses.slice(0, 3).map((cls, di) => (
                    <StatusDot key={di} status={cls.status} isActive={isActive} />
                  ))}
                </div>
              </motion.button>

              {/* Gold underline indicator for active day */}
              {isActive && (
                <motion.div
                  layoutId={prefersReduced ? undefined : 'week-day-underline'}
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                  style={{ backgroundColor: '#D4B094' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded day info */}
      <AnimatePresence initial={false}>
        {activeDay !== null && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              prefersReduced
                ? { duration: 0 }
                : { type: 'spring' as const, stiffness: 300, damping: 30 }
            }
            className="overflow-hidden"
          >
            <div
              className="pt-3 flex flex-col gap-1.5"
              style={{ borderTop: '1px solid rgba(212,176,148,0.16)' }}
            >
              {activeDayClasses.length === 0 ? (
                <p className="text-sm" style={{ color: 'rgba(250,245,239,0.40)' }}>
                  No classes on {DHAKA_DAY_LABELS[activeDay]}.
                </p>
              ) : (
                activeDayClasses.map((cls) => (
                  <div key={cls.id} className="flex items-center gap-2 text-sm">
                    <StatusDot status={cls.status} isActive={false} />
                    <span className="flex-1 truncate" style={{ color: '#FAF5EF' }}>
                      {cls.title}
                    </span>
                    <span
                      className="ml-auto flex-shrink-0 text-xs"
                      style={{
                        fontFamily: 'var(--font-math-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'rgba(250,245,239,0.64)',
                      }}
                    >
                      {formatDhaka(new Date(cls.scheduledAt), 'time')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
