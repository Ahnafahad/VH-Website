'use client';
import React, { useState } from 'react';
import { SLATE, MUTED, OK, OK_BG, RED, T_SM, T_XS, SPIN_CSS, TabBar, Toast, GhostBtn, PrimaryBtn, FieldTextarea, fmtDhaka } from '../../lms/lms-shared';
import { SuperHeader, SuperCard, SuperBadge, SuperTable, TypedConfirm, tdStyle, superApi } from '../super-ui';
import type { DeployRow } from '@/lib/super/ops/vercel';
import CronsTab from './CronsTab';
import StorageTab from './StorageTab';
import { useOpsData } from './use-ops-data';

const TABS = [
  { id: 'deploys', label: 'Deploys' }, { id: 'storage', label: 'Storage & cost' }, { id: 'crons', label: 'Crons' },
  { id: 'backups', label: 'Backups' }, { id: 'secrets', label: 'Secrets' },
];

export default function OpsScreen() {
  const [tab, setTab] = useState('deploys');
  const [msg, setMsg] = useState<string | null>(null);
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };
  return (
    <div style={{ maxWidth: 1000 }}>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Operations" subtitle="Deploys, storage, crons, backups and secrets" />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'deploys' && <DeploysTab toast={toast} />}
      {tab === 'storage' && <StorageTab toast={toast} />}
      {tab === 'crons' && <CronsTab toast={toast} />}
      {tab === 'backups' && <BackupsTab toast={toast} />}
      {tab === 'secrets' && <SecretsTab toast={toast} />}
      <Toast message={msg} onDismiss={() => setMsg(null)} />
    </div>
  );
}

function DeploysTab({ toast }: { toast: (m: string) => void }) {
  const { data, error, reload } = useOpsData<{ configured: boolean; deployments: DeployRow[] }>('/api/admin/super/ops/deploys');
  const [target, setTarget] = useState<DeployRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function promote() {
    if (!target) return;
    setBusy(true);
    try {
      await superApi('/api/admin/super/ops/deploys', { method: 'POST', body: { deploymentId: target.id } });
      toast('Promoted to production'); setTarget(null); await reload();
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  }

  if (error) return <SuperCard><p style={{ color: MUTED }}>{error}</p></SuperCard>;
  if (!data) return <p style={{ color: MUTED }}>Loading…</p>;
  if (!data.configured) return <SuperCard title="Deploys"><p style={{ margin: 0, color: MUTED }}>Not configured: set VERCEL_TOKEN, VERCEL_PROJECT_ID (and VERCEL_TEAM_ID for team projects) in the Vercel environment.</p></SuperCard>;
  const currentProd = data.deployments.find(d => d.target === 'production' && d.state === 'READY')?.id;
  return (
    <SuperCard title="Latest deployments" action={<GhostBtn small onClick={reload}>Refresh</GhostBtn>}>
      <SuperTable head={['State', 'Commit', 'Created', 'URL', '']}>
        {data.deployments.map(d => (
          <tr key={d.id}>
            <td style={tdStyle}><SuperBadge tone={d.state === 'READY' ? 'ok' : d.state === 'ERROR' ? 'bad' : 'warn'}>{d.state}</SuperBadge>{d.target && <div style={{ fontSize: T_XS, color: MUTED }}>{d.target}</div>}</td>
            <td style={tdStyle}>{d.message?.split('\n')[0].slice(0, 80) ?? '—'}<div style={{ fontSize: T_XS, color: MUTED }}>{d.sha}</div></td>
            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDhaka(d.createdAt)}</td>
            <td style={tdStyle}><a href={`https://${d.url}`} target="_blank" rel="noreferrer" style={{ color: SLATE }}>{d.url}</a></td>
            <td style={tdStyle}>
              {d.target === 'production' && d.state === 'READY' && (d.id === currentProd
                ? <span style={{ fontSize: T_XS, color: MUTED }}>current</span>
                : <GhostBtn small onClick={() => setTarget(d)}>Promote</GhostBtn>)}
            </td>
          </tr>
        ))}
      </SuperTable>
      <TypedConfirm
        open={!!target} title="Promote this deployment to production?" phrase="PROMOTE" confirmLabel="Promote" loading={busy}
        message={`Production will serve ${target?.sha ?? 'this deployment'} (${target?.message?.split('\n')[0].slice(0, 60) ?? ''}). Rolling back to an older build does not undo database changes.`}
        onConfirm={promote} onCancel={() => setTarget(null)}
      />
    </SuperCard>
  );
}

type Snapshot = { note: string; at: string; by: string };
function BackupsTab({ toast }: { toast: (m: string) => void }) {
  const { data, error, reload } = useOpsData<{ lastSnapshot: Snapshot | null; platformConfigured: boolean; dbName: string | null }>('/api/admin/super/ops/backups');
  const [note, setNote] = useState('');
  async function record() {
    try {
      await superApi('/api/admin/super/ops/backups', { method: 'POST', body: { note } });
      setNote(''); toast('Snapshot note recorded'); await reload();
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed'); }
  }
  if (error) return <SuperCard><p style={{ color: MUTED }}>{error}</p></SuperCard>;
  const db = data?.dbName ?? '<db-name>';
  const code = { fontFamily: 'monospace', fontSize: T_SM, background: 'transparent', wordBreak: 'break-all' as const };
  return (
    <>
      <SuperCard title="Point-in-time recovery (Turso)">
        <p style={{ margin: '0 0 8px', fontSize: T_SM }}>
          Turso keeps point-in-time history for your database; the retention window depends on your Turso plan (check the Turso dashboard).
          {data?.platformConfigured ? ' The platform API is configured, but it does not expose a last-restore-point value, so none is shown.' : ' Set TURSO_PLATFORM_TOKEN, TURSO_ORG, TURSO_DB_NAME to enable DB size on the Storage tab.'}
        </p>
        <p style={{ margin: '0 0 6px', fontSize: T_SM, fontWeight: 600 }}>A restore creates a NEW database. It never overwrites production.</p>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: T_SM, lineHeight: 1.7 }}>
          <li>Create the restored copy: <code style={code}>turso db create {db}-restored --from-db {db} --timestamp 2026-01-31T10:30:00Z</code> (UTC, within the window)</li>
          <li>Inspect it: <code style={code}>turso db shell {db}-restored</code></li>
          <li>Copy the needed rows back, or point TURSO_DATABASE_URL / TURSO_AUTH_TOKEN at the new database in Vercel and redeploy (new token: <code style={code}>turso db tokens create {db}-restored</code>).</li>
        </ol>
      </SuperCard>
      <SuperCard title="Last manual snapshot">
        <p style={{ margin: '0 0 10px', fontSize: T_SM }}>
          {data?.lastSnapshot ? <>{data.lastSnapshot.note} <span style={{ color: MUTED }}>({fmtDhaka(Date.parse(data.lastSnapshot.at))}, {data.lastSnapshot.by})</span></> : <span style={{ color: MUTED }}>None recorded.</span>}
        </p>
        <FieldTextarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Exported full DB dump to Drive before role migration" aria-label="Snapshot note" />
        <div style={{ marginTop: 8 }}><PrimaryBtn small disabled={!note.trim()} onClick={record}>Record note</PrimaryBtn></div>
      </SuperCard>
    </>
  );
}

type Env = { name: string; required: boolean; note: string; set: boolean };
function SecretsTab({ toast }: { toast: (m: string) => void }) {
  const { data, error, reload } = useOpsData<{ env: Env[]; tursoTokenRotatedAt: string | null }>('/api/admin/super/ops/secrets');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function ack() {
    setBusy(true);
    try { await superApi('/api/admin/super/ops/secrets', { method: 'POST' }); toast('Acknowledgement recorded'); setConfirm(false); await reload(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  }
  if (error) return <SuperCard><p style={{ color: MUTED }}>{error}</p></SuperCard>;
  if (!data) return <p style={{ color: MUTED }}>Loading…</p>;
  const rotated = data.tursoTokenRotatedAt;
  return (
    <>
      <div role="alert" style={{ padding: 16, borderRadius: 12, marginBottom: 16, border: `1px solid ${rotated ? OK : RED}`, background: rotated ? OK_BG : RED + '14', color: rotated ? OK : RED }}>
        {rotated ? (
          <p style={{ margin: 0, fontSize: T_SM }}>
            <strong>Turso token rotation acknowledged on {fmtDhaka(Date.parse(rotated))}.</strong> This is a manual acknowledgement only; the app cannot verify the old token was actually invalidated. Confirm with <code>turso db tokens invalidate</code> and the Vercel env value.
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 8px', fontSize: T_SM }}>
              <strong>The production Turso token is in public git history and must be rotated.</strong> Run <code>turso db tokens invalidate &lt;db&gt;</code>, create a new token, then update TURSO_AUTH_TOKEN in Vercel and redeploy.
            </p>
            <GhostBtn small onClick={() => setConfirm(true)}>I rotated it</GhostBtn>
          </>
        )}
      </div>
      <SuperCard title="Environment variables">
        <p style={{ margin: '0 0 10px', fontSize: T_SM, color: MUTED }}>Set / unset only. Values are never shown.</p>
        <SuperTable head={['Name', 'Use', 'Status']}>
          {data.env.map(v => (
            <tr key={v.name}>
              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{v.name}</td>
              <td style={tdStyle}>{v.note}{!v.required && <span style={{ color: MUTED }}> (optional)</span>}</td>
              <td style={tdStyle}><SuperBadge tone={v.set ? 'ok' : v.required ? 'bad' : 'neutral'}>{v.set ? 'set' : 'unset'}</SuperBadge></td>
            </tr>
          ))}
        </SuperTable>
      </SuperCard>
      <TypedConfirm open={confirm} title="Record Turso token rotation" phrase="ROTATED" confirmLabel="Record" loading={busy}
        message="This only stores a timestamp. It does not check that the old token was invalidated." onConfirm={ack} onCancel={() => setConfirm(false)} />
    </>
  );
}
