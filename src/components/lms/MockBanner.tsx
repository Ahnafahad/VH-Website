'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { formatSlotTime, nextMock, slotDay, type MockSlot } from '@/lib/mocks/registration-pure';

/** First thing on the dashboard for Mock Access holders: the next mock in the routine and a way in. */
export default function MockBanner() {
  const [next, setNext] = useState<MockSlot | null | undefined>(undefined);
  useEffect(() => setNext(nextMock(new Date())), []);
  const d = next ? slotDay(next.date) : null;

  return (
    <Link
      href="/mocks"
      className="group mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg px-5 py-5 transition-colors sm:px-7"
      style={{ border: '1px solid rgba(212,176,148,0.32)', backgroundColor: 'rgba(250,245,239,0.04)' }}
    >
      <span>
        <span className="block text-[10px] font-medium uppercase" style={{ letterSpacing: '0.28em', color: '#D4B094' }}>Mock Access</span>
        <span className="mt-1 block font-heading text-2xl leading-tight" style={{ color: '#FAF5EF' }}>
          {next && d
            ? <>Mock {String(next.n).padStart(2, '0')} · {d.weekday} {d.day} {d.month}, {formatSlotTime(next.time)}</>
            : next === null ? 'Your mocks and results' : 'Your mocks'}
        </span>
      </span>
      <span className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: '#FAF5EF' }}>
        Open Mocks
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
      </span>
    </Link>
  );
}
