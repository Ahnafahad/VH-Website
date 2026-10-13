'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SPIN_CSS, Toast, useConfirm, FieldSelect, GhostBtn, DangerBtn, Toggle, MUTED, T_SM, fmtDhaka,
} from '../../lms/lms-shared';
import {
  SuperHeader, SuperCard, SuperBadge, SuperTable, StatTile, StatGrid, TypedConfirm, superApi, tdStyle,
} from '../super-ui';

interface StaffRow {
  id: number; email: string; name: string; role: string; status: string;
  readOnly: boolean; isTeaching: boolean; lastSignIn: number | null; batches: string[];
}
interface WorkloadRow {
  instructorId: number; classes: number; recordings: number; materials: number;
  essaysGraded: number; essaysAssignedPending: number;
}
interface Data { staff: StaffRow[]; workload: { rows: WorkloadRow[]; unassignedEssayBacklog: number } }

const ROOT_EMAIL = 'ahnaf816@gmail.com'; // display-only; the server enforces the real guard
const ROLES = ['student', 'instructor', 'admin', 'super_admin'];

export default function StaffClient() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [removing, setRemoving] = useState<StaffRow | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    try { setData(await superApi<Data>('/api/admin/super/people/staff')); setError(''); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(u: StaffRow, body: Record<string, unknown>, done: string) {
    setBusy(u.id);
    try {
      await superApi(`/api/admin/super/people/staff/${u.id}`, { method: 'POST', body });
      setToast(done);
      await load();
    } catch (e) { setToast((e as Error).message); }
    finally { setBusy(null); }
  }

  async function changeRole(u: StaffRow, role: string) {
    if (role === u.role) return;
    const ok = await confirm({ title: 'Change role', message: `Change ${u.name} from ${u.role} to ${role}? They are signed out and must sign in again.`, confirmLabel: 'Change role', destructive: role === 'student' });
    if (ok) await act(u, { action: 'role', role }, 'Role updated');
  }

  async function toggleSuspend(u: StaffRow) {
    const suspend = u.status === 'active';
    const ok = await confirm({ title: suspend ? 'Suspend account' : 'Reactivate account', message: `${suspend ? 'Suspend' : 'Reactivate'} ${u.name}?`, confirmLabel: suspend ? 'Suspend' : 'Reactivate', destructive: suspend });
    if (ok) await act(u, { action: suspend ? 'suspend' : 'unsuspend' }, suspend ? 'Suspended' : 'Reactivated');
  }

  async function viewAs(u: StaffRow) {
    try {
      await superApi('/api/admin/super/impersonate', { method: 'POST', body: { userId: u.id } });
      window.location.href = u.role === 'student' ? '/dashboard' : '/admin';
    } catch (e) { setToast((e as Error).message); }
  }

  const instructors = data?.staff.filter(s => s.role === 'instructor' || s.isTeaching) ?? [];
  const wl = new Map((data?.workload.rows ?? []).map(r => [r.instructorId, r]));

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Staff" subtitle="Admins, instructors and super admins. Every change is audited." />
      {error && <p role="alert" style={{ color: MUTED }}>{error}</p>}
      {!data && !error && <p style={{ color: MUTED }}>Loading...</p>}

      {data && (
        <>
          <SuperCard title={`Staff (${data.staff.length})`}>
            <SuperTable head={['Person', 'Role', 'Status', 'Read-only', 'Teaching', 'Last sign-in', 'Batches', 'Actions']}>
              {data.staff.map(u => {
                const root = u.email.toLowerCase() === ROOT_EMAIL;
                const off = root || busy === u.id;
                return (
                  <tr key={u.id}>
                    <td style={tdStyle}>
                      <strong>{u.name}</strong> {root && <SuperBadge tone="gold">root</SuperBadge>}
                      <div style={{ color: MUTED, fontSize: T_SM }}>{u.email}</div>
                    </td>
                    <td style={{ ...tdStyle, minWidth: 140 }}>
                      <FieldSelect value={u.role} disabled={off} aria-label={`Role for ${u.name}`} onChange={e => void changeRole(u, e.target.value)}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </FieldSelect>
                    </td>
                    <td style={tdStyle}><SuperBadge tone={u.status === 'active' ? 'ok' : 'bad'}>{u.status}</SuperBadge></td>
                    <td style={tdStyle}>
                      <Toggle checked={u.readOnly} label="" ariaLabel={`Read-only for ${u.name}`}
                        onChange={v => { if (!off) void act(u, { action: 'readonly', value: v }, v ? 'Set read-only' : 'Read-only cleared'); }} />
                    </td>
                    <td style={tdStyle}>
                      <Toggle checked={u.isTeaching} label="" ariaLabel={`Teaching flag for ${u.name}`}
                        onChange={v => { if (!root && busy !== u.id) void act(u, { action: 'teaching', value: v }, 'Teaching flag updated'); }} />
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{u.lastSignIn ? fmtDhaka(u.lastSignIn) : 'n/a'}</td>
                    <td style={tdStyle}>{u.batches.join(', ') || 'n/a'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <GhostBtn small disabled={off} onClick={() => void toggleSuspend(u)}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</GhostBtn>
                        <DangerBtn small disabled={off} onClick={() => setRemoving(u)}>Remove</DangerBtn>
                        {!root && <GhostBtn small onClick={() => void viewAs(u)}>View as</GhostBtn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </SuperTable>
          </SuperCard>

          <SuperCard title="Instructor activity, last 30 days">
            <StatGrid>
              <StatTile label="Unassigned essay backlog" value={data.workload.unassignedEssayBacklog} tone={data.workload.unassignedEssayBacklog > 0 ? 'warn' : 'ok'} hint="submitted, no grader assigned" />
            </StatGrid>
            <SuperTable head={['Instructor', 'Classes taught', 'Recordings', 'Materials', 'Essays graded', 'Grading backlog']}>
              {instructors.map(u => {
                const w = wl.get(u.id);
                return (
                  <tr key={u.id}>
                    <td style={tdStyle}>{u.name}</td>
                    <td style={tdStyle}>{w?.classes ?? 0}</td>
                    <td style={tdStyle}>{w?.recordings ?? 0}</td>
                    <td style={tdStyle}>{w?.materials ?? 0}</td>
                    <td style={tdStyle}>{w?.essaysGraded ?? 0}</td>
                    <td style={tdStyle}>{w?.essaysAssignedPending ?? 0}</td>
                  </tr>
                );
              })}
            </SuperTable>
          </SuperCard>
        </>
      )}

      <TypedConfirm
        open={!!removing} title="Remove from staff"
        message={`${removing?.name ?? ''} becomes a plain student: role reset, teaching and read-only flags cleared, signed out. The account itself is kept.`}
        phrase="REMOVE" confirmLabel="Remove" loading={busy !== null}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => { const u = removing!; await act(u, { action: 'remove' }, 'Removed from staff'); setRemoving(null); }}
      />
      {confirmDialog}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
