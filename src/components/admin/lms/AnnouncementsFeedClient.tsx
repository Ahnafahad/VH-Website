'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Pin, Edit2, Trash2, Plus, ExternalLink } from 'lucide-react';
import {
  SubjectBadge, Toast, ConfirmDialog, Modal, Toggle,
  FieldLabel, FieldInput, FieldTextarea, FieldSelect, PrimaryBtn, GhostBtn,
  IconBtn, EmptyState, PageHeader,
  fmtDhaka,
  SPIN_CSS, RED, SLATE, BORDER, MUTED, BG, rowV,
} from './lms-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LmsAnnouncement {
  id: number;
  title: string;
  body: string;
  subject: string;
  product: string;
  batch: string | null;
  pinned: boolean;
  createdBy: number;
  createdAt: number;
}

interface Props {
  initialAnnouncements: LmsAnnouncement[];
}

const SUBJECTS = ['english', 'math', 'analytical'];

// ─── Announcement form modal ──────────────────────────────────────────────────

interface AnnForm {
  title: string; body: string; subject: string; product: string;
  batch: string; pinned: boolean;
}

const defaultForm: AnnForm = {
  title: '', body: '', subject: 'english', product: 'iba',
  batch: '', pinned: false,
};

function AnnouncementModal({
  open, editing, onClose, onSaved,
}: {
  open: boolean; editing: LmsAnnouncement | null;
  onClose: () => void; onSaved: (a: LmsAnnouncement) => void;
}) {
  const [form, setForm] = useState<AnnForm>(() => editing ? {
    title: editing.title,
    body: editing.body,
    subject: editing.subject,
    product: editing.product,
    batch: editing.batch ?? '',
    pinned: editing.pinned,
  } : defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const f = (k: keyof AnnForm, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        subject: form.subject,
        product: form.product,
        batch: form.batch.trim() || null,
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
          <FieldLabel>Batch (blank = all)</FieldLabel>
          <FieldInput value={form.batch} onChange={e => f('batch', e.target.value)} placeholder="e.g. 2025" />
        </div>
        <Toggle checked={form.pinned} onChange={v => f('pinned', v)} label="Pin to top of feed" />
        {error && <p style={{ fontSize: 12, color: RED, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={onClose} small>Cancel</GhostBtn>
          <PrimaryBtn onClick={handleSave} loading={saving} small>
            {editing ? 'Save Changes' : 'Post Announcement'}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnnouncementsFeedClient({ initialAnnouncements }: Props) {
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
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 7, background: BG,
                border: `1px solid ${BORDER}`, color: '#6B7280',
                fontSize: 12, fontWeight: 500, textDecoration: 'none',
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
                background: '#FFFFFF',
                border: `1px solid ${a.pinned ? 'rgba(214,43,56,0.25)' : BORDER}`,
                borderRadius: 10, padding: '14px 16px',
                borderLeft: a.pinned ? `3px solid ${RED}` : `1px solid ${BORDER}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    {a.pinned && (
                      <Pin size={12} style={{ color: RED, flexShrink: 0 }} aria-hidden />
                    )}
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE }}>{a.title}</p>
                    <SubjectBadge subject={a.subject} />
                    {a.batch && (
                      <span style={{ fontSize: 11, color: MUTED, background: BG, border: `1px solid ${BORDER}`, padding: '2px 7px', borderRadius: 100 }}>
                        Batch {a.batch}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: MUTED, background: BG, border: `1px solid ${BORDER}`, padding: '2px 7px', borderRadius: 100 }}>
                      {a.product.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6B7280', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                    {a.body}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                    Posted {fmtDhaka(a.createdAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <motion.button
                    onClick={() => void handleTogglePin(a)}
                    whileTap={{ scale: 0.92 }}
                    title={a.pinned ? 'Unpin' : 'Pin to top'}
                    aria-label={a.pinned ? 'Unpin' : 'Pin to top'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: 6,
                      border: `1px solid ${a.pinned ? 'rgba(214,43,56,0.3)' : BORDER}`,
                      background: a.pinned ? 'rgba(214,43,56,0.06)' : '#FFFFFF',
                      color: a.pinned ? RED : '#6B7280', cursor: 'pointer',
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
