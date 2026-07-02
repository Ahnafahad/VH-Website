'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { AttemptPayload } from '@/lib/tests/types';
import OnlineExamScreen from '@/components/tests/OnlineExamScreen';
import OfflineExamScreen from '@/components/tests/OfflineExamScreen';

const VALID_BUCKET_SLUGS = new Set(['iba', 'du-fbs']);

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; payload: AttemptPayload }
  | { kind: 'banned' }
  | { kind: 'submitted' }
  | { kind: 'time_up' }
  | { kind: 'no_attempt' }
  | { kind: 'error'; message: string };

interface PageProps {
  params: Promise<{ bucket: string; slug: string }>;
}

export default function TakePage({ params }: PageProps) {
  const { bucket: bucketSlug, slug } = use(params);

  if (!VALID_BUCKET_SLUGS.has(bucketSlug)) notFound();

  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    fetch(`/api/tests/${slug}/attempt`)
      .then(async res => {
        if (res.ok) {
          const payload: AttemptPayload = await res.json();
          setState({ kind: 'ready', payload });
          return;
        }
        const body: { error: string; code?: string } = await res.json().catch(() => ({ error: 'Unknown error' }));
        switch (body.code) {
          case 'NO_ATTEMPT':
            setState({ kind: 'no_attempt' });
            break;
          case 'ATTEMPT_BANNED':
            setState({ kind: 'banned' });
            break;
          case 'ALREADY_SUBMITTED':
            setState({ kind: 'submitted' });
            break;
          case 'TIME_UP':
            setState({ kind: 'time_up' });
            break;
          default:
            setState({ kind: 'error', message: body.error ?? 'Failed to load attempt.' });
        }
      })
      .catch(() => setState({ kind: 'error', message: 'Network error — check your connection.' }));
  }, [slug]);

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-exam-gold/30 border-t-exam-gold animate-spin" />
      </div>
    );
  }

  if (state.kind === 'no_attempt') {
    // Redirect to detail page so student can start
    if (typeof window !== 'undefined') {
      router.replace(`/tests/${bucketSlug}/${slug}`);
    }
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-exam-gold/30 border-t-exam-gold animate-spin" />
      </div>
    );
  }

  if (state.kind === 'banned') {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <div className="text-exam-danger text-5xl mb-4">🚫</div>
          <h1 className="text-exam-ink text-xl font-semibold mb-2">Access Revoked</h1>
          <p className="text-exam-ink-muted text-sm leading-relaxed mb-6">
            You have been banned from this test due to anti-cheat violations. Contact an admin to appeal.
          </p>
          <Link href={`/tests/${bucketSlug}`} className="px-6 py-3 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted text-sm inline-block">
            Back to Tests
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === 'submitted') {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border-2 border-exam-gold mb-6"
            style={{ boxShadow: 'var(--color-exam-glow-gold) 0 0 32px 0' }}>
            <span className="text-exam-gold text-2xl">✓</span>
          </div>
          <h1 className="text-exam-ink font-serif text-2xl font-semibold mb-2">Answers Locked In</h1>
          <p className="text-exam-ink-muted text-sm leading-relaxed mb-6">
            Results will be available once the test window closes and all answers have been reviewed.
          </p>
          <Link href={`/tests/${bucketSlug}`} className="px-6 py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors inline-block">
            Back to Tests
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === 'time_up') {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <div className="text-exam-warning text-5xl mb-4">⏰</div>
          <h1 className="text-exam-ink text-xl font-semibold mb-2">Time&apos;s Up</h1>
          <p className="text-exam-ink-muted text-sm leading-relaxed mb-6">
            Your attempt has been auto-submitted. Results will be available once the window closes.
          </p>
          <Link href={`/tests/${bucketSlug}`} className="px-6 py-3 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted text-sm inline-block">
            Back to Tests
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <p className="text-exam-danger text-lg mb-2">Error</p>
          <p className="text-exam-ink-muted text-sm mb-6">{state.message}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // state.kind === 'ready'
  const { payload } = state;

  if (payload.attempt.mode === 'online') {
    return (
      <OnlineExamScreen
        slug={slug}
        bucket={bucketSlug}
        initialPayload={payload}
      />
    );
  }

  return (
    <OfflineExamScreen
      slug={slug}
      bucket={bucketSlug}
      initialPayload={payload}
    />
  );
}
