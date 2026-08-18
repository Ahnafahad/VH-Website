'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Pin, Edit2, Trash2, Plus, ExternalLink, X, Users } from 'lucide-react';
import {
  SubjectBadge, Toast, ConfirmDialog, Modal, Toggle,
  FieldLabel, FieldInput, FieldTextarea, FieldSelect, PrimaryBtn, GhostBtn,
  IconBtn, EmptyState, PageHeader, FormActions,
  fmtDhaka,
  SPIN_CSS, RED, SLATE, BORDER, MUTED, BG, rowV,
  SURFACE, INK_SOFT, R_MD, R_LG, R_PILL, T_XS, T_SM, T_BASE,
} from './lms-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TargetUser {
  id: number;
  name: string;
  email: string;
}

export interface LmsAnnouncement {
  id: number;
  title: string;
  body: string;
  subject: string;
  product: string;
  batch: string | null;
  /** Named individuals this announcement targets — null = cohort-targeted (batch/product above). */
  targetUsers: TargetUser[] | null;
  pinned: boolean;
  createdBy: number;
  createdAt: number;
}

interface AudienceBatch {
  id: number;
  name: string;
  product: string;
}

interface Props {
  initialAnnouncements: LmsAnnouncement[];
  batches: AudienceBatch[];
}

const SUBJECTS = ['english', 'math', 'analytical', 'accounting', 'economics', 'business_studies'];

function audienceModeBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '6px 12px', borderRadius: R_MD, fontSize: T_SM, fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${active ? RED : BORDER}`,
    background: active ? `${RED}0F` : SURFACE,
    color: active ? RED : INK_SOFT,
  };
}

// ─── Individual picker ─────────────────────────────────────────────────────────
// Search-and-add widget for targeting named students, mirroring the email
// blast's IndividualPicker (src/components/admin/AnnouncementsClient.tsx) but
// styled with this file's lms-shared primitives.

function IndividualPicker({
  selected, onChange,
}: {
  selected: TargetUser[];
  onChange: (next: TargetUser[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TargetUser[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/users?search=${encodeURIComponent(query.trim())}&limit=8`)
        .then(res => res.json())
        .then((data: { users?: TargetUser[] }) => setResults(data.users ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const addPick = (pick: TargetUser) => {
    if (selected.some(s => s.id === pick.id)) return;
    onChange([...selected, pick]);
    setQuery(''); setResults([]);
  };
  const removePick = (id: number) => onChange(selected.filter(s => s.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <FieldInput
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or email…"
        />
        {(results.length > 0 || loading) && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_MD,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: 200, overflowY: 'auto',
          }}>
            {loading && <div style={{ padding: '8px 12px', fontSize: T_SM, color: MUTED }}>Searching…</div>}
            {!loading && results.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => addPick(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontSize: 12.5, color: SLATE,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}
              >
                {r.name} <span style={{ color: MUTED }}>({r.email})</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {selected.map(s => (
            <span key={s.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 8px', borderRadius: R_PILL, fontSize: 11.5,
              background: BG, border: `1px solid ${BORDER}`, color: INK_SOFT,
            }}>
              {s.name}
              <button
                type="button"
                onClick={() => removePick(s.id)}
                aria-label={`Remove ${s.name}`}
                style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: INK_SOFT, padding: 0 }}
              >
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Announcement form modal ──────────────────────────────────────────────────

type AudienceMode = 'batchProduct' | 'individuals';

interface AnnForm {
  title: string; body: string; subject: string; product: string;
  batch: string; pinned: boolean;
  audienceMode: AudienceMode;
  individuals: TargetUser[];
}

const defaultForm: AnnForm = {
  title: '', body: '', subject: 'english', product: 'iba',
  batch: '', pinned: false,
  audienceMode: 'batchProduct', individuals: [],
};

function annFormFromEditing(editing: LmsAnnouncement): AnnForm {
  return {
    title: editing.title,
    body: editing.body,
    subject: editing.subject,
    product: editing.product,
    batch: editing.batch ?? '',
    pinned: editing.pinned,
    audienceMode: editing.targetUsers && editing.targetUsers.length > 0 ? 'individuals' : 'batchProduct',
    individuals: editing.targetUsers ?? [],
  };
}

function AnnouncementModal({
  open, editing, onClose, onSaved, batches,
}: {
  open: boolean; editing: LmsAnnouncement | null;
  onClose: () => void; onSaved: (a: LmsAnnouncement) => void;
  batches: AudienceBatch[];
}) {
  const [form, setForm] = useState<AnnForm>(() => editing ? annFormFromEditing(editing) : defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Resync form state whenever the modal opens — it's mounted once and reused
  // for every announcement, so `editing` can change without a remount (same
  // fix as ClassesClient's SessionModal).
  useEffect(() => {
    if (!open) return;
    setForm(editing ? annFormFromEditing(editing) : defaultForm);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const f = (k: keyof AnnForm, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required'); return;
    }
    if (form.audienceMode === 'individuals' && form.individuals.length === 0) {
      setError('Search and add at least one student'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        subject: form.subject,
        product: form.product,
        batch: form.audienceMode === 'individuals' ? null : (form.batch.trim() || null),
        targetUserIds: form.audienceMode === 'individuals' ? form.individuals.map(i => i.id) : null,
        pinned: form.pinned,
      };
      const url    = editing ? `/api/lms/admin/announcements-feed/${editing.id}` : '/api/lms/admin/announcements-feed';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed'); }
      const saved = await res.json() as LmsAnnouncement;
      onSaved(saved); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Announcement' : 'New Announcement'} width={540}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <FieldLabel>Title *</FieldLabel>
          <FieldInput value={form.title} onChange={e => f('title', e.target.value)} placeholder="Announcement title" />
        </div>
        <div>
          <FieldLabel>Body *</FieldLabel>
          <FieldTextarea value={form.body} onChange={e => f('body', e.target.value)}
            placeholder="Write the announcement…" rows={5} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel>Subject *</FieldLabel>
            <FieldSelect value={form.subject} onChange={e => f('subject', e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </FieldSelect>
          </div>
          <div>
            <FieldLabel>Product *</FieldLabel>
            <FieldSelect value={form.product} onChange={e => f('product', e.target.value)}>
              <option value="iba">IBA</option>
              <option value="fbs">FBS</option>
              <option value="fbs_detailed">FBS Detailed</option>
            </FieldSelect>
          </div>
        </div>
        <div>
          <FieldLabel>Send to</FieldLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => f('audienceMode', 'batchProduct')}
              className="lms-btn"
              style={audienceModeBtnStyle(form.audienceMode === 'batchProduct')}
            >
              Batch &amp; product
            </button>
            <button
              type="button"
              onClick={() => f('audienceMode', 'individuals')}
              className="lms-btn"
              style={audienceModeBtnStyle(form.audienceMode === 'individuals')}
            >
              <Users size={12} aria-hidden style={{ marginRight: 4 }} />
              Specific students
            </button>
          </div>
          {form.audienceMode === 'batchProduct' ? (
            <FieldSelect value={form.batch} onChange={e => f('batch', e.target.value)}>
              <option value="">All batches</option>
              {batches.filter(b => b.product === form.product).map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
              {form.batch && !batches.some(b => b.product === form.product && b.name === form.batch) && (
                <option value={form.batch}>{form.batch} (inactive/removed)</option>
              )}
            </FieldSelect>
          ) : (
            <IndividualPicker
              selected={form.individuals}
              onChange={next => setForm(p => ({ ...p, individuals: next }))}
            />
          )}
        </div>
        <Toggle checked={form.pinned} onChange={v => f('pinned', v)} label="Pin to top of feed" />
        {error && <p style={{ fontSize: T_SM, color: RED, margin: 0 }}>{error}</p>}
        <FormActions>
          <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} loading={saving} small>
            {editing ? 'Save Changes' : 'Post Announcement'}
          </PrimaryBtn>
        </FormActions>
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnnouncementsFeedClient({ initialAnnouncements, batches }: Props) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LmsAnnouncement | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const handleSaved = (saved: LmsAnnouncement) => {
    setAnnouncements(prev => {
      const idx = prev.findIndex(a => a.id === saved.id);
      const next = idx >= 0 ? prev.map(a => a.id === saved.id ? saved : a) : [saved, ...prev];
      // Pinned items first
      return next.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);
    });
    showToast(editing ? 'Announcement updated' : 'Announcement posted');
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lms/admin/announcements-feed/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setAnnouncements(prev => prev.filter(a => a.id !== deleteId));
      showToast('Deleted');
    } catch {
      showToast('Delete failed');
    } finally {
      setDeleting(false); setDeleteId(null);
    }
  };

  const handleTogglePin = async (ann: LmsAnnouncement) => {
    try {
      const res = await fetch(`/api/lms/admin/announcements-feed/${ann.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !ann.pinned }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json() as LmsAnnouncement;
      setAnnouncements(prev => {
        const next = prev.map(a => a.id === updated.id ? updated : a);
        return next.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);
      });
    } catch {
      showToast('Update failed');
    }
  };

  return (
    <>
      <style>{SPIN_CSS}</style>
      <style>{`
        .lms-ann-email-link:hover { border-color: ${RED}; color: ${RED}; }
        .lms-ann-email-link:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; }
        .lms-ann-pin:hover { border-color: ${RED}; }
        .lms-ann-pin:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; }
      `}</style>
      <PageHeader
        title="Announcement Feed"
        subtitle={
          <span>
            In-app feed for students — distinct from{' '}
            <a
              href="/admin/announcements"
              style={{ color: RED, textDecoration: 'none', fontWeight: 500 }}
            >
              Email Announcements
            </a>
          </span> as any
        }
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a
              href="/admin/announcements"
              className="lms-ann-email-link"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: R_MD, background: BG,
                border: `1px solid ${BORDER}`, color: INK_SOFT,
                fontSize: T_SM, fontWeight: 500, textDecoration: 'none',
                transition: 'border-color 0.14s',
              }}
            >
              Email Blasts <ExternalLink size={11} aria-hidden />
            </a>
            <PrimaryBtn onClick={() => { setEditing(null); setModalOpen(true); }} small>
              <Plus size={13} aria-hidden />
              New Post
            </PrimaryBtn>
          </div>
        }
      />

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} message="No announcements yet. Post one for students to see." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {announcements.map((a, i) => (
            <motion.div
              key={a.id}
              custom={i} variants={rowV} initial="hidden" animate="visible"
              style={{
                background: a.pinned ? `${RED}0F` : SURFACE,
                border: `1px solid ${a.pinned ? `${RED}40` : BORDER}`,
                borderRadius: R_LG, padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    {a.pinned && (
                      <Pin size={12} style={{ color: RED, flexShrink: 0 }} aria-hidden />
                    )}
                    <p style={{ margin: 0, fontSize: T_BASE, fontWeight: 600, color: SLATE }}>{a.title}</p>
                    <SubjectBadge subject={a.subject} />
                    {a.targetUsers && a.targetUsers.length > 0 ? (
                      <span
                        title={a.targetUsers.map(u => u.name).join(', ')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: T_XS, color: RED, background: `${RED}0F`, border: `1px solid ${RED}33`, padding: '2px 7px', borderRadius: R_PILL }}
                      >
                        <Users size={10} aria-hidden />
                        {a.targetUsers.length} student{a.targetUsers.length === 1 ? '' : 's'}
                      </span>
                    ) : a.batch && (
                      <span style={{ fontSize: T_XS, color: MUTED, background: BG, border: `1px solid ${BORDER}`, padding: '2px 7px', borderRadius: R_PILL }}>
                        Batch {a.batch}
                      </span>
                    )}
                    <span style={{ fontSize: T_XS, color: MUTED, background: BG, border: `1px solid ${BORDER}`, padding: '2px 7px', borderRadius: R_PILL }}>
                      {a.product.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: T_SM, color: INK_SOFT, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                    {a.body}
                  </p>
                  <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>
                    Posted {fmtDhaka(a.createdAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <motion.button
                    onClick={() => void handleTogglePin(a)}
                    whileTap={{ scale: 0.92 }}
                    title={a.pinned ? 'Unpin' : 'Pin to top'}
                    aria-label={a.pinned ? 'Unpin' : 'Pin to top'}
                    className="lms-ann-pin"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 40, height: 40, borderRadius: R_MD,
                      border: `1px solid ${a.pinned ? `${RED}4D` : BORDER}`,
                      background: a.pinned ? `${RED}0F` : SURFACE,
                      color: a.pinned ? RED : MUTED, cursor: 'pointer',
                      transition: 'border-color 0.14s',
                    }}
                  >
                    <Pin size={13} aria-hidden />
                  </motion.button>
                  <IconBtn icon={Edit2} label="Edit" onClick={() => { setEditing(a); setModalOpen(true); }} />
                  <IconBtn icon={Trash2} label="Delete" danger onClick={() => setDeleteId(a.id)} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnnouncementModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={handleSaved}
        batches={batches}
      />
      <ConfirmDialog
        open={!!deleteId} title="Delete this announcement?"
        message="Students will no longer see this in their feed."
        confirmLabel="Delete" destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
      <Toast message={toast} />
    </>
  );
}
