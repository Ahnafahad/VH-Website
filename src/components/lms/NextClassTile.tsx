'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, Variants } from 'motion/react';
import { Video, Clock, ExternalLink, CalendarClock, Loader2 } from 'lucide-react';
import type { DashboardNextClass } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';
import { JOIN_WINDOW_EARLY_MINUTES, JOIN_WINDOW_LATE_MINUTES } from '@/lib/lms/constants';

interface Props {
  nextClass: DashboardNextClass | null;
  serverJoinOpen: boolean;
}

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  english:    { bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200' },
  math:       { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  analytical: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
};

function getCountdown(ms: number): { d: number; h: number; m: number; s: number } {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { d, h, m, s };
}

function isJoinOpenClient(scheduledAt: number, durationMinutes: number): boolean {
  const now = Date.now();
  const windowStart = scheduledAt - JOIN_WINDOW_EARLY_MINUTES * 60_000;
  const windowEnd = scheduledAt + (durationMinutes + JOIN_WINDOW_LATE_MINUTES) * 60_000;
  return now >= windowStart && now <= windowEnd;
}

const tileVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.005, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

const digitVariants: Variants = {
  initial: { y: -8, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 400, damping: 30 } },
};

function CountdownUnit({ value, label }: { value: number; label: string }) {
  const prev = useRef(value);
  const changed = prev.current !== value;
  useEffect(() => { prev.current = value; }, [value]);

  return (
    <div className="flex flex-col items-center min-w-[3.5rem]">
      <motion.span
        key={value}
        variants={digitVariants}
        initial={changed ? 'initial' : 'animate'}
        animate="animate"
        className="text-3xl sm:text-4xl font-heading font-semibold tabular-nums text-[#5A0B0F] leading-none"
      >
        {String(value).padStart(2, '0')}
      </motion.span>
      <span className="text-[10px] font-sans uppercase tracking-widest text-[#A86E58] mt-1">{label}</span>
    </div>
  );
}

export default function NextClassTile({ nextClass, serverJoinOpen }: Props) {
  const [joinOpen, setJoinOpen] = useState(serverJoinOpen);
  const [countdown, setCountdown] = useState(
    nextClass ? getCountdown(nextClass.scheduledAt - Date.now()) : null,
  );
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!nextClass) return;
    const tick = () => {
      const msLeft = nextClass.scheduledAt - Date.now();
      setCountdown(getCountdown(msLeft));
      setJoinOpen(isJoinOpenClient(nextClass.scheduledAt, nextClass.durationMinutes));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextClass]);

  const handleJoin = useCallback(async () => {
    if (!nextClass || joining) return;
    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch(`/api/lms/classes/${nextClass.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = (data as { code?: string }).code;
        if (code === 'JOIN_CLOSED') {
          setJoinError('Join window has closed. Please wait closer to class time.');
        } else if (code === 'NO_LINK') {
          setJoinError('No Meet link available yet. Check back soon.');
        } else {
          setJoinError((data as { error?: string }).error ?? 'Could not join. Please try again.');
        }
        return;
      }

      const { meetLink } = (await res.json()) as { meetLink: string };
      window.open(meetLink, '_blank', 'noopener,noreferrer');
    } catch {
      setJoinError('Network error. Please try again.');
    } finally {
      setJoining(false);
    }
  }, [nextClass, joining]);

  const subjectStyle = nextClass
    ? (SUBJECT_COLORS[nextClass.subject] ?? { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' })
    : null;

  if (!nextClass || !countdown) {
    return (
      <motion.div
        variants={tileVariants}
        initial="rest"
        whileHover="hover"
        className="relative rounded-2xl border border-[#E8DDD5] bg-[#FAF5EF] p-5 flex flex-col items-center justify-center gap-2 min-h-[120px]"
      >
        <CalendarClock className="w-7 h-7 text-[#D4B094]" strokeWidth={1.25} />
        <p className="font-heading text-base text-[#5A0B0F]/60 font-light">No upcoming class</p>
        <p className="text-xs text-[#7A4A35]">Check back soon — your schedule will appear here.</p>
      </motion.div>
    );
  }

  const scheduledDate = new Date(nextClass.scheduledAt);

  return (
    <motion.div
      variants={tileVariants}
      initial="rest"
      whileHover="hover"
      className="relative rounded-2xl border border-[#E8DDD5] bg-white overflow-hidden flex flex-col"
      style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06), 0 8px 24px rgba(90,11,15,0.04)' }}
    >
      {/* Top accent stripe */}
      <div className="h-1 bg-gradient-to-r from-[#760F13] to-[#9A1B20]" />

      {/* Live indicator when join is open */}
      {joinOpen && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] font-sans font-semibold uppercase tracking-widest text-green-600">Live</span>
        </div>
      )}

      <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F5EDE3] flex items-center justify-center flex-shrink-0">
            <Video className="w-4.5 h-4.5 text-[#760F13]" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-sans uppercase tracking-widest text-[#A86E58] mb-0.5">Next class</p>
            <h2 className="font-heading text-lg sm:text-xl font-semibold text-[#1A0507] leading-tight line-clamp-2">
              {nextClass.title}
            </h2>
          </div>
        </div>

        {/* Subject + time */}
        <div className="flex flex-wrap items-center gap-2">
          {subjectStyle && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${subjectStyle.bg} ${subjectStyle.text} ${subjectStyle.border}`}>
              {nextClass.subject.charAt(0).toUpperCase() + nextClass.subject.slice(1)}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-[#A86E58]">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            {formatDhaka(scheduledDate, 'datetime')}
          </span>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-3 sm:gap-4 py-3 border-y border-[#F0E8E0]">
          <CountdownUnit value={countdown.d} label="days" />
          <span className="text-2xl text-[#D4B094] font-light -mt-3">:</span>
          <CountdownUnit value={countdown.h} label="hrs" />
          <span className="text-2xl text-[#D4B094] font-light -mt-3">:</span>
          <CountdownUnit value={countdown.m} label="min" />
          <span className="text-2xl text-[#D4B094] font-light -mt-3">:</span>
          <CountdownUnit value={countdown.s} label="sec" />
        </div>

        {/* Join button */}
        <div className="mt-auto">
          {joinOpen ? (
            <motion.button
              onClick={handleJoin}
              disabled={joining}
              whileTap={joining ? {} : { scale: 0.97 }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#760F13] text-white text-sm font-semibold hover:bg-[#5A0B0F] transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {joining ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              ) : (
                <Video className="w-4 h-4" strokeWidth={2} />
              )}
              {joining ? 'Joining…' : 'Join Class'}
              {!joining && <ExternalLink className="w-3.5 h-3.5 opacity-60" strokeWidth={2} />}
            </motion.button>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#F5EDE3] text-[#A86E58] text-sm font-medium cursor-not-allowed select-none">
              <Clock className="w-4 h-4" strokeWidth={1.5} />
              {`Opens ${JOIN_WINDOW_EARLY_MINUTES} min before`}
            </div>
          )}

          {/* Inline error message */}
          {joinError && (
            <p className="mt-2 text-xs text-red-600 text-center leading-snug">{joinError}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
