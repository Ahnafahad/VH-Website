'use client';

/** Homework posted for this class, plus an inline form to post a new one. */

import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import {
  RED, MUTED, SLATE, BORDER, SURFACE, R_MD, T_XS, T_SM, T_BASE,
  FieldInput, FieldLabel, FieldSelect, FieldTextarea, dhakaLocalToISO, fmtDhaka,
} from '../lms-shared';
import { Btn, apiJson, mutedText } from './cockpit-ui';

export interface HomeworkItem { id: number; title: string; dueAt: number }

export interface HomeworkBatch { id: number; name: string; product: string }

export default function HomeworkSection({
  session, homework, batches, onPosted, notify,
}: {
  session: { id: number; subject: string; product: string; batch: string | null };
  homework: HomeworkItem[];
  batches: HomeworkBatch[];
  onPosted: (h: HomeworkItem) => void;
  notify: (m: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [batch, setBatch] = useState(session.batch ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const post = async () => {
    if (!title.trim() || !description.trim() || !dueAt) { setError('Title, instructions and due date are required.'); return; }
    setError(''); setSaving(true);
    try {
      const created = await apiJson<{ id: number; title: string; dueAt: number }>('/api/lms/admin/assignments', {
        method: 'POST',
        json: {
          title: title.trim(),
          description: description.trim(),
          subject: session.subject,
          product: session.product,
          batch: batch || null,
          classSessionId: session.id,
          dueAt: dhakaLocalToISO(dueAt),
        },
      });
      onPosted({ id: created.id, title: created.title, dueAt: created.dueAt });
      notify('Homework posted.');
      setTitle(''); setDescription(''); setDueAt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post homework.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
      {homework.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${BORDER}`, borderRadius: R_MD, background: SURFACE }}>
          {homework.map((h, i) => (
            <li key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderTop: i === 0 ? 'none' : `1px solid ${BORDER}` }}>
              <BookOpen size={15} style={{ color: MUTED, flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: T_BASE, fontWeight: 600, color: SLATE, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{h.title}</span>
              <span style={{ fontSize: T_XS, color: MUTED, flexShrink: 0 }}>Due {fmtDhaka(h.dueAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </li>
          ))}
        </ul>
      )}
      {homework.length === 0 && <p style={mutedText}>No homework posted for this class yet.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <FieldLabel htmlFor="tdy-hw-title">Title</FieldLabel>
          <FieldInput id="tdy-hw-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. RC 6: questions 1 to 12" />
        </div>
        <div>
          <FieldLabel htmlFor="tdy-hw-desc">Instructions</FieldLabel>
          <FieldTextarea id="tdy-hw-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the task…" style={{ minHeight: 64 }} />
        </div>
        <div className="tdy-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <FieldLabel htmlFor="tdy-hw-due">Due (Dhaka time)</FieldLabel>
            <FieldInput id="tdy-hw-due" type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="tdy-hw-batch">Batch</FieldLabel>
            <FieldSelect id="tdy-hw-batch" value={batch} onChange={e => setBatch(e.target.value)}>
              <option value="">All batches</option>
              {batches.filter(b => b.product === session.product).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </FieldSelect>
          </div>
        </div>
        {error && <p role="alert" style={{ margin: 0, fontSize: T_SM, color: RED }}>{error}</p>}
        <div><Btn variant="primary" onClick={() => void post()} loading={saving}>Post homework</Btn></div>
      </div>
    </div>
  );
}
