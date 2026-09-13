'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TakeSprintScreen from '@/components/sprint/TakeSprintScreen';
import type { SprintTakingQuestion } from '@/lib/sprint/types';

interface TakePayload {
  set: { id: number; subject: string; title: string };
  alreadyAttempted: boolean;
  questions?: SprintTakingQuestion[];
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; payload: TakePayload }
  | { kind: 'error'; message: string };

export default function SprintSetPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = use(params);
  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sprint/${setId}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setState({ kind: 'error', message: body.error ?? 'Could not load this set.' });
          return;
        }
        const payload: TakePayload = await res.json();
        if (payload.alreadyAttempted) { router.replace(`/sprint/${setId}/results`); return; }
        if (!cancelled) setState({ kind: 'ready', payload });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error', message: 'Network error — check your connection.' }); });
    return () => { cancelled = true; };
  }, [setId, router]);

  if (state.kind === 'loading') {
    return <Centered><p className="text-exam-ink-muted">Loading…</p></Centered>;
  }
  if (state.kind === 'error') {
    return <Centered>
      <p className="text-red-400 mb-4">{state.message}</p>
      <Link href="/sprint" className="text-exam-gold text-sm underline">Back to Sprint</Link>
    </Centered>;
  }
  return (
    <TakeSprintScreen
      setId={Number(setId)}
      title={state.payload.set.title}
      questions={state.payload.questions ?? []}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-exam-base text-exam-ink flex items-center justify-center px-4">
      <div className="text-center max-w-sm">{children}</div>
    </div>
  );
}
