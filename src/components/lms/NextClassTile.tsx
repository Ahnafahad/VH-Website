'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Video, Clock, ExternalLink, CalendarClock, Loader2 } from 'lucide-react';
import type { DashboardNextClass } from '@/lib/lms/dashboard-data';
import { formatDhaka } from '@/lib/lms/time';
import { JOIN_WINDOW_EARLY_MINUTES, JOIN_WINDOW_LATE_MINUTES } from '@/lib/lms/constants';
import { trackFeature } from '@/lib/analytics/tracker';

interface Props {
  nextClass: DashboardNextClass | null;
  serverJoinOpen: boolean;
}

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

const digitVariants = {
  initial: { y: -8, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
  },
};

const digitVariantsReduced = {
  initial: { y: 0, opacity: 1 },
  animate: { y: 0, opacity: 1 },
};

function CountdownUnit({
  value,
  label,
  prefersReduced,
}: {
  value: number;
  label: string;
  prefersReduced: boolean | null;
}) {
  const prev = useRef(value);
  const changed = prev.current !== value;
  useEffect(() => {
    prev.current = value;
  }, [value]);

  const variants = prefersReduced ? digitVariantsReduced : digitVariants;

  return (
    <div className="flex flex-col items-center min-w-[3rem]">
      <motion.span
        key={value}
        variants={variants}
        initial={changed && !prefersReduced ? 'initial' : 'animate'}
        animate="animate"
        className="text-4xl sm:text-5xl leading-none"
        style={{
          fontFamily: 'var(--font-math-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: '#FAF5EF',
        }}
      >
        {String(value).padStart(2, '0')}
      </motion.span>
      <span
        className="text-xs mt-1 lowercase"
        style={{ color: 'rgba(250,245,239,0.40)' }}
      >
        {label}
      </span>
    </div>
  );
}

export default function NextClassTile({ nextClass, serverJoinOpen }: Props) {
  const prefersReduced = useReducedMotion();
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
        trackFeature('class_join_failed', 'lms', { classSessionId: nextClass.id, code: code ?? 'UNKNOWN' });
        return;
      }

      const { meetLink } = (await res.json()) as { meetLink: string };
      trackFeature('class_joined', 'lms', { classSessionId: nextClass.id });
      window.open(meetLink, '_blank', 'noopener,noreferrer');
    } catch {
      setJoinError('Network error. Please try again.');
      trackFeature('class_join_failed', 'lms', { classSessionId: nextClass.id, code: 'NETWORK' });
    } finally {
      setJoining(false);
    }
  }, [nextClass, joining]);

  if (!nextClass || !countdown) {
    return (
      <div className="flex flex-col items-start gap-2 py-4">
        <CalendarClock
          className="w-6 h-6"
          style={{ color: 'rgba(250,245,239,0.40)' }}
          strokeWidth={1.25}
        />
        <p className="text-base" style={{ color: 'rgba(250,245,239,0.64)' }}>
          No upcoming class scheduled.
        </p>
      </div>
    );
  }

  const scheduledDate = new Date(nextClass.scheduledAt);

  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-5"
      style={{
        backgroundColor: 'rgba(250,245,239,0.04)',
        border: '1px solid rgba(212,176,148,0.16)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Subject label */}
          <span
            className="text-xs lowercase mb-1 block"
            style={{ color: '#D4B094' }}
          >
            {nextClass.subject}
          </span>
          <h2
            className="font-heading font-medium text-2xl leading-tight"
            style={{ color: '#FAF5EF', letterSpacing: '-0.01em' }}
          >
            {nextClass.title}
          </h2>
          {!joinOpen && (
            <p
              className="text-sm mt-1"
              style={{
                fontFamily: 'var(--font-math-mono)',
                fontVariantNumeric: 'tabular-nums',
                color: 'rgba(250,245,239,0.64)',
              }}
            >
              {formatDhaka(scheduledDate, 'datetime')}
            </p>
          )}
        </div>

        {/* Live indicator */}
        {joinOpen && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.span
              animate={prefersReduced ? {} : { opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#7DDFA3' }}
            />
            <span className="text-sm" style={{ color: '#7DDFA3' }}>
              Live now
            </span>
          </div>
        )}
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-2 sm:gap-3">
        <CountdownUnit value={countdown.d} label="days" prefersReduced={prefersReduced} />
        <span
          className="text-3xl -mt-4"
          style={{ color: 'rgba(212,176,148,0.40)' }}
        >
          :
        </span>
        <CountdownUnit value={countdown.h} label="hrs" prefersReduced={prefersReduced} />
        <span
          className="text-3xl -mt-4"
          style={{ color: 'rgba(212,176,148,0.40)' }}
        >
          :
        </span>
        <CountdownUnit value={countdown.m} label="min" prefersReduced={prefersReduced} />
        <span
          className="text-3xl -mt-4"
          style={{ color: 'rgba(212,176,148,0.40)' }}
        >
          :
        </span>
        <CountdownUnit value={countdown.s} label="sec" prefersReduced={prefersReduced} />
      </div>

      {/* Join button — the ONE gold filled CTA */}
      {joinOpen ? (
        <div>
          <motion.button
            onClick={handleJoin}
            disabled={joining}
            whileTap={prefersReduced || joining ? {} : { scale: 0.97 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
            className="flex items-center justify-center gap-2 w-full font-medium rounded-md transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              minHeight: '44px',
              backgroundColor: '#D4B094',
              color: '#1A0507',
              padding: '0 1.5rem',
            }}
            onMouseEnter={(e) => { if (!joining) (e.currentTarget as HTMLElement).style.backgroundColor = '#c9a07e'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#D4B094'; }}
          >
            {joining ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
            ) : (
              <Video className="w-4 h-4" strokeWidth={2} />
            )}
            {joining ? 'Joining…' : 'Join Class'}
            {!joining && <ExternalLink className="w-3.5 h-3.5 opacity-60" strokeWidth={2} />}
          </motion.button>
          {joinError && (
            <p
              className="mt-2 text-xs text-center leading-snug"
              style={{ color: '#FF8A8F' }}
            >
              {joinError}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2" style={{ color: 'rgba(250,245,239,0.40)' }}>
          <Clock className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          <span className="text-sm">
            Opens {JOIN_WINDOW_EARLY_MINUTES} min before class
          </span>
        </div>
      )}
    </div>
  );
}
