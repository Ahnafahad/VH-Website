'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import type { MarathonResultsPayload } from '@/lib/marathon/types';
import MarathonResultsScreen from '@/components/marathon/MarathonResultsScreen';

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; results: MarathonResultsPayload }
  | { kind: 'not_submitted' }
  | { kind: 'error'; message: string };

export default function MarathonResultsPage({ params }: { params: Promise<{ slug: string; day: string }> }) {
  const { slug, day } = use(params);
  const dayNumber = Number(day);
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/marathon/${slug}/${dayNumber}/results`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (body.code === 'NOT_SUBMITTED') { setState({ kind: 'not_submitted' }); return; }
          setState({ kind: 'error', message: body.error ?? 'Could not load results.' });
          return;
        }
        const results: MarathonResultsPayload = await res.json();
        if (!cancelled) setState({ kind: 'ready', results });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Network error — check your connection.' }); });
    return () => { cancelled = true; };
  }, [slug, dayNumber]);

  if (state.kind === 'loading') {
    return <Centered><p className="text-exam-ink-muted">Loading results…</p></Centered>;
  }
  if (state.kind === 'not_submitted') {
    return <Centered>
      <p className="text-exam-ink text-lg font-semibold mb-2">You haven&apos;t submitted this day yet</p>
      <Link href={`/marathon/${slug}/${dayNumber}`} className="text-exam-gold text-sm underline">Continue Day {dayNumber}</Link>
    </Centered>;
  }
  if (state.kind === 'error') {
    return <Centered><p className="text-red-400">{state.message}</p></Centered>;
  }
  return <MarathonResultsScreen results={state.results} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-exam-base text-exam-ink flex items-center justify-center px-4">
      <div className="text-center max-w-sm">{children}</div>
    </div>
  );
}
