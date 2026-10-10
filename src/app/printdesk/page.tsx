'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Printer, Search } from 'lucide-react';
import { SUBJECT_LABELS } from '@/lib/lms/subject-constants';
import type { PrintRequestStatus } from '@/lib/db/schema';

interface Material {
  id: number;
  title: string;
  subject: string;
  docType: string | null;
  number: string | null;
  topic: string | null;
  alreadyRequested: boolean;
}

interface Req {
  id: number;
  status: PrintRequestStatus;
  rejectReason: string | null;
  createdAt: string;
  printedAt: string | null;
  collectedAt: string | null;
  items: { materialId: number; title: string; subject: string }[];
}

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ineligible'; reason: string }
  | { kind: 'ready'; materials: Material[]; requests: Req[] };

const DOC_LABEL: Record<string, string> = { lecture: 'Lecture', question_paper: 'Question paper', notes: 'Notes', homework: 'Homework', practice: 'Practice set' };

const STATUS: Record<PrintRequestStatus, { label: string; cls: string; hint: string }> = {
  requested: { label: 'Requested', cls: 'text-exam-gold border-exam-gold/40 bg-exam-gold/10', hint: 'Waiting to be printed. You can still edit or cancel it.' },
  printed: { label: 'Printed — ready to collect', cls: 'text-exam-success border-exam-success/40 bg-exam-success/10', hint: 'Collect your copies from the centre.' },
  collected: { label: 'Collected', cls: 'text-exam-ink-muted border-exam-border bg-exam-elevated', hint: '' },
  rejected: { label: 'Declined', cls: 'text-exam-danger border-exam-danger/40 bg-exam-danger/10', hint: '' },
  cancelled: { label: 'Cancelled', cls: 'text-exam-ink-faint border-exam-border bg-transparent', hint: '' },
};

const fmt = (iso: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(iso));
const subjectLabel = (s: string) => SUBJECT_LABELS[s as keyof typeof SUBJECT_LABELS] ?? s;

export default function PrintDeskPage() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/printdesk');
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setView({ kind: 'error', message: j.error ?? 'Could not load PrintDesk.' }); return; }
      if (!j.eligible) { setView({ kind: 'ineligible', reason: j.reason }); return; }
      setView({ kind: 'ready', materials: j.materials, requests: j.requests });
    } catch {
      setView({ kind: 'error', message: 'Network error — check your connection.' });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const editing = view.kind === 'ready' && editingId !== null ? view.requests.find(r => r.id === editingId) ?? null : null;
  // While editing, the request's own materials are selectable again.
  const editingIds = useMemo(() => new Set(editing?.items.map(i => i.materialId) ?? []), [editing]);

  const groups = useMemo(() => {
    if (view.kind !== 'ready') return [];
    const q = query.trim().toLowerCase();
    const list = view.materials.filter(m => !q || `${m.title} ${m.topic ?? ''} ${subjectLabel(m.subject)}`.toLowerCase().includes(q));
    const map = new Map<string, Material[]>();
    for (const m of list) map.set(m.subject, [...(map.get(m.subject) ?? []), m]);
    return [...map.entries()];
  }, [view, query]);

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const startEdit = (r: Req) => {
    setEditingId(r.id);
    setSelected(new Set(r.items.map(i => i.materialId)));
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(editingId ? `/api/printdesk/${editingId}` : '/api/printdesk', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialIds: [...selected] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMessage({ tone: 'err', text: j.error ?? 'Could not send your request.' }); return; }
      setMessage({ tone: 'ok', text: editingId ? 'Request updated.' : 'Request sent. You’ll be notified when your copies are printed.' });
      setSelected(new Set());
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: number) => {
    setConfirmCancel(null);
    const res = await fetch(`/api/printdesk/${id}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setMessage({ tone: 'err', text: j.error ?? 'Could not cancel.' });
    else { setMessage({ tone: 'ok', text: 'Request cancelled.' }); if (editingId === id) { setEditingId(null); setSelected(new Set()); } }
    await load();
  };

  return (
    <main className="min-h-screen bg-exam-base text-exam-ink">
      <div className="border-b border-exam-border bg-exam-surface">
        <div className="max-w-4xl mx-auto px-4 pb-10 sm:pb-14" style={{ paddingTop: 'max(6rem, calc(6rem + env(safe-area-inset-top)))' }}>
          <p className="text-exam-gold text-xs font-bold uppercase tracking-widest mb-3">PrintDesk</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-exam-ink mb-2">Get printed copies</h1>
          <p className="text-exam-ink-muted text-base max-w-lg">
            Missed a class? Tick the materials you need and send the request — we print one copy of each and you collect them at the centre.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
        {view.kind === 'loading' && <p className="text-exam-ink-muted">Loading…</p>}
        {view.kind === 'error' && <p className="text-exam-danger">{view.message}</p>}
        {view.kind === 'ineligible' && <p className="rounded-xl border border-exam-border bg-exam-elevated p-4 text-exam-ink-muted">{view.reason}</p>}

        {message && (
          <p className={`rounded-xl border p-3 text-sm ${message.tone === 'ok' ? 'border-exam-success/40 bg-exam-success/10 text-exam-ink' : 'border-exam-danger/40 bg-exam-danger/10 text-exam-ink'}`}>{message.text}</p>
        )}

        {view.kind === 'ready' && (
          <>
            <section>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <h2 className="font-serif text-2xl font-semibold">{editing ? `Editing request #${editing.id}` : 'Choose materials'}</h2>
                <label className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-exam-ink-faint" aria-hidden />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search materials"
                    aria-label="Search materials"
                    className="rounded-lg border border-exam-border bg-exam-elevated pl-9 pr-3 py-2 text-sm text-exam-ink placeholder:text-exam-ink-faint"
                  />
                </label>
              </div>

              {view.materials.length === 0 ? (
                <p className="text-exam-ink-muted">There are no printable materials for your batch yet.</p>
              ) : groups.length === 0 ? (
                <p className="text-exam-ink-muted">Nothing matches “{query}”.</p>
              ) : (
                <div className="space-y-6">
                  {groups.map(([subject, mats]) => (
                    <div key={subject}>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-exam-ink-faint mb-2">{subjectLabel(subject)}</h3>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {mats.map(m => {
                          const locked = m.alreadyRequested && !editingIds.has(m.id);
                          const on = selected.has(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              disabled={locked}
                              onClick={() => toggle(m.id)}
                              aria-pressed={on}
                              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${locked ? 'border-exam-border opacity-50 cursor-not-allowed' : on ? 'border-exam-gold bg-exam-gold/10' : 'border-exam-border bg-exam-elevated hover:border-exam-gold/50'}`}
                            >
                              <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-exam-gold bg-exam-gold text-exam-base' : 'border-exam-ink-faint'}`}>
                                {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-exam-ink">{m.title}</span>
                                <span className="block text-xs text-exam-ink-faint mt-0.5">
                                  {[m.docType ? DOC_LABEL[m.docType] ?? m.docType : null, m.topic].filter(Boolean).join(' · ')}
                                  {locked ? ' · already requested' : ''}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-exam-border bg-exam-surface/95 p-4 backdrop-blur">
              <span className="text-sm text-exam-ink-muted">
                {selected.size === 0 ? 'Nothing selected' : `${selected.size} material${selected.size === 1 ? '' : 's'} · 1 copy each`}
              </span>
              <div className="flex gap-2">
                {editing && (
                  <button className="rounded-lg border border-exam-border px-4 py-2.5 text-sm text-exam-ink" onClick={() => { setEditingId(null); setSelected(new Set()); }}>
                    Stop editing
                  </button>
                )}
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-exam-maroon px-5 py-2.5 text-sm font-bold text-white hover:bg-exam-maroon-bright disabled:opacity-50"
                  disabled={busy || selected.size === 0}
                  onClick={submit}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  {editing ? 'Save changes' : 'Request prints'}
                </button>
              </div>
            </div>

            <section>
              <h2 className="font-serif text-2xl font-semibold mb-4">Your requests</h2>
              {view.requests.length === 0 ? (
                <p className="text-exam-ink-muted">No requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {view.requests.map(r => (
                    <div key={r.id} className="rounded-xl border border-exam-border bg-exam-elevated p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-exam-ink">Request #{r.id}</span>
                          <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                        </div>
                        <span className="text-xs text-exam-ink-faint">{fmt(r.createdAt)}</span>
                      </div>
                      <ul className="mt-3 space-y-1">
                        {r.items.map(i => <li key={i.materialId} className="text-sm text-exam-ink">• {i.title} <span className="text-exam-ink-faint">— {subjectLabel(i.subject)}</span></li>)}
                      </ul>
                      {r.status === 'rejected' && r.rejectReason && <p className="mt-3 text-sm text-exam-danger">Reason: {r.rejectReason}</p>}
                      {STATUS[r.status].hint && <p className="mt-3 text-xs text-exam-ink-faint">{STATUS[r.status].hint}</p>}
                      {r.status === 'requested' && (
                        <div className="mt-3 flex gap-2">
                          <button className="rounded-lg border border-exam-border px-3 py-1.5 text-sm text-exam-ink hover:border-exam-gold/60" onClick={() => startEdit(r)}>Edit</button>
                          {confirmCancel === r.id ? (
                            <>
                              <button className="rounded-lg bg-exam-danger/20 px-3 py-1.5 text-sm font-semibold text-exam-danger" onClick={() => cancel(r.id)}>Yes, cancel it</button>
                              <button className="rounded-lg px-3 py-1.5 text-sm text-exam-ink-muted" onClick={() => setConfirmCancel(null)}>Keep</button>
                            </>
                          ) : (
                            <button className="rounded-lg border border-exam-border px-3 py-1.5 text-sm text-exam-ink-muted hover:text-exam-danger" onClick={() => setConfirmCancel(r.id)}>Cancel request</button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
