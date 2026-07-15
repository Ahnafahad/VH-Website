'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Flame } from 'lucide-react';
import type { DashboardMomentum } from '@/lib/lms/dashboard-data';

interface Props {
  userName: string;
  momentum: DashboardMomentum;
  hasAccess: boolean;
}

function getDhakaGreeting(): { greeting: string; date: string } {
  const now = new Date();
  // Dhaka is a fixed UTC+6 (no DST) — add the offset directly from the UTC
  // epoch rather than via `now.getTimezoneOffset()`, which reads the *local
  // machine's* timezone and previously double-counted the offset on a Dhaka
  // browser (server runs in UTC, offset 0; client offset -360), landing in a
  // different greeting bucket than the server and causing a hydration
  // text mismatch.
  const dhakaMs = now.getTime() + 6 * 60 * 60_000;
  const dhaka = new Date(dhakaMs);
  const hour = dhaka.getUTCHours();

  let greeting: string;
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else greeting = 'Good evening';

  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Dhaka',
  }).format(now);

  return { greeting, date };
}

interface DigestItem {
  id: string;
  label: string;
  anchor: string;
}

function buildDigestItems(momentum: DashboardMomentum, hasAccess: boolean): DigestItem[] {
  const items: DigestItem[] = [];
  if (hasAccess && momentum.homeworkDue > 0) {
    items.push({
      id: 'hw',
      label: `${momentum.homeworkDue} homework due`,
      anchor: '#homework',
    });
  }
  if (hasAccess && momentum.testsOpenNow > 0) {
    items.push({
      id: 'tests',
      label: `${momentum.testsOpenNow} test${momentum.testsOpenNow > 1 ? 's' : ''} open now`,
      anchor: '#tests',
    });
  }
  if (hasAccess && momentum.unwatchedRecordings > 0) {
    items.push({
      id: 'rec',
      label: `${momentum.unwatchedRecordings} recording${momentum.unwatchedRecordings > 1 ? 's' : ''} unwatched`,
      anchor: '#classes',
    });
  }
  return items;
}

export default function MomentumMasthead({ userName, momentum, hasAccess }: Props) {
  const prefersReduced = useReducedMotion();
  const [timeData, setTimeData] = useState<{ greeting: string; date: string }>({
    greeting: 'Good morning',
    date: '',
  });

  useEffect(() => {
    setTimeData(getDhakaGreeting());
  }, []);

  const firstName = userName.split(' ')[0] ?? userName;
  const digestItems = buildDigestItems(momentum, hasAccess);
  const hasStreak = momentum.streakDays > 0;

  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, anchor: string) => {
      e.preventDefault();
      const el = document.querySelector(anchor);
      if (el) {
        el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
      }
    },
    [prefersReduced],
  );

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 280, damping: 28 }}
      className="mb-10"
    >
      {/* Date line */}
      {timeData.date && (
        <p
          className="text-sm mb-1"
          style={{ color: 'rgba(250,245,239,0.64)', fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
        >
          {timeData.date}
        </p>
      )}

      {/* Greeting */}
      <h1
        className="font-heading font-medium text-4xl sm:text-5xl text-[#FAF5EF] leading-tight mb-4"
        style={{ textWrap: 'balance', letterSpacing: '-0.02em' }}
      >
        {timeData.greeting}, {firstName}.
      </h1>

      {/* Attention digest */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {digestItems.length === 0 && !hasAccess ? (
          <p className="text-base" style={{ color: 'rgba(250,245,239,0.64)' }}>
            All caught up.
          </p>
        ) : null}

        {digestItems.map((item) => (
          <span key={item.id} className="flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#D4B094' }}
            />
            <a
              href={item.anchor}
              onClick={(e) => handleAnchorClick(e, item.anchor)}
              className="text-base transition-colors"
              style={{ color: 'rgba(250,245,239,0.64)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#FAF5EF')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(250,245,239,0.64)')}
            >
              <span
                style={{
                  fontFamily: 'var(--font-math-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  color: '#FAF5EF',
                }}
              >
                {item.label.match(/^\d+/)?.[0]}
              </span>
              {' '}
              {item.label.replace(/^\d+ ?/, '')}
            </a>
          </span>
        ))}

        {hasStreak && (
          <span className="flex items-center gap-1.5">
            <Flame
              className="w-4 h-4 flex-shrink-0"
              style={{ color: '#D4B094' }}
              strokeWidth={1.5}
            />
            <span className="text-base" style={{ color: 'rgba(250,245,239,0.64)' }}>
              <span
                style={{
                  fontFamily: 'var(--font-math-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  color: '#FAF5EF',
                }}
              >
                {momentum.streakDays}
              </span>
              -day streak
            </span>
          </span>
        )}

        {digestItems.length === 0 && !hasStreak && hasAccess && (
          <p className="text-base" style={{ color: 'rgba(250,245,239,0.64)' }}>
            All caught up.
          </p>
        )}
      </div>
    </motion.div>
  );
}
