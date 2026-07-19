'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AttemptPayload } from '@/lib/tests/types';
import OnlineExamScreen from '@/components/tests/OnlineExamScreen';

interface SectionInfo {
  id: number;
  title: string;
  order: number;
  compulsory: boolean;
}
interface SectionsPayload {
  test: { slug: string; title: string; durationMinutes: number | null; windowId: number | null };
  sections: SectionInfo[];
  alreadyStarted: boolean;
  alreadySubmitted: boolean;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'picker'; data: SectionsPayload }
  | { kind: 'ready'; payload: AttemptPayload }
  | { kind: 'banned' }
  | { kind: 'submitted' }
  | { kind: 'time_up' }
  | { kind: 'no_attempt' }
  | { kind: 'error'; message: string };

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function DiagnosticTakePage({ params }: PageProps) {
  const { slug } = use(params);

  const router = useRouter();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  // Loads the caller's in-progress attempt and renders the exam.
  const loadAttempt = useCallback(async () => {
    try {
      const res = await fetch(`/api/tests/${slug}/attempt`);
      if (res.ok) {
        const payload: AttemptPayload = await res.json();
        setState({ kind: 'ready', payload });
        return;
      }
      const body: { error: string; code?: string } = await res
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      switch (body.code) {
        case 'NO_ATTEMPT':
        case 'NO_SELECTION':
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
    } catch {
      setState({ kind: 'error', message: 'Network error — check your connection.' });
    }
  }, [slug]);

  // On mount: decide between picker, resume, submitted-redirect.
  useEffect(() => {
    fetch(`/api/fbs-diagnosis/${slug}/sections`)
      .then(async (res) => {
        if (!res.ok) {
          const body: { error?: string } = await res.json().catch(() => ({}));
          setState({ kind: 'error', message: body.error ?? 'Failed to load the diagnostic.' });
          return;
        }
        const data: SectionsPayload = await res.json();
        if (data.alreadySubmitted) {
          router.replace(`/fbs-diagnosis/${slug}/results`);
          return;
        }
        if (data.alreadyStarted) {
          void loadAttempt();
          return;
        }
        setState({ kind: 'picker', data });
      })
      .catch(() => setState({ kind: 'error', message: 'Network error — check your connection.' }));
  }, [slug, router, loadAttempt]);

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-exam-base flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-exam-gold/30 border-t-exam-gold animate-spin" />
      </div>
    );
  }

  if (state.kind === 'picker') {
    return <SubjectPicker slug={slug} data={state.data} onStarted={loadAttempt} onError={(m) => setState({ kind: 'error', message: m })} onBanned={() => setState({ kind: 'banned' })} onSubmitted={() => router.replace(`/fbs-diagnosis/${slug}/results`)} />;
  }

  if (state.kind === 'no_attempt') {
    if (typeof window !== 'undefined') {
      router.replace('/fbs-diagnosis');
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
            You have been banned from this assessment due to anti-cheat violations. Contact an admin to appeal.
          </p>
          <Link href="/fbs-diagnosis" className="px-6 py-3 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted text-sm inline-block">
            Back to Diagnostic
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
            Your diagnostic is submitted. View your detailed results now.
          </p>
          <Link href={`/fbs-diagnosis/${slug}/results`} className="px-6 py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors inline-block">
            View results
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
            Your attempt has been auto-submitted. View your detailed results now.
          </p>
          <Link href={`/fbs-diagnosis/${slug}/results`} className="px-6 py-3 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium transition-colors inline-block">
            View results
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

  // state.kind === 'ready' — diagnostics are online-only
  const { payload } = state;

  return (
    <OnlineExamScreen
      slug={slug}
      bucket={payload.test.bucket}
      initialPayload={payload}
      exitHref="/fbs-diagnosis"
      exitLabel="Back to Diagnostic"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  SUBJECT PICKER                                                    */
/*  Compulsory English sections are locked-in; pick exactly 2 of the  */
/*  3 electives. Start begins the 30-minute timer immediately.        */
/* ------------------------------------------------------------------ */

interface PickerProps {
  slug: string;
  data: SectionsPayload;
  onStarted: () => void;
  onError: (message: string) => void;
  onBanned: () => void;
  onSubmitted: () => void;
}

function SubjectPicker({ slug, data, onStarted, onError, onBanned, onSubmitted }: PickerProps) {
  const compulsory = data.sections.filter((s) => s.compulsory);
  const electives = data.sections.filter((s) => !s.compulsory);

  const [chosen, setChosen] = useState<number[]>([]);
  const [starting, setStarting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const toggle = (id: number) => {
    setLocalError(null);
    setChosen((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev; // enforce exactly 2
      return [...prev, id];
    });
  };

  const canStart = chosen.length === 2 && data.test.windowId != null && !starting;

  const handleStart = async () => {
    if (data.test.windowId == null) {
      setLocalError('This assessment is not open right now.');
      return;
    }
    if (chosen.length !== 2) {
      setLocalError('Choose exactly 2 elective subjects.');
      return;
    }
    setStarting(true);
    setLocalError(null);
    try {
      const res = await fetch(`/api/fbs-diagnosis/${slug}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ windowId: data.test.windowId, electiveSectionIds: chosen }),
      });
      if (res.ok) {
        onStarted();
        return;
      }
      const body: { error?: string; code?: string } = await res.json().catch(() => ({}));
      if (body.code === 'ATTEMPT_BANNED') {
        onBanned();
        return;
      }
      if (body.code === 'ALREADY_SUBMITTED') {
        onSubmitted();
        return;
      }
      setLocalError(body.error ?? 'Could not start the assessment. Please try again.');
      setStarting(false);
    } catch {
      setLocalError('Network error — please try again.');
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-exam-base text-exam-ink flex items-center justify-center px-4 sm:px-6 py-14">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <p className="text-exam-gold text-[11px] tracking-[0.25em] uppercase mb-3">
            {data.test.title}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold mb-3">
            Choose your subjects
          </h1>
          <p className="text-exam-ink-muted text-sm leading-relaxed max-w-lg">
            The two English sections are compulsory. Pick <span className="text-exam-ink font-medium">exactly 2</span> of
            the remaining 3 subjects. You&rsquo;ll attempt 4 sections in total — scored out of 40. The
            un-chosen subject is excluded entirely (it is not marked wrong).
          </p>
        </div>

        {/* Compulsory — locked in */}
        <div className="mb-6">
          <p className="text-exam-ink-faint text-[10px] tracking-[0.2em] uppercase mb-3">
            Compulsory
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {compulsory.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl px-4 py-3.5 bg-exam-surface border border-exam-gold/30"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-exam-gold/20 text-exam-gold text-xs">
                  ✓
                </span>
                <span className="text-exam-ink text-sm font-medium">{s.title}</span>
                <span className="ml-auto text-exam-ink-faint text-[10px] tracking-wide uppercase">
                  Locked
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Electives — pick 2 */}
        <div className="mb-8">
          <p className="text-exam-ink-faint text-[10px] tracking-[0.2em] uppercase mb-3">
            Pick 2 electives · {chosen.length}/2 selected
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {electives.map((s) => {
              const selected = chosen.includes(s.id);
              const disabled = !selected && chosen.length >= 2;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  disabled={disabled || starting}
                  className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors border disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selected
                      ? 'color-mix(in srgb, var(--color-exam-maroon) 22%, transparent)'
                      : 'var(--color-exam-surface)',
                    borderColor: selected
                      ? 'var(--color-exam-maroon-bright)'
                      : 'var(--color-exam-border)',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-md text-xs shrink-0 border"
                    style={{
                      background: selected ? 'var(--color-exam-maroon-bright)' : 'transparent',
                      borderColor: selected ? 'var(--color-exam-maroon-bright)' : 'var(--color-exam-border)',
                      color: selected ? 'var(--color-exam-ink)' : 'transparent',
                    }}
                  >
                    ✓
                  </span>
                  <span className="text-exam-ink text-sm font-medium">{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {localError && (
          <div className="mb-5 rounded-xl border border-exam-danger/40 bg-exam-danger/10 px-4 py-3 text-sm text-exam-danger">
            {localError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="flex-1 px-6 py-4 rounded-xl bg-exam-maroon hover:bg-exam-maroon-bright text-exam-ink text-sm font-medium tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? 'Starting…' : 'Start — the 30-minute timer begins now'}
          </button>
          <Link
            href="/fbs-diagnosis"
            className="px-6 py-4 rounded-xl bg-exam-elevated border border-exam-border text-exam-ink-muted text-sm text-center"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
