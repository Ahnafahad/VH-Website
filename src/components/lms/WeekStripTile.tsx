'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import type { DashboardWeekClass } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';

interface Props {
  weekClasses: DashboardWeekClass[];
}

const DHAKA_TZ = 'Asia/Dhaka';
const DHAKA_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDhakaDay(epochMs: number): number {
  const d = new Date(epochMs);
  return parseInt(
    new Intl.DateTimeFormat('en-US', { weekday: 'narrow', timeZone: DHAKA_TZ })
      .formatToParts(d)
      .find((p) => p.type === 'weekday')?.value === 'S'
      ? new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: DHAKA_TZ }).format(d) === 'Sun'
        ? '0'
        : '6'
      : String(d.getDay()),
    10,
  );
}

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

// Get this week's 7 days starting from last Sunday (in Dhaka time)
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

const STATUS_DOT: Record<string, string> = {
  scheduled: 'bg-[#760F13]',
  live:      'bg-green-500',
  completed: 'bg-[#A86E58]',
};

const tileVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.005, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

export default function WeekStripTile({ weekClasses }: Props) {
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const weekDates = getDhakaWeekDates();
  const todayIdx = getTodayDhakaWeekDay();

  // Map day-of-week → classes that day
  const classesByDow = new Map<number, DashboardWeekClass[]>();
  for (const cls of weekClasses) {
    const dow = getDhakaWeekDay(cls.scheduledAt);
    if (!classesByDow.has(dow)) classesByDow.set(dow, []);
    classesByDow.get(dow)!.push(cls);
  }

  const activeDayClasses = activeDay !== null ? (classesByDow.get(activeDay) ?? []) : [];

  return (
    <motion.div
      variants={tileVariants}
      initial="rest"
      whileHover="hover"
      className="rounded-2xl border border-[#E8DDD5] bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06), 0 4px 16px rgba(90,11,15,0.03)' }}
    >
      <div className="p-5 flex flex-col gap-3">
        <p className="text-[10px] font-sans uppercase tracking-widest text-[#A86E58]">This week</p>

        {/* 7-day strip */}
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const isToday = i === todayIdx;
            const hasClasses = classesByDow.has(i);
            const dayClasses = classesByDow.get(i) ?? [];
            const isActive = activeDay === i;

            return (
              <motion.button
                key={i}
                onClick={() => setActiveDay(isActive ? null : i)}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
                className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[#760F13] text-white'
                    : isToday
                    ? 'bg-[#F5EDE3] text-[#760F13]'
                    : 'hover:bg-[#FAF5EF] text-[#5A0B0F]/60'
                }`}
              >
                <span className={`text-[10px] font-sans uppercase tracking-wide font-medium`}>
                  {DHAKA_DAY_LABELS[i]}
                </span>
                <span className={`text-sm font-semibold font-heading ${isActive ? 'text-white' : isToday ? 'text-[#760F13]' : ''}`}>
                  {new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: DHAKA_TZ }).format(date)}
                </span>
                {/* Class dots */}
                <div className="flex gap-0.5 h-2 items-center">
                  {dayClasses.slice(0, 3).map((cls, di) => (
                    <span
                      key={di}
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-white/70' : (STATUS_DOT[cls.status] ?? 'bg-[#D4B094]')
                      }`}
                    />
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Tooltip / expanded day info */}
        <AnimatePresence initial={false}>
          {activeDay !== null && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="border-t border-[#F0E8E0] pt-3 flex flex-col gap-1.5">
                {activeDayClasses.length === 0 ? (
                  <p className="text-xs text-[#A86E58]/60">No classes on {DHAKA_DAY_LABELS[activeDay]}.</p>
                ) : (
                  activeDayClasses.map((cls) => (
                    <div key={cls.id} className="flex items-center gap-2 text-xs text-[#5A0B0F]">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[cls.status] ?? 'bg-[#D4B094]'}`} />
                      <span className="font-medium line-clamp-1">{cls.title}</span>
                      <span className="text-[#A86E58] ml-auto flex-shrink-0">
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
    </motion.div>
  );
}
