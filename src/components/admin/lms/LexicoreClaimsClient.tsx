'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SPIN_CSS, PageHeader, PrimaryBtn, GhostBtn, DangerBtn, FieldInput, Toast, fmtDhaka,
  BORDER, MUTED, SLATE, SURFACE, SURFACE_ALT, OK, OK_BG, WARN, WARN_BG, RED, R_LG, R_MD, R_PILL, SHADOW_SM,
} from './lms-shared';

type Status = 'active' | 'held' | 'approved' | 'rejected';
interface Claim {
  id: number; trxId: string; senderNumber: string | null; amount: number; promoCode: string | null; status: Status;
  note: string | null; createdAt: string; userName: string; userEmail: string; screenshotUrl: string | null;
}

const STATUS: Record<Status, { label: string; bg: string; fg: string }> = {
  active:   { label: 'Active, check payment', bg: WARN_BG, fg: WARN },
  held:     { label: 'Held', bg: WARN_BG, fg: WARN },
  approved: { label: 'Approved', bg: OK_BG, fg: OK },
  rejected: { label: 'Rejected', bg: SURFACE_ALT, fg: RED },
};

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body;
}

function Row({ c, onDecide }: { c: Claim; onDecide: (id: number, action: 'approve' | 'reject', note?: string) => Promise<void> }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const st = STATUS[c.status];
  const run = async (action: 'approve' | 'reject') => {
    setBusy(true);
    await onDecide(c.id, action, note.trim() || undefined);
    setBusy(false); setRejecting(false);
  };
  const canApprove = c.status !== 'approved';
  const canReject = c.status !== 'rejected';
  return (
    <li style={{ background: SURFACE_ALT, borderRadius: R_MD, padding: 14, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, color: SLATE, fontSize: 14 }}>{c.userName}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{c.userEmail}</div>
        </div>
        <span style={{ padding: '2px 10px', borderRadius: R_PILL, background: st.bg, color: st.fg, fontSize: 11, fontWeight: 700 }}>{st.label}</span>
      </div>
      <div style={{ fontSize: 12, color: SLATE, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>Trx ID: <b>{c.trxId}</b></span>
        <span>From: <b>{c.senderNumber ?? '-'}</b></span>
        <span>Amount: <b>BDT {c.amount}</b>{c.promoCode && <> ({c.promoCode})</>}</span>
        <span>Submitted {fmtDhaka(Date.parse(c.createdAt))}</span>
        {c.screenshotUrl && <a href={c.screenshotUrl} target="_blank" rel="noreferrer" style={{ color: SLATE, textDecoration: 'underline' }}>View screenshot</a>}
      </div>
      {c.note && <div style={{ fontSize: 12, color: MUTED }}>Note: {c.note}</div>}
      {!rejecting && (canApprove || canReject) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {canApprove && <PrimaryBtn small disabled={busy} onClick={() => run('approve')}>Approve</PrimaryBtn>}
          {canReject && <GhostBtn small disabled={busy} onClick={() => setRejecting(true)}>Reject…</GhostBtn>}
        </div>
      )}
      {rejecting && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <FieldInput value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note (shown to the student)" aria-label="Rejection note" />
          </div>
          <DangerBtn small disabled={busy} onClick={() => run('reject')}>Reject</DangerBtn>
          <GhostBtn small onClick={() => setRejecting(false)}>Cancel</GhostBtn>
        </div>
      )}
    </li>
  );
}

export default function LexicoreClaimsClient() {
  const [rows, setRows] = useState<Claim[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'check' | 'all'>('check');
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows((await call('/api/admin/lexicore-claims') as { claims: Claim[] }).claims); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const decide = async (id: number, action: 'approve' | 'reject', note?: string) => {
    try {
      await call(`/api/admin/lexicore-claims/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }),
      });
      setToast(action === 'approve' ? 'Approved' : 'Rejected');
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Failed'); }
  };

  const needs = rows?.filter(r => r.status === 'active' || r.status === 'held') ?? [];
  const shown = tab === 'check' ? needs : rows ?? [];
  const tabBtn = (id: 'check' | 'all', label: string) => (
    tab === id
      ? <PrimaryBtn small onClick={() => setTab(id)}>{label}</PrimaryBtn>
      : <GhostBtn small onClick={() => setTab(id)}>{label}</GhostBtn>
  );

  return (
    <div style={{ padding: '24px 20px', maxWidth: 980, margin: '0 auto' }}>
      <style>{SPIN_CSS}</style>
      <PageHeader title="LexiCore claims" subtitle="bKash payments for unlimited LexiCore. Active claims already have access; check the bKash app for the Trx ID, then approve or reject." />
      {error && <p style={{ color: RED, fontSize: 13 }}>{error}</p>}
      <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 20, boxShadow: SHADOW_SM }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {tabBtn('check', `Needs check (${needs.length})`)}
          {tabBtn('all', `All (${rows?.length ?? 0})`)}
        </div>
        {!rows
          ? <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{error ? '' : 'Loading…'}</p>
          : shown.length === 0
            ? <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{tab === 'check' ? 'Nothing to check.' : 'No claims yet.'}</p>
            : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>{shown.map(c => <Row key={c.id} c={c} onDecide={decide} />)}</ul>}
      </section>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
