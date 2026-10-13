'use client';

/** Inline roster: tap a student to cycle, mark all present, message absentees. */

import React, { useState } from 'react';
import { Loader2, Check, X, Minus, Wifi, Users, MessageSquare } from 'lucide-react';
import { RED, MUTED, SLATE, SURFACE, T_XS, T_SM, T_BASE, FieldInput, FieldLabel, FieldTextarea } from '../lms-shared';
import type { AttendanceState } from '@/lib/lms/today-cockpit';
import { Btn, apiJson, mutedText } from './cockpit-ui';
import type { useRoster } from './useRoster';

type Roster = ReturnType<typeof useRoster>;

export interface AttendanceSession {
  id: number;
  title: string;
  subject: string;
  product: string;
  batch: string | null;
}

const LABEL: Record<AttendanceState, string> = {
  none: 'Not marked', present: 'Present', online: 'Online', absent: 'Absent',
};

function StateMark({ state }: { state: AttendanceState }) {
  const p = { size: 14, 'aria-hidden': true } as const;
  if (state === 'present') return <Check {...p} />;
  if (state === 'online') return <Wifi {...p} />;
  if (state === 'absent') return <X {...p} />;
  return <Minus {...p} />;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

export default function AttendanceSection({
  session, roster, notify,
}: {
  session: AttendanceSession;
  roster: Roster;
  notify: (m: string) => void;
}) {
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (roster.loading) {
    return <div style={{ padding: '16px 0' }}><Loader2 size={18} style={{ color: MUTED, animation: 'spin 1s linear infinite' }} aria-label="Loading roster" /></div>;
  }
  if (roster.loadError) {
    return (
      <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 8 }}>
        <span style={{ fontSize: T_SM, color: RED }}>{roster.loadError}</span>
        <Btn onClick={roster.reload}>Retry</Btn>
      </div>
    );
  }
  if (!roster.students || roster.students.length === 0) {
    return <p style={{ ...mutedText, paddingTop: 8 }}>No students in scope for this class.</p>;
  }

  const c = roster.counts;
  const openCompose = () => {
    setMessage(`We missed you in "${session.title}" today. Please check the materials and homework, and reach out if you need help catching up.`);
    setComposing(true);
  };

  const send = async () => {
    const body = message.trim();
    if (!body) { notify('Write a message first.'); return; }
    setSending(true);
    try {
      await apiJson('/api/lms/admin/announcements-feed', {
        method: 'POST',
        json: {
          title: `Missed class: ${session.title}`.slice(0, 120),
          body,
          subject: session.subject,
          product: session.product,
          batch: session.batch,
          targetUserIds: roster.absentees.map(s => s.userId),
        },
      });
      notify(`Message sent to ${roster.absentees.length} student${roster.absentees.length === 1 ? '' : 's'}.`);
      setComposing(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
      <p style={mutedText} aria-live="polite">
        {c.present} present · {c.online} online · {c.absent} absent · {c.none} not marked
        {roster.unsaved > 0 ? ` · saving ${roster.unsaved}…` : ' · saved automatically'}
        <br />Not marked counts as present until marked absent.
      </p>

      <div className="tdy-roster">
        {roster.students.map(s => {
          const st = roster.marks[s.userId] ?? 'none';
          const save = roster.rowSave[s.userId];
          return (
            <div key={s.userId} style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="tdy-stu"
                data-s={st}
                onClick={() => roster.tap(s.userId)}
                aria-label={`${s.name}: ${LABEL[st]}. Tap to change.`}
              >
                <span
                  aria-hidden
                  style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: T_XS, fontWeight: 700, background: SURFACE, color: SLATE, border: `1px solid ${MUTED}` }}
                >
                  {initials(s.name)}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: T_BASE, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ display: 'block', fontSize: T_XS, color: MUTED }}>
                    {s.totalAbsences} absent · {s.onlineCount}/8 online
                    {s.onlineCapped && ' (cap)'}
                    {s.source === 'pulled' && ' · auto-pulled'}
                  </span>
                </span>
                {(save === 'pending' || save === 'saving') && <Loader2 size={13} style={{ color: MUTED, animation: 'spin 1s linear infinite' }} aria-label="Saving" />}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: T_XS, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: SLATE, flexShrink: 0 }}>
                  <StateMark state={st} />
                  {LABEL[st]}
                </span>
              </button>
              {save === 'error' && <Btn variant="danger" onClick={() => roster.retry(s.userId)} ariaLabel={`Retry saving ${s.name}`}>Failed. Retry</Btn>}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn variant="primary" onClick={() => void roster.markAllPresent()}><Users size={13} aria-hidden />Mark all present</Btn>
        <Btn onClick={openCompose} disabled={roster.absentees.length === 0}>
          <MessageSquare size={13} aria-hidden />Message absentees ({roster.absentees.length})
        </Btn>
      </div>

      {composing && (
        <div style={{ border: `1px solid ${MUTED}`, borderRadius: 8, padding: 12, background: SURFACE, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <FieldLabel htmlFor="tdy-absent-to">To</FieldLabel>
            <FieldInput id="tdy-absent-to" readOnly value={roster.absentees.map(s => s.name).join(', ')} />
          </div>
          <div>
            <FieldLabel htmlFor="tdy-absent-msg">Message</FieldLabel>
            <FieldTextarea id="tdy-absent-msg" value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} />
          </div>
          <p style={mutedText}>Sent as a private announcement to the students above (push when they have it on).</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="primary" onClick={() => void send()} loading={sending}>Send to {roster.absentees.length}</Btn>
            <Btn onClick={() => setComposing(false)}>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
