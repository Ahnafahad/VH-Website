'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Copy, NotebookPen, Pencil, Plus } from 'lucide-react';
import {
  BG, BORDER, ConfirmDialog, EmptyState, GhostBtn, MUTED, OK, OK_BG, PageHeader, PrimaryBtn, R_LG, R_PILL, RED, SLATE, SPIN_CSS, SURFACE,
  T_SM, T_XS, Toast, WARN, WARN_BG, fmtDhaka,
} from '@/components/admin/lms/lms-shared';
import SeriesEditor, { type SeriesFormValue } from '@/components/admin/essays/SeriesEditor';
import type { EssaySection } from '@/lib/essays/types';

interface SeriesRow {
  id: number;
  title: string;
  essayDate: string | null;
  essayCount: number;
  totalMarks: number;
  product: string;
  batch: string | null;
  deadline: string;
  status: string;
  publishedAt: string | null;
  counts: { submitted: number; graded: number; rejected: number; total: number };
}

const PRODUCT_LABEL: Record<string, string> = { iba: 'IBA', fbs: 'FBS', fbs_detailed: 'FBS Detailed' };

function StatePill({ s }: { s: SeriesRow }) {
  const open = new Date(s.deadline).getTime() > Date.now();
  const [label, fg, bg] = s.status === 'archived'
    ? ['Archived', MUTED, BG]
    : s.publishedAt
      ? ['Published', OK, OK_BG]
      : open
        ? ['Open for submissions', WARN, WARN_BG]
        : s.counts.submitted > 0 ? ['Marking', RED, `${RED}12`] : ['Closed', MUTED, BG];
  return <span style={{ fontSize: T_XS, fontWeight: 700, padding: '3px 8px', borderRadius: R_PILL, color: fg, background: bg, whiteSpace: 'nowrap' }}>{label}</span>;
}

export default function EssaysAdminPage() {
  const [rows, setRows] = useState<SeriesRow[] | null>(null);
  const [editing, setEditing] = useState<SeriesFormValue | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/essays/series');
    const j = await res.json().catch(() => ({}));
    setRows(res.ok ? j.series : []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openEdit = async (id: number) => {
    const res = await fetch(`/api/admin/essays/series/${id}`);
    if (!res.ok) return;
    const { series } = (await res.json()) as { series: SeriesFormValue & { sections: EssaySection[] } };
    setEditing(series);
    setEditorOpen(true);
  };

  const duplicate = async (id: number) => {
    const res = await fetch(`/api/admin/essays/series/${id}/duplicate`, { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setToast(j.error ?? 'Could not duplicate'); return; }
    await load();
    setEditing(j.series);
    setEditorOpen(true);
  };

  const setStatus = async (id: number, status: 'active' | 'archived') => {
    const res = await fetch(`/api/admin/essays/series/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { await load(); setToast(status === 'archived' ? 'Series archived — hidden from students' : 'Series restored'); }
  };

  const remove = async (id: number) => {
    const res = await fetch(`/api/admin/essays/series/${id}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    setDeleteId(null);
    if (!res.ok) { setToast(j.error ?? 'Could not delete'); return; }
    await load();
  };

  const visible = (rows ?? []).filter(r => showArchived || r.status !== 'archived');

  return (
    <div style={{ maxWidth: 1040 }}>
      <style>{SPIN_CSS}</style>
      <PageHeader
        title="Essays"
        subtitle="Handwritten essay series — students upload photos of their scripts, you mark them page by page."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/admin/essays/analytics" style={{ textDecoration: 'none' }}><GhostBtn><BarChart3 size={14} aria-hidden /> Analytics</GhostBtn></Link>
            <PrimaryBtn onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={14} aria-hidden /> New series</PrimaryBtn>
          </div>
        }
      />

      {rows === null ? (
        <p style={{ fontSize: T_SM, color: MUTED }}>Loading…</p>
      ) : visible.length === 0 ? (
        <EmptyState icon={NotebookPen} message="No essay series yet. Create the first one — students will see it in their portal straight away." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visible.map(s => {
            const done = s.counts.graded + s.counts.rejected;
            const pct = s.counts.total ? Math.round((done / s.counts.total) * 100) : 0;
            return (
              <div key={s.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 16, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Link href={`/admin/essays/${s.id}`} style={{ fontSize: 16, fontWeight: 700, color: SLATE, textDecoration: 'none' }}>{s.title}</Link>
                      <StatePill s={s} />
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: T_SM, color: MUTED }}>
                      {PRODUCT_LABEL[s.product] ?? s.product} · {s.batch ?? 'All batches'} · {s.essayCount} essay{s.essayCount > 1 ? 's' : ''} × {s.totalMarks} marks · deadline {fmtDhaka(new Date(s.deadline).getTime())}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Link href={`/admin/essays/${s.id}/mark`} style={{ textDecoration: 'none' }}><PrimaryBtn small>Mark</PrimaryBtn></Link>
                    <Link href={`/admin/essays/${s.id}`} style={{ textDecoration: 'none' }}><GhostBtn small>Scripts</GhostBtn></Link>
                    <GhostBtn small onClick={() => openEdit(s.id)}><Pencil size={12} aria-hidden /> Edit</GhostBtn>
                    <GhostBtn small onClick={() => duplicate(s.id)}><Copy size={12} aria-hidden /> Duplicate</GhostBtn>
                    {s.status === 'archived'
                      ? <GhostBtn small onClick={() => setStatus(s.id, 'active')}>Restore</GhostBtn>
                      : <GhostBtn small onClick={() => setStatus(s.id, 'archived')}>Archive</GhostBtn>}
                    {s.counts.total === 0 && <GhostBtn small onClick={() => setDeleteId(s.id)}>Delete</GhostBtn>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: R_PILL, background: BG, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: OK }} />
                  </div>
                  <span style={{ fontSize: T_SM, color: MUTED, whiteSpace: 'nowrap' }}>
                    {s.counts.total} submitted · {s.counts.graded} graded · {s.counts.rejected} rejected · {s.counts.submitted} to mark
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {(rows ?? []).some(r => r.status === 'archived') && (
        <div style={{ marginTop: 16 }}>
          <GhostBtn small onClick={() => setShowArchived(v => !v)}>{showArchived ? 'Hide archived' : 'Show archived'}</GhostBtn>
        </div>
      )}

      <SeriesEditor open={editorOpen} initial={editing} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); void load(); setToast('Saved'); }} />
      <ConfirmDialog
        open={deleteId !== null}
        title="Delete series"
        message="Delete this series? Nobody has submitted yet, so nothing else is lost."
        confirmLabel="Delete"
        destructive
        onConfirm={() => deleteId !== null && remove(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
