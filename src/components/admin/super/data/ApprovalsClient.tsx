'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { SPIN_CSS, FieldInput, FieldLabel, FieldSelect, GhostBtn, DangerBtn, Toast, fmtDhaka } from '../../lms/lms-shared';
import { MUTED, T_SM, T_XS } from '../../lms/tokens';
import { SuperHeader, SuperCard, SuperTable, SuperBadge, TypedConfirm, tdStyle, superApi } from '../super-ui';

interface Row {
  id: number; action: string; summary: string; status: string; requestedBy: number | null; requester: string | null;
  executeAfter: string; resolvedAt: string | null; result: string | null; createdAt: string;
}
interface Preview { summary: string; lines: string[]; phrase: string; refusal?: string }

const ACTIONS = [
  { id: 'table.wipe_reading_speed', label: 'Wipe reading-speed attempts' },
  { id: 'batch.archive', label: 'Archive a batch (students to inactive)' },
  { id: 'user.delete_full', label: 'Delete a user and all their data' },
  { id: 'analytics.purge', label: 'Purge old analytics events' },
];
const tone = (s: string) => (s === 'executed' ? 'ok' : s === 'failed' ? 'bad' : s === 'pending' || s === 'running' ? 'warn' : 'neutral') as 'ok' | 'bad' | 'warn' | 'neutral';

function Countdown({ to, now }: { to: number; now: number }) {
  const s = Math.max(0, Math.round((to - now) / 1000));
  return <>{s === 0 ? 'due now' : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`}</>;
}

export default function ApprovalsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [execId, setExecId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [action, setAction] = useState(ACTIONS[0].id);
  const [arg, setArg] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [proposing, setProposing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await superApi<{ rows: Row[]; me: number; serverNow: number }>('/api/admin/super/data/approvals');
      setRows(d.rows); setMe(d.me); setNow(Date.now());
    } catch (e) { setToast((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const r = setInterval(() => void load(), 30_000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [load]);

  const payload = (): unknown => {
    if (action === 'batch.archive') return { batch: arg.trim() };
    if (action === 'user.delete_full') return { userId: Number(arg) };
    if (action === 'analytics.purge') return { days: Number(arg) };
    return {};
  };
  const argLabel = action === 'batch.archive' ? 'Batch name (e.g. 2026-27)' : action === 'user.delete_full' ? 'User ID' : action === 'analytics.purge' ? 'Delete events older than (days, min 7)' : null;

  async function doPreview() {
    try {
      const d = await superApi<{ preview: Preview }>('/api/admin/super/data/approvals', { method: 'POST', body: { action, payload: payload(), dryRun: true } });
      setPreview(d.preview);
    } catch (e) { setToast((e as Error).message); setPreview(null); }
  }
  async function propose() {
    if (!preview) return;
    setProposing(true);
    try {
      await superApi('/api/admin/super/data/approvals', { method: 'POST', body: { action, payload: payload(), confirm: preview.phrase } });
      setToast('Proposed. It will run after the delay unless cancelled.');
      setPreview(null); setArg(''); setConfirmOpen(false); await load();
    } catch (e) { setToast((e as Error).message); }
    setProposing(false);
  }
  async function cancel(id: number) {
    try { await superApi(`/api/admin/super/data/approvals/${id}`, { method: 'POST', body: { op: 'cancel' } }); await load(); }
    catch (e) { setToast((e as Error).message); await load(); }
  }
  async function executeNow() {
    if (execId === null) return;
    setBusy(true);
    try { await superApi(`/api/admin/super/data/approvals/${execId}`, { method: 'POST', body: { op: 'execute', confirm: 'EXECUTE NOW' } }); setExecId(null); await load(); }
    catch (e) { setToast((e as Error).message); }
    setBusy(false);
  }

  const pending = rows.filter(r => r.status === 'pending' || r.status === 'running');
  const history = rows.filter(r => r.status !== 'pending' && r.status !== 'running');

  return (
    <div>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Approvals & danger zone" subtitle="Destructive actions are proposed first and run after a delay, so there is time to cancel." />

      <SuperCard title="Propose a danger-zone action" tone="danger">
        <FieldLabel htmlFor="dz-action">Action</FieldLabel>
        <FieldSelect id="dz-action" value={action} onChange={e => { setAction(e.target.value); setPreview(null); setArg(''); }}>
          {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </FieldSelect>
        {argLabel && (<div style={{ marginTop: 10 }}>
          <FieldLabel htmlFor="dz-arg">{argLabel}</FieldLabel>
          <FieldInput id="dz-arg" value={arg} onChange={e => { setArg(e.target.value); setPreview(null); }} />
        </div>)}
        <div style={{ marginTop: 12 }}><GhostBtn onClick={doPreview}>Preview impact</GhostBtn></div>
        {preview && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: T_SM }}>{preview.summary}</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: T_SM, color: MUTED }}>{preview.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            {preview.refusal
              ? <p style={{ margin: '10px 0 0' }}><SuperBadge tone="bad">Refused: {preview.refusal}</SuperBadge></p>
              : <div style={{ marginTop: 12 }}><DangerBtn onClick={() => setConfirmOpen(true)}>Propose (runs in 15 min)</DangerBtn></div>}
          </div>
        )}
      </SuperCard>

      <SuperCard title={`Pending (${pending.length})`}>
        {pending.length === 0 && <p style={{ margin: 0, color: MUTED }}>Nothing waiting.</p>}
        {pending.length > 0 && (
          <SuperTable head={['Action', 'Proposed by', 'Runs in', '']}>
            {pending.map(r => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.summary}<span style={{ display: 'block', fontSize: T_XS, color: MUTED }}>{r.action}</span></td>
                <td style={tdStyle}>{r.requester ?? '—'}</td>
                <td style={tdStyle}>{r.status === 'running' ? <SuperBadge tone="warn">running</SuperBadge> : <Countdown to={new Date(r.executeAfter).getTime()} now={now} />}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  {r.status === 'pending' && (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <GhostBtn small onClick={() => cancel(r.id)}>Cancel</GhostBtn>
                      {r.requestedBy === me && <DangerBtn small onClick={() => setExecId(r.id)}>Execute now</DangerBtn>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </SuperTable>
        )}
      </SuperCard>

      <SuperCard title="History">
        {history.length === 0 && <p style={{ margin: 0, color: MUTED }}>No past actions.</p>}
        {history.length > 0 && (
          <SuperTable head={['Action', 'Status', 'By', 'Resolved', 'Result']}>
            {history.map(r => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.summary}</td>
                <td style={tdStyle}><SuperBadge tone={tone(r.status)}>{r.status}</SuperBadge></td>
                <td style={tdStyle}>{r.requester ?? '—'}</td>
                <td style={tdStyle}>{r.resolvedAt ? fmtDhaka(new Date(r.resolvedAt).getTime()) : '—'}</td>
                <td style={{ ...tdStyle, fontSize: T_XS, color: MUTED, overflowWrap: 'anywhere', maxWidth: 260 }}>{r.result && r.result.length > 160 ? r.result.slice(0, 160) + '…' : r.result}</td>
              </tr>
            ))}
          </SuperTable>
        )}
      </SuperCard>

      <TypedConfirm open={confirmOpen && !!preview && !preview.refusal} title="Propose destructive action" message={preview?.summary ?? ''}
        phrase={preview?.phrase ?? ''} confirmLabel="Propose" loading={proposing} onConfirm={propose} onCancel={() => setConfirmOpen(false)} />
      <TypedConfirm open={execId !== null} title="Execute now" message="This skips the delay and runs the action immediately. It cannot be undone."
        phrase="EXECUTE NOW" confirmLabel="Execute" loading={busy} onConfirm={executeNow} onCancel={() => setExecId(null)} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
