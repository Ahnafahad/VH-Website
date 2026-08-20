'use client';

/**
 * Student "all classes" calendar — /dashboard/classes.
 * A month-grid view of every class the student has scope on. Click a day to
 * see its classes below; click a class to open the existing per-class detail
 * page (/dashboard/classes/[id]), which already handles recording + gated
 * materials. Deliberately not the admin LMS UI — read-only, single column,
 * brand tokens shared with ClassDetailStudentClient / WeekStripTile.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion, Variants } from 'motion/react';
import { ArrowLeft, ChevronLeft, ChevronRight, Play, FileText, CalendarDays } from 'lucide-react';
import type { CalendarClass } from '@/lib/lms/all-classes';
import type { UserProduct } from '@/lib/db/schema';

// ─── Design tokens (shared with ClassDetailStudentClient) ─────────────────────

const INK      = '#FAF5EF';
const INK_64   = 'rgba(250,245,239,0.64)';
const INK_40   = 'rgba(250,245,239,0.40)';
const INK_24   = 'rgba(250,245,239,0.24)';
const TAN      = '#D4B094';
const TAN_16   = 'rgba(212,176,148,0.16)';
const HAIRLINE = 'rgba(212,176,148,0.16)';
const SURFACE  = 'rgba(250,245,239,0.04)';
const GREEN    = '#7DDFA3';

const DHAKA_TZ = 'Asia/Dhaka';
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: DHAKA_TZ });
const DAY_HEADER_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: DHAKA_TZ,
});
const TIME_FMT = new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone: DHAKA_TZ });

const PRODUCT_LABELS: Record<UserProduct, string> = {
  iba: 'IBA',
  fbs: 'FBS',
  fbs_detailed: 'FBS Detailed',
};

/** Dhaka-local calendar-day key (YYYY-MM-DD), timezone-safe regardless of the viewer's own clock. */
function dhakaDateKey(epochMs: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DHAKA_TZ }).format(new Date(epochMs));
}

function todayDhakaYMD(): { year: number; month: number; day: number } {
  const [year, month, day] = dhakaDateKey(Date.now()).split('-').map(Number);
  return { year, month, day };
}

/** Days in `month` (1-12) of `year`. Pure calendar math — no timezone involved. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday of the 1st of `month` (1-12). Pure calendar math. */
function firstWeekday(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

function ymdKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** A representative instant (Dhaka noon) for formatting a Y-M-D with Intl — safe since Dhaka has no DST. */
function keyToDisplayDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 6));
}

interface DotProps {
  status: string;
}

function StatusDot({ status }: DotProps) {
  if (status === 'live') {
    return <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: GREEN }} />;
  }
  if (status === 'completed') {
    return <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(212,176,148,0.50)' }} />;
  }
  return <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ border: `1px solid ${TAN}`, backgroundColor: 'transparent' }} />;
}

function RecordingChip({ status }: { status: string }) {
  if (status === 'available') {
    return (
      <span className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: TAN }}>
        <Play className="w-3 h-3" strokeWidth={1.5} fill="currentColor" />
        recording
      </span>
    );
  }
  if (status === 'pending' || status === 'processing') {
    return <span className="text-xs flex-shrink-0" style={{ color: INK_40 }}>processing</span>;
  }
  return null;
}

const gridVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -24 : 24 }),
};

interface Props {
  classes: CalendarClass[];
  products: UserProduct[];
  activeProduct: UserProduct;
}

export default function ClassesCalendarClient({ classes, products, activeProduct }: Props) {
  const prefersReduced = useReducedMotion();
  const today = todayDhakaYMD();

  const [viewYear, setViewYear] = useState(today.year);
  const [viewMonth, setViewMonth] = useState(today.month); // 1-12
  const [direction, setDirection] = useState(0);
  const [selectedKey, setSelectedKey] = useState(ymdKey(today.year, today.month, today.day));

  const classesByDay = useMemo(() => {
    const map = new Map<string, CalendarClass[]>();
    for (const cls of classes) {
      const key = dhakaDateKey(cls.scheduledAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cls);
    }
    return map;
  }, [classes]);

  function changeMonth(delta: number) {
    setDirection(delta);
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewYear(y);
    setViewMonth(m);
  }

  function goToday() {
    setDirection(0);
    setViewYear(today.year);
    setViewMonth(today.month);
    setSelectedKey(ymdKey(today.year, today.month, today.day));
  }

  const leadDays = firstWeekday(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const trailDays = (7 - ((leadDays + totalDays) % 7)) % 7;

  const cells: Array<{ key: string; day: number } | null> = [
    ...Array.from({ length: leadDays }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => ({ key: ymdKey(viewYear, viewMonth, i + 1), day: i + 1 })),
    ...Array.from({ length: trailDays }, () => null),
  ];

  const selectedClasses = (classesByDay.get(selectedKey) ?? []).slice().sort((a, b) => a.scheduledAt - b.scheduledAt);
  const monthLabel = MONTH_FMT.format(new Date(Date.UTC(viewYear, viewMonth - 1, 15)));
  const isCurrentMonth = viewYear === today.year && viewMonth === today.month;

  return (
    <div className="min-h-screen pb-16 pt-24 sm:pt-28" style={{ backgroundColor: '#1A0507' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-24 sm:top-28 z-10 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(26,5,7,0.92)', borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-8 h-8 rounded-full transition-opacity hover:opacity-70 flex-shrink-0"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: TAN }} strokeWidth={2} />
          </Link>
          <h1 className="font-heading italic text-sm flex-1" style={{ color: TAN }}>
            my classes
          </h1>
          {products.length > 1 && (
            <div className="flex items-center gap-1.5">
              {products.map((p) => {
                const active = p === activeProduct;
                return (
                  <Link
                    key={p}
                    href={`/dashboard/classes?product=${p}`}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                    style={{
                      border: `1px solid ${active ? TAN : TAN_16}`,
                      color: active ? TAN : INK_64,
                      backgroundColor: active ? 'rgba(212,176,148,0.08)' : 'transparent',
                    }}
                  >
                    {PRODUCT_LABELS[p]}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* ── Month navigator ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-70"
            style={{ color: TAN }}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="font-heading font-medium text-xl" style={{ color: INK }}>
              {monthLabel}
            </h2>
            {!isCurrentMonth && (
              <button
                onClick={goToday}
                className="text-xs mt-0.5 transition-opacity hover:opacity-70"
                style={{ color: TAN }}
              >
                Jump to today
              </button>
            )}
          </div>
          <button
            onClick={() => changeMonth(1)}
            aria-label="Next month"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-70"
            style={{ color: TAN }}
          >
            <ChevronRight className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* ── Weekday header ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] uppercase tracking-wide font-medium py-1" style={{ color: INK_40 }}>
              {d}
            </div>
          ))}
        </div>

        {/* ── Month grid ─────────────────────────────────────────────────────── */}
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={`${viewYear}-${viewMonth}`}
            custom={direction}
            variants={prefersReduced ? undefined : gridVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring' as const, stiffness: 320, damping: 32 }}
            className="grid grid-cols-7 gap-1 mb-6"
          >
            {cells.map((cell, i) => {
              if (!cell) return <div key={`blank-${i}`} />;
              const dayClasses = classesByDay.get(cell.key) ?? [];
              const isToday = cell.key === ymdKey(today.year, today.month, today.day);
              const isSelected = cell.key === selectedKey;

              return (
                <motion.button
                  key={cell.key}
                  onClick={() => setSelectedKey(cell.key)}
                  whileTap={prefersReduced ? {} : { scale: 0.92 }}
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
                  className="relative flex flex-col items-center gap-1 py-2 rounded-lg transition-colors"
                  style={{
                    minHeight: '48px',
                    backgroundColor: isSelected ? 'rgba(212,176,148,0.10)' : 'transparent',
                    border: isSelected ? `1px solid ${TAN}` : isToday ? `1px solid ${TAN_16}` : '1px solid transparent',
                  }}
                >
                  <span
                    className="text-sm"
                    style={{
                      fontFamily: 'var(--font-math-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      color: isSelected ? TAN : isToday ? INK : dayClasses.length > 0 ? INK_64 : INK_24,
                    }}
                  >
                    {cell.day}
                  </span>
                  <div className="flex gap-0.5 h-1.5 items-center">
                    {dayClasses.slice(0, 3).map((c, di) => (
                      <StatusDot key={di} status={c.status} />
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* ── Legend ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ border: `1px solid ${TAN}` }} />
            <span className="text-xs" style={{ color: INK_40 }}>scheduled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GREEN }} />
            <span className="text-xs" style={{ color: INK_40 }}>live</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(212,176,148,0.50)' }} />
            <span className="text-xs" style={{ color: INK_40 }}>completed</span>
          </div>
        </div>

        {/* ── Selected day panel ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="font-heading italic text-sm flex-shrink-0" style={{ color: TAN }}>
              {DAY_HEADER_FMT.format(keyToDisplayDate(selectedKey))}
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: HAIRLINE }} />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selectedKey}
              initial={prefersReduced ? {} : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? {} : { opacity: 0, y: -6 }}
              transition={{ type: 'spring' as const, stiffness: 320, damping: 30 }}
            >
              {selectedClasses.length === 0 ? (
                <div className="flex flex-col items-start gap-2 py-4">
                  <CalendarDays className="w-6 h-6" style={{ color: INK_40 }} strokeWidth={1.25} />
                  <p className="text-base" style={{ color: INK_64 }}>No classes on this day.</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {selectedClasses.map((cls) => (
                    <Link
                      key={cls.id}
                      href={`/dashboard/classes/${cls.id}`}
                      className="flex items-center gap-3 py-3 min-h-[44px] transition-opacity hover:opacity-80"
                      style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                    >
                      <StatusDot status={cls.status} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs block lowercase" style={{ color: INK_40 }}>
                          {cls.subject}{cls.classNumber != null ? ` · class ${cls.classNumber}` : ''}
                        </span>
                        <span className="text-sm block truncate" style={{ color: INK }}>
                          {cls.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {cls.hasMaterials && (
                          <FileText className="w-3.5 h-3.5" style={{ color: INK_40 }} strokeWidth={1.5} />
                        )}
                        {cls.recording && <RecordingChip status={cls.recording.status} />}
                        <span
                          className="text-xs"
                          style={{ fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums', color: INK_64 }}
                        >
                          {TIME_FMT.format(new Date(cls.scheduledAt))}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Empty state — no classes at all yet ───────────────────────────── */}
        {classes.length === 0 && (
          <p className="text-sm mt-8 text-center" style={{ color: INK_40 }}>
            Classes will appear here as they’re scheduled.
          </p>
        )}
      </div>
    </div>
  );
}
