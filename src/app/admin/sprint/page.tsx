'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/admin/lms/lms-shared';
import { SUBJECT_LABELS } from '@/lib/lms/subject-constants';
import type { LmsSubject } from '@/lib/db/schema';

interface SetRow {
  id: number;
  subject: LmsSubject;
  title: string;
  status: string;
  questionCount: number;
  attemptCount: number;
}

export default function SprintAdminPage() {
  const [sets, setSets] = useState<SetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/admin/sprint/sets');
    if (res.ok) setSets((await res.json()).sets);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (set: SetRow) => {
    const nextStatus = set.status === 'active' ? 'draft' : 'active';
    const res = await fetch(`/api/admin/sprint/sets/${set.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) await load();
  };

  const deleteSet = async (id: number) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/sprint/sets/${id}`, { method: 'DELETE' });
      if (res.status === 409) {
        setDeleteError('This set has student attempts and cannot be deleted.');
      } else if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? 'Could not delete set');
      } else {
        await load();
      }
    } catch {
      setDeleteError('Network error.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-1">Sprint</h1>
      <p className="text-muted-foreground text-sm mb-8">
        In-class MCQ sets for Accounting, Economics, and Business Studies. Activate a set to make it visible to students — one attempt per student per set. Import content with scripts/import-sprint.mjs.
      </p>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          {deleteError && <p className="text-sm text-destructive mb-3">{deleteError}</p>}
          <div className="border rounded-xl divide-y">
            {sets.length === 0 && <p className="text-sm text-muted-foreground p-4">No sets imported yet — run scripts/import-sprint.mjs.</p>}
            {sets.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {SUBJECT_LABELS[s.subject]} · {s.questionCount} questions · {s.attemptCount} attempts
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={s.status === 'active' ? 'text-emerald-600 text-xs font-semibold' : 'text-muted-foreground text-xs'}>{s.status}</span>
                  <Button variant="outline" size="sm" onClick={() => toggleStatus(s)}>
                    {s.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { setDeleteError(null); setConfirmDeleteId(s.id); }}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete set"
        message="This will permanently remove this set and its questions. If any student already has an attempt on it, deletion will be blocked."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={() => confirmDeleteId !== null && deleteSet(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
