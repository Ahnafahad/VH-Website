'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/admin/lms/lms-shared';
import type { ReadingSpeedAdminAttemptRow } from '@/lib/reading-speed-test/types';

export default function ReadingSpeedTestAdminPage() {
  const [attempts, setAttempts] = useState<ReadingSpeedAdminAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/admin/reading-speed-test');
    if (res.ok) setAttempts((await res.json()).attempts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetAll = async () => {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reading-speed-test', { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not reset progress.');
      } else {
        await load();
      }
    } catch {
      setError('Network error.');
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-semibold">Reading Speed Test</h1>
        <Button variant="destructive" size="sm" onClick={() => { setError(null); setConfirmReset(true); }}>
          Reset all progress
        </Button>
      </div>
      <p className="text-muted-foreground text-sm mb-8">
        Hidden, link-only WPM + comprehension check-in. Any logged-in user can take it via /reading-speed-test — not linked from any page or navbar.
      </p>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="border rounded-xl divide-y">
          {attempts.length === 0 && <p className="text-sm text-muted-foreground p-4">No attempts yet.</p>}
          {attempts.map(a => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{a.name} <span className="text-muted-foreground font-normal">· {a.email}</span></p>
                <p className="text-muted-foreground text-xs">
                  {a.passageTitle} · {a.rawWpm} wpm · {a.correctCount}/{a.totalQuestions} correct · {new Date(a.createdAt * 1000).toLocaleString()}
                </p>
              </div>
              <span className={a.verified ? 'text-emerald-600 text-xs font-semibold' : 'text-muted-foreground text-xs'}>
                {a.verified ? 'Verified' : 'Not verified'}
              </span>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reset all progress"
        message="This permanently deletes every user's reading speed test attempts — including leaderboard standings. This cannot be undone."
        confirmLabel="Reset all"
        destructive
        loading={resetting}
        onConfirm={resetAll}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
