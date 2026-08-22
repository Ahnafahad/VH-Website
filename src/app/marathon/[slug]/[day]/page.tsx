'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MarathonAttemptPayload } from '@/lib/marathon/types';
import TakeDayScreen from '@/components/marathon/TakeDayScreen';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; payload: MarathonAttemptPayload }
  | { kind: 'locked' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

export default function MarathonDayPage({ params }: { params: Promise<{ slug: string; day: string }> }) {
  const { slug, day } = use(params);
  const dayNumber = Number(day);
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const startRes = await fetch(`/api/marathon/${slug}/${dayNumber}/start`, { method: 'POST' });
        if (!startRes.ok) {
          const body = await startRes.json().catch(() => ({}));
          if (body.code === 'ALREADY_SUBMITTED') { router.replace(`/marathon/${slug}/${dayNumber}/results`); return; }
          if (body.code === 'DAY_LOCKED') { if (!cancelled) setState({ kind: 'locked' }); return; }
          if (body.code === 'MARATHON_ACCESS_DENIED' || body.code === 'CHAPTER_NOT_FOUND') { if (!cancelled) setState({ kind: 'denied' }); return; }
          if (!cancelled) setState({ kind: 'error', message: body.error ?? 'Could not start this day.' });
          return;
        }
        const attemptRes = await fetch(`/api/marathon/${slug}/${dayNumber}/attempt`);
        if (!attemptRes.ok) {
          const body = await attemptRes.json().catch(() => ({}));
          if (!cancelled) setState({ kind: 'error', message: body.error ?? 'Could not load this day.' });
          return;
        }
        const payload: MarathonAttemptPayload = await attemptRes.json();
        if (!cancelled) setState({ kind: 'ready', payload });
      } catch {
        if (!cancelled) setState({ kind: 'error', message: 'Network error — check your connection.' });
      }
    })();
    return () => { cancelled = true; };
  }, [slug, dayNumber, router]);

  if (state.kind === 'loading') {
    return <Centered><p className="text-exam-ink-muted">Loading Day {dayNumber}…</p></Centered>;
  }
  if (state.kind === 'locked') {
    return <Centered>
      <p className="text-exam-ink text-lg font-semibold mb-2">Day {dayNumber} hasn&apos;t unlocked yet</p>
      <p className="text-exam-ink-muted text-sm mb-4">Check back once it opens on schedule.</p>
      <Link href="/marathon" className="text-exam-gold text-sm underline">Back to Marathon</Link>
    </Centered>;
  }
  if (state.kind === 'denied') {
    return <Centered><p className="text-exam-ink-muted">You don&apos;t have access to this marathon.</p></Centered>;
  }
  if (state.kind === 'error') {
    return <Centered><p className="text-red-400">{state.message}</p></Centered>;
  }
  return <TakeDayScreen slug={slug} day={dayNumber} initial={state.payload} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-exam-base text-exam-ink flex items-center justify-center px-4">
      <div className="text-center max-w-sm">{children}</div>
    </div>
  );
}
