'use client';

/** After class: offline homework check-off, class note, mark completed, reschedule / cancel. */

import React, { useState } from 'react';
import { CheckCircle, CalendarClock, Ban, KeyRound } from 'lucide-react';
import {
  RED, MUTED, SLATE, BORDER, SURFACE, OK_BG, R_MD, T_XS, T_SM, T_BASE,
  FieldInput, FieldLabel, FieldTextarea, ConfirmDialog, dhakaLocalToISO, epochToDhakaLocal,
} from '../lms-shared';
import { Btn, apiJson, mutedText } from './cockpit-ui';
import type { SessionPatch, TodaySession } from './types';

export default function WrapUpSection({
  session, onPatch, notify, onRequestComplete, completing,
}: {
  session: TodaySession;
  onPatch: (patch: SessionPatch) => void;
  notify: (m: string) => void;
  /** Opens the cockpit-level "mark completed" confirmation (shared with the phone bottom bar). */
  onRequestComplete: () => void;
  completing: boolean;
}) {
  const [note, setNote] = useState(session.description ?? '');
  const [savedNote, setSavedNote] = useState(session.description ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [working, setWorking] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [newStart, setNewStart] = useState(epochToDhakaLocal(session.scheduledAt));

  const isDone = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';

  const saveNote = async () => {
    setSavingNote(true);
    try {
      await apiJson(`/api/lms/admin/classes/${session.id}`, { method: 'PATCH', json: { description: note.trim() || null } });
      setSavedNote(note.trim());
      onPatch({ description: note.trim() || null });
      notify('Class note saved.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save the note.');
    } finally { setSavingNote(false); }
  };

  // Optimistic cancel with rollback.
  const cancelClass = async () => {
    const status = 'cancelled';
    const previous = session.status;
    setWorking(true);
    onPatch({ status });
    try {
      const r = await apiJson<{ recordingWarning?: string; calendarWarning?: string }>(
        `/api/lms/admin/classes/${session.id}`, { method: 'PATCH', json: { status } },
      );
      notify(r.recordingWarning ?? r.calendarWarning ?? 'Class cancelled.');
    } catch (e) {
      onPatch({ status: previous });
      notify(e instanceof Error ? e.message : 'Could not update the class.');
    } finally {
      setWorking(false);
      setConfirmCancel(false);
    }
  };

  const reschedule = async () => {
    if (!newStart) return;
    const iso = dhakaLocalToISO(newStart);
    const previous = session.scheduledAt;
    setWorking(true);
    onPatch({ scheduledAt: new Date(iso).getTime() });
    try {
      const r = await apiJson<{ recordingWarning?: string; calendarWarning?: string }>(
        `/api/lms/admin/classes/${session.id}`, { method: 'PATCH', json: { scheduledAt: iso } },
      );
      notify(r.recordingWarning ?? r.calendarWarning ?? 'Class rescheduled.');
      setRescheduling(false);
    } catch (e) {
      onPatch({ scheduledAt: previous });
      notify(e instanceof Error ? e.message : 'Could not reschedule.');
    } finally { setWorking(false); }
  };

  const toggleOffline = async (submissionId: number, checked: boolean) => {
    const apply = (value: boolean) => onPatch(s => ({
      offlineShowcase: s.offlineShowcase.map(r => r.submissionId === submissionId ? { ...r, checked: value } : r),
    }));
    apply(checked);
    try {
      await apiJson(`/api/lms/admin/submissions/${submissionId}/check`, { method: 'PATCH', json: { checked } });
    } catch {
      apply(!checked);
      notify("Couldn't save that tick, it has been undone. Try again.");
    }
  };

  const offline = [...session.offlineShowcase].sort((a, b) => Number(a.checked) - Number(b.checked));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      {/* Offline homework */}
      <div>
        <p style={{ ...mutedText, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: T_XS, marginBottom: 6 }}>
          <KeyRound size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} aria-hidden />
          Offline homework ({offline.filter(r => r.checked).length} of {offline.length} checked)
        </p>
        {offline.length === 0 ? (
          <p style={mutedText}>No student has chosen to show homework in class.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {offline.map(r => (
              <li key={r.submissionId}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '6px 12px', borderRadius: R_MD, border: `1px solid ${BORDER}`, background: r.checked ? OK_BG : SURFACE, cursor: 'pointer' }}>
                  <input type="checkbox" checked={r.checked} onChange={() => void toggleOffline(r.submissionId, !r.checked)} style={{ width: 18, height: 18, flexShrink: 0, accentColor: RED }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: T_BASE, fontWeight: 600, color: SLATE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.userName}</span>
                    <span style={{ display: 'block', fontSize: T_XS, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.assignmentTitle}</span>
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: T_XS, fontWeight: 700, textTransform: 'uppercase', color: SLATE }}>{r.checked ? 'Checked' : 'To check'}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Class note */}
      <div>
        <FieldLabel htmlFor="tdy-note">Class note</FieldLabel>
        <FieldTextarea id="tdy-note" value={note} onChange={e => setNote(e.target.value)} placeholder="What was covered, who struggled…" style={{ minHeight: 80 }} />
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn variant="primary" onClick={() => void saveNote()} loading={savingNote} disabled={note.trim() === savedNote}>Save note</Btn>
          {note.trim() !== savedNote && <span style={{ ...mutedText, fontSize: T_XS }}>Unsaved changes</span>}
        </div>
      </div>

      {/* Complete / reschedule / cancel */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!isDone && !isCancelled && (
          <Btn variant="primary" onClick={onRequestComplete} loading={completing}><CheckCircle size={13} aria-hidden />Mark completed</Btn>
        )}
        {isDone && <span style={{ fontSize: T_SM, fontWeight: 700, color: SLATE }}>Completed. Students can see this class in their history.</span>}
        {!isDone && !isCancelled && (
          <>
            <Btn onClick={() => setRescheduling(r => !r)}><CalendarClock size={13} aria-hidden />Reschedule</Btn>
            <Btn variant="danger" onClick={() => setConfirmCancel(true)}><Ban size={13} aria-hidden />Cancel class</Btn>
          </>
        )}
        {isCancelled && <span style={{ fontSize: T_SM, fontWeight: 700, color: RED }}>This class is cancelled.</span>}
      </div>
      {rescheduling && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <FieldLabel htmlFor="tdy-resched">New start (Dhaka time)</FieldLabel>
            <FieldInput id="tdy-resched" type="datetime-local" value={newStart} onChange={e => setNewStart(e.target.value)} />
          </div>
          <Btn variant="primary" onClick={() => void reschedule()} loading={working}>Save new time</Btn>
          <Btn onClick={() => setRescheduling(false)}>Cancel</Btn>
        </div>
      )}
      <p style={{ ...mutedText, fontSize: T_XS }}>Rescheduling also moves the calendar event and the recording bot when they exist.</p>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this class?"
        message="Students will no longer see it, and the calendar event and recording bot are cancelled."
        confirmLabel="Cancel class"
        destructive
        onConfirm={() => void cancelClass()}
        onCancel={() => setConfirmCancel(false)}
        loading={working}
      />
    </div>
  );
}
