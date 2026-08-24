'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/admin/lms/lms-shared';

interface ChapterOption { id: number; slug: string; title: string; product: string; totalDays: number; questionsPerDay: number; status: string }
interface BatchOption { id: number; name: string; product: string; status: string }
interface AssignmentRow { id: number; chapterId: number; chapterTitle: string; product: string; batch: string | null; startDate: number }

export default function MarathonAdminPage() {
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [chapterId, setChapterId] = useState<number | ''>('');
  const [batchName, setBatchName] = useState<string>(''); // '' = all batches
  const [startDate, setStartDate] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = async () => {
    const [chRes, batchRes, assignRes] = await Promise.all([
      fetch('/api/admin/marathon/chapters'),
      fetch('/api/admin/batches'),
      fetch('/api/admin/marathon/assignments'),
    ]);
    if (chRes.ok) setChapters((await chRes.json()).chapters);
    if (batchRes.ok) setBatches((await batchRes.json()).batches);
    if (assignRes.ok) setAssignments((await assignRes.json()).assignments);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedChapter = chapters.find(c => c.id === chapterId);
  const batchesForProduct = batches.filter(b => b.product === selectedChapter?.product);

  const startEdit = (a: AssignmentRow) => {
    setEditingId(a.id);
    const d = new Date(a.startDate);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setEditDate(local);
  };

  const saveEdit = async (id: number) => {
    if (!editDate) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/marathon/assignments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: new Date(`${editDate}T00:00:00`).getTime() }),
      });
      if (res.ok) {
        setEditingId(null);
        await load();
      }
    } finally {
      setEditSaving(false);
    }
  };

  const deleteAssignment = async (id: number) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/marathon/assignments/${id}`, { method: 'DELETE' });
      if (res.status === 409) {
        setDeleteError('This assignment has student attempts and cannot be deleted.');
      } else if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? 'Could not delete assignment');
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

  const togglePublish = async (chapter: ChapterOption) => {
    const nextStatus = chapter.status === 'published' ? 'draft' : 'published';
    const res = await fetch(`/api/admin/marathon/chapters/${chapter.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) await load();
  };

  const submit = async () => {
    if (!chapterId || !startDate || !selectedChapter) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/marathon/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId,
          product: selectedChapter.product,
          batch: batchName || null,
          startDate: new Date(`${startDate}T00:00:00`).getTime(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not create assignment');
      }
      setChapterId('');
      setBatchName('');
      setStartDate('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-1">Math Marathon</h1>
      <p className="text-muted-foreground text-sm mb-8">Assign a chapter to a batch. Day 1 unlocks on the start date; each later day unlocks one calendar day after the previous, and stays open once unlocked.</p>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <h2 className="font-semibold text-sm mb-3">Chapters</h2>
          <div className="border rounded-xl divide-y mb-8">
            {chapters.length === 0 && <p className="text-sm text-muted-foreground p-4">No chapters imported yet — run scripts/import-marathon.mjs.</p>}
            {chapters.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-muted-foreground text-xs">{c.totalDays} days · {c.questionsPerDay} q/day · {c.product}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={c.status === 'published' ? 'text-emerald-600 text-xs font-semibold' : 'text-muted-foreground text-xs'}>{c.status}</span>
                  <Button variant="outline" size="sm" onClick={() => togglePublish(c)}>
                    {c.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Link href={`/admin/marathon/${c.id}`} className="text-sm text-primary hover:underline">View days →</Link>
                </div>
              </div>
            ))}
          </div>

          <div className="border rounded-xl p-5 mb-8 space-y-4">
            <h2 className="font-semibold text-sm">New assignment</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Chapter</label>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={chapterId}
                  onChange={e => { setChapterId(e.target.value ? Number(e.target.value) : ''); setBatchName(''); }}
                >
                  <option value="">Select…</option>
                  {chapters.map(c => (
                    <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Batch</label>
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={batchName}
                  onChange={e => setBatchName(e.target.value)}
                  disabled={!selectedChapter}
                >
                  <option value="">All batches on {selectedChapter?.product ?? 'this product'}</option>
                  {batchesForProduct.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Day 1 unlocks on</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={saving || !chapterId || !startDate}>
              {saving ? 'Assigning…' : 'Assign'}
            </Button>
          </div>

          <h2 className="font-semibold text-sm mb-3">Existing assignments</h2>
          {deleteError && <p className="text-sm text-destructive mb-3">{deleteError}</p>}
          <div className="border rounded-xl divide-y">
            {assignments.length === 0 && <p className="text-sm text-muted-foreground p-4">No assignments yet.</p>}
            {assignments.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{a.chapterTitle}</p>
                  <p className="text-muted-foreground text-xs">{a.product} · {a.batch ?? 'all batches'}</p>
                </div>
                {editingId === a.id ? (
                  <div className="flex items-center gap-2">
                    <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8" />
                    <Button size="sm" onClick={() => saveEdit(a.id)} disabled={editSaving}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-muted-foreground text-xs">Day 1: {new Date(a.startDate).toLocaleDateString()}</p>
                    <Button size="sm" variant="outline" onClick={() => startEdit(a)}>Edit date</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setDeleteError(null); setConfirmDeleteId(a.id); }}>Delete</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete assignment"
        message="This will permanently remove this assignment. If any eligible student already has an attempt on one of the chapter's days, deletion will be blocked."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={() => confirmDeleteId !== null && deleteAssignment(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
