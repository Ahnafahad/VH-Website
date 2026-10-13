'use client';

import { useState } from 'react';
import { FieldInput, FieldLabel, GhostBtn, PrimaryBtn, MUTED, T_SM } from '../../lms/lms-shared';
import { SuperCard, SuperTable, TypedConfirm, tdStyle, superApi } from '../super-ui';
import StudentPicker, { type PickedUser } from './StudentPicker';

interface Preview { rows: { table: string; total: number; conflicts: number; moved: number }[]; registrations: number; totalMoved: number; totalConflicts: number }
const API = '/api/admin/super/people/students';

export default function AccountTab({ notify }: { notify: (m: string) => void }) {
  const [subject, setSubject] = useState<PickedUser | null>(null);
  const [email, setEmail] = useState('');
  const [sid, setSid] = useState('');
  const [source, setSource] = useState<PickedUser | null>(null);
  const [target, setTarget] = useState<PickedUser | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function call(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try { await superApi(`${API}/account`, { method: 'POST', body }); notify(done); }
    catch (e) { notify((e as Error).message); }
    finally { setBusy(false); }
  }

  async function viewAs() {
    if (!subject) return;
    try {
      await superApi('/api/admin/super/impersonate', { method: 'POST', body: { userId: subject.id } });
      window.location.href = '/dashboard';
    } catch (e) { notify((e as Error).message); }
  }

  async function runMerge(mode: 'preview' | 'apply') {
    if (!source || !target) return;
    setBusy(true);
    try {
      const r = await superApi<{ preview: Preview }>(`${API}/merge`, { method: 'POST', body: { sourceId: source.id, targetId: target.id, mode, confirm: mode === 'apply' ? 'MERGE' : undefined } });
      setPreview(r.preview);
      if (mode === 'apply') { notify('Accounts merged'); setConfirming(false); setPreview(null); setSource(null); }
    } catch (e) { notify((e as Error).message); setConfirming(false); }
    finally { setBusy(false); }
  }

  return (
    <>
      <SuperCard title="Fix one account">
        <StudentPicker value={subject} onPick={u => { setSubject(u); setEmail(u?.email ?? ''); setSid(u?.studentId ?? ''); }} />
        {subject && (
          <div style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
            <GhostBtn onClick={() => void viewAs()}>View as this student</GhostBtn>
            <div>
              <FieldLabel htmlFor="acct-email">Email</FieldLabel>
              <FieldInput id="acct-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <p style={{ color: MUTED, fontSize: T_SM }}>They are signed out and must sign in with the new address.</p>
              <PrimaryBtn small disabled={busy || email.trim().toLowerCase() === subject.email.toLowerCase()} onClick={() => void call({ action: 'email', userId: subject.id, email }, 'Email updated')}>Change email</PrimaryBtn>
            </div>
            <div>
              <FieldLabel htmlFor="acct-sid">Student ID</FieldLabel>
              <FieldInput id="acct-sid" inputMode="numeric" value={sid} onChange={e => setSid(e.target.value)} placeholder="5 or 6 digits" />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <PrimaryBtn small disabled={busy || !sid.trim()} onClick={() => void call({ action: 'studentId', userId: subject.id, mode: 'set', value: sid }, 'Student ID set')}>Set</PrimaryBtn>
                <GhostBtn small disabled={busy} onClick={() => void call({ action: 'studentId', userId: subject.id, mode: 'generate' }, 'Student ID generated')}>Generate</GhostBtn>
                <GhostBtn small disabled={busy} onClick={() => void call({ action: 'studentId', userId: subject.id, mode: 'clear' }, 'Student ID cleared')}>Clear</GhostBtn>
              </div>
            </div>
          </div>
        )}
      </SuperCard>

      <SuperCard title="Merge duplicate accounts" tone="danger">
        <p style={{ color: MUTED, fontSize: T_SM, marginTop: 0 }}>
          Moves attempts, progress, access and registrations from the duplicate onto the real account in one transaction, then deactivates the duplicate.
          Rows that would collide with the real account stay on the duplicate. Student accounts only.
        </p>
        <StudentPicker label="Duplicate (will be deactivated)" value={source} onPick={u => { setSource(u); setPreview(null); }} />
        <StudentPicker label="Real account (keeps everything)" value={target} onPick={u => { setTarget(u); setPreview(null); }} />
        <PrimaryBtn small disabled={busy || !source || !target} onClick={() => void runMerge('preview')}>Preview (dry run)</PrimaryBtn>
        {preview && (
          <div style={{ marginTop: 14 }}>
            <SuperTable head={['Table', 'On duplicate', 'Will move', 'Collisions (stay)']}>
              {preview.rows.map(r => (
                <tr key={r.table}><td style={tdStyle}>{r.table}</td><td style={tdStyle}>{r.total}</td><td style={tdStyle}>{r.moved}</td><td style={tdStyle}>{r.conflicts}</td></tr>
              ))}
              <tr><td style={tdStyle}>registrations (by email)</td><td style={tdStyle}>{preview.registrations}</td><td style={tdStyle}>{preview.registrations}</td><td style={tdStyle}>0</td></tr>
            </SuperTable>
            <p style={{ fontSize: T_SM }}>{preview.totalMoved} rows will move, {preview.totalConflicts} stay behind.</p>
            <PrimaryBtn disabled={busy} onClick={() => setConfirming(true)}>Merge...</PrimaryBtn>
          </div>
        )}
      </SuperCard>

      <TypedConfirm open={confirming} title="Merge accounts"
        message={`Merge ${source?.email ?? ''} into ${target?.email ?? ''}. The duplicate is deactivated and signed out. This cannot be undone from here.`}
        phrase="MERGE" confirmLabel="Merge" loading={busy} onCancel={() => setConfirming(false)} onConfirm={() => void runMerge('apply')} />
    </>
  );
}
