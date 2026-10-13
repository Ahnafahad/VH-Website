'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { SPIN_CSS, FieldInput, FieldSelect, FieldLabel, GhostBtn, DangerBtn, PrimaryBtn, Toast, fmtDhaka, useConfirm } from '../../lms/lms-shared';
import { MUTED, T_XS, T_SM } from '../../lms/tokens';
import { SuperHeader, SuperCard, StatGrid, StatTile, SuperTable, SuperBadge, TypedConfirm, tdStyle, superApi } from '../super-ui';

interface Ev { id: number; type: string; email: string | null; userId: number | null; ip: string | null; userAgent: string | null; createdAt: number }
interface Anomaly { email: string; kind: string; detail: string }
interface Overview { events: Ev[]; anomalies: Anomaly[]; superAdminCount: number; superAdmins: { id: number; name: string; email: string }[]; rootEmail: string }
interface FoundUser { id: number; name: string; email: string; role: string; status: string }

const TYPES = ['signin', 'signin_denied', 'signout', 'force_signout', 'impersonate_start', 'impersonate_end'];
const tone = (t: string) => (t === 'signin' ? 'ok' : t === 'signin_denied' ? 'bad' : t.startsWith('impersonate') || t === 'force_signout' ? 'warn' : 'neutral') as 'ok' | 'bad' | 'warn' | 'neutral';

export default function SecurityClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [type, setType] = useState('');
  const [who, setWho] = useState('');
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<FoundUser[]>([]);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (who.trim()) p.set('user', who.trim());
    try { setData(await superApi<Overview>(`/api/admin/super/security/events?${p}`)); } catch (e) { setToast((e as Error).message); }
  }, [type, who]);
  useEffect(() => { void load(); }, [load]);

  async function find() {
    if (!search.trim()) return;
    try {
      const d = await superApi<{ users: FoundUser[] }>(`/api/admin/users?search=${encodeURIComponent(search.trim())}&limit=8`);
      setFound(d.users);
    } catch (e) { setToast((e as Error).message); }
  }

  async function forceOut(u: FoundUser) {
    if (!(await confirm({ title: 'Force sign-out', message: `Sign ${u.name} out of every device?`, confirmLabel: 'Sign out', destructive: true }))) return;
    try { await superApi('/api/admin/super/security/force-signout', { method: 'POST', body: { userId: u.id } }); setToast(`${u.name} signed out`); void load(); }
    catch (e) { setToast((e as Error).message); }
  }

  async function viewAs(u: FoundUser) {
    try {
      await superApi('/api/admin/super/impersonate', { method: 'POST', body: { userId: u.id } });
      window.location.href = u.role === 'student' ? '/dashboard' : '/admin';
    } catch (e) { setToast((e as Error).message); }
  }

  async function signOutAll() {
    setBusy(true);
    try {
      const d = await superApi<{ affected: number }>('/api/admin/super/security/force-signout', { method: 'POST', body: { everyoneExceptMe: true, confirm: 'SIGN OUT EVERYONE' } });
      setToast(`${d.affected} users signed out`); setConfirmAll(false); void load();
    } catch (e) { setToast((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Security" subtitle="Sign-ins, forced sign-outs, view-as, and the root-account lock." />

      <StatGrid>
        <StatTile label="Active super admins" value={data?.superAdminCount ?? '—'} tone={data ? (data.superAdminCount < 2 ? 'warn' : 'ok') : undefined} />
        <StatTile label="Anomalies (24h)" value={data?.anomalies.length ?? '—'} tone={data && data.anomalies.length ? 'warn' : 'ok'} />
      </StatGrid>

      <SuperCard title="Root account lock">
        <p style={{ margin: 0, fontSize: T_SM, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Lock size={14} aria-hidden style={{ marginTop: 2, flexShrink: 0 }} />
          <span><strong>{data?.rootEmail ?? 'The root account'}</strong> is protected: it cannot be demoted, suspended, made read-only, re-emailed, deleted, viewed-as, or force-signed-out by anyone else.</span>
        </p>
        {data && data.superAdminCount < 2 && (
          <p style={{ margin: '12px 0 0', fontSize: T_SM }}>
            <SuperBadge tone="warn">Recommendation</SuperBadge>{' '}
            Only one active super admin. Promote a trusted backup (Staff page) so you are not locked out if the root Google account is lost.
          </p>
        )}
        {data && data.superAdmins.length > 0 && <p style={{ margin: '10px 0 0', fontSize: T_XS, color: MUTED }}>Super admins: {data.superAdmins.map(a => a.email).join(', ')}</p>}
      </SuperCard>

      {data && data.anomalies.length > 0 && (
        <SuperCard title="Anomaly hints (last 24h)">
          {data.anomalies.map((a, i) => (
            <p key={i} style={{ margin: '0 0 6px', fontSize: T_SM }}><SuperBadge tone="warn">{a.kind === 'many_ips' ? 'Many IPs' : 'Denied attempts'}</SuperBadge> {a.email} — {a.detail}</p>
          ))}
        </SuperCard>
      )}

      <SuperCard title="Find a user">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 220px' }}><FieldInput value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && void find()} placeholder="Name or email" aria-label="Find user" /></div>
          <PrimaryBtn onClick={() => void find()}>Search</PrimaryBtn>
        </div>
        {found.length > 0 && (
          <SuperTable head={['User', 'Role', 'Actions']}>
            {found.map(u => (
              <tr key={u.id}>
                <td style={tdStyle}>{u.name}<br /><span style={{ color: MUTED, fontSize: T_XS }}>{u.email}</span></td>
                <td style={tdStyle}>{u.role}</td>
                <td style={{ ...tdStyle, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <GhostBtn onClick={() => void forceOut(u)}>Force sign-out</GhostBtn>
                  {u.role !== 'super_admin' && <GhostBtn onClick={() => void viewAs(u)}>View as</GhostBtn>}
                </td>
              </tr>
            ))}
          </SuperTable>
        )}
        <p style={{ margin: '12px 0 0', fontSize: T_XS, color: MUTED }}>
          Force sign-out rejects every session issued before now (takes effect within about a minute). &quot;View as&quot; is read-only, lasts 30 minutes and is logged.
        </p>
      </SuperCard>

      <SuperCard title="Sign out everyone else" tone="danger">
        <p style={{ margin: '0 0 12px', fontSize: T_SM }}>Ends every other user&apos;s session, including other admins. Your session and the root account are kept.</p>
        <DangerBtn onClick={() => setConfirmAll(true)}>Sign out everyone except me</DangerBtn>
      </SuperCard>

      <SuperCard title="Recent sign-in activity">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: '1 1 160px' }}>
            <FieldLabel>Type</FieldLabel>
            <FieldSelect value={type} onChange={e => setType(e.target.value)}>
              <option value="">All</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </FieldSelect>
          </div>
          <div style={{ flex: '2 1 220px' }}><FieldLabel>User email contains</FieldLabel><FieldInput value={who} onChange={e => setWho(e.target.value)} /></div>
        </div>
        <SuperTable head={['Time', 'Type', 'User', 'IP', 'Device']}>
          {(data?.events ?? []).map(e => (
            <tr key={e.id}>
              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDhaka(e.createdAt)}</td>
              <td style={tdStyle}><SuperBadge tone={tone(e.type)}>{e.type}</SuperBadge></td>
              <td style={tdStyle}>{e.email ?? '—'}</td>
              <td style={tdStyle}>{e.ip ?? '—'}</td>
              <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MUTED }}>{e.userAgent ?? '—'}</td>
            </tr>
          ))}
        </SuperTable>
        {data && data.events.length === 0 && <p style={{ margin: '12px 0 0', fontSize: T_SM, color: MUTED }}>No events yet. Sign-ins are recorded from now on.</p>}
      </SuperCard>

      <TypedConfirm open={confirmAll} title="Sign out everyone?" message="Every other user will be signed out of all devices and must sign in again." phrase="SIGN OUT EVERYONE" confirmLabel="Sign everyone out" loading={busy} onConfirm={() => void signOutAll()} onCancel={() => setConfirmAll(false)} />
      {confirmDialog}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
