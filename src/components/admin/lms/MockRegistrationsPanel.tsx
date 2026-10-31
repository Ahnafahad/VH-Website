'use client';

import { useCallback, useEffect, useState } from 'react';
import { PrimaryBtn, GhostBtn, DangerBtn, FieldInput, fmtDhaka, BORDER, MUTED, SLATE, SURFACE, SURFACE_ALT, OK, OK_BG, WARN, WARN_BG, RED, R_LG, R_MD, R_PILL, SHADOW_SM } from './lms-shared';
import type { AdminMockRegistration, MockRegStatus } from '@/lib/mocks/registration';

const STATUS: Record<MockRegStatus, { label: string; bg: string; fg: string }> = {
  registered: { label: 'No payment yet', bg: SURFACE_ALT, fg: MUTED },
  submitted: { label: 'Awaiting verification', bg: WARN_BG, fg: WARN },
  approved: { label: 'Approved', bg: OK_BG, fg: OK },
  rejected: { label: 'Rejected', bg: SURFACE_ALT, fg: RED },
};

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body;
}

function Row({ r, onDecide }: { r: AdminMockRegistration; onDecide: (id: number, action: 'approve' | 'reject', note?: string) => Promise<void> }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const st = STATUS[r.status];
  const run = async (action: 'approve' | 'reject') => {
    setBusy(true);
    await onDecide(r.id, action, note);
    setBusy(false); setRejecting(false);
  };
  return (
    <li style={{ background: SURFACE_ALT, borderRadius: R_MD, padding: 14, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, color: SLATE, fontSize: 14 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{r.email} · {r.phone}</div>
        </div>
        <span style={{ padding: '2px 10px', borderRadius: R_PILL, background: st.bg, color: st.fg, fontSize: 11, fontWeight: 700 }}>{st.label}</span>
      </div>
      <div style={{ fontSize: 12, color: SLATE, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>Reference: <b>{r.reference}</b></span>
        <span>Trx ID: <b>{r.trxId ?? '—'}</b></span>
        {r.submittedAt && <span>Submitted {fmtDhaka(r.submittedAt)}</span>}
        {r.accessUntil && <span>LexiCore until {fmtDhaka(r.accessUntil)}</span>}
        {r.screenshotUrl && <a href={r.screenshotUrl} target="_blank" rel="noreferrer" style={{ color: SLATE, textDecoration: 'underline' }}>View screenshot</a>}
      </div>
      {r.note && r.status === 'rejected' && <div style={{ fontSize: 12, color: MUTED }}>Note sent: {r.note}</div>}
      {r.status === 'submitted' && !rejecting && (
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryBtn small disabled={busy} onClick={() => run('approve')}>Approve</PrimaryBtn>
          <GhostBtn small disabled={busy} onClick={() => setRejecting(true)}>Reject…</GhostBtn>
        </div>
      )}
      {rejecting && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <FieldInput value={note} onChange={e => setNote(e.target.value)} placeholder="Why (shown to the student), e.g. transaction ID not found" aria-label="Rejection note" />
          </div>
          <DangerBtn small disabled={busy || !note.trim()} onClick={() => run('reject')}>Send rejection</DangerBtn>
          <GhostBtn small onClick={() => setRejecting(false)}>Cancel</GhostBtn>
        </div>
      )}
    </li>
  );
}

export default function MockRegistrationsPanel({ toast }: { toast: (m: string) => void }) {
  const [rows, setRows] = useState<AdminMockRegistration[] | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    try { setRows((await call('/api/admin/mock-registrations') as { registrations: AdminMockRegistration[] }).registrations); }
    catch { setDenied(true); }   // instructors: admin-only panel
  }, []);
  useEffect(() => { void load(); }, [load]);

  const decide = async (id: number, action: 'approve' | 'reject', note?: string) => {
    try {
      await call(`/api/admin/mock-registrations/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }),
      });
      toast(action === 'approve' ? 'Approved — student emailed, LexiCore opened' : 'Rejected — student emailed');
      await load();
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed'); }
  };

  if (denied || !rows) return null;
  const pending = rows.filter(r => r.status === 'submitted').length;
  return (
    <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 20, boxShadow: SHADOW_SM }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        Registrations · {pending} awaiting verification · {rows.length} total
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: MUTED }}>
        Students register at <b>/mock-register</b> (share that link on the announcement; it is not linked anywhere on the site). Check the bKash app for the reference and transaction ID, then approve.
      </p>
      {rows.length === 0
        ? <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>No registrations yet.</p>
        : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>{rows.map(r => <Row key={r.id} r={r} onDecide={decide} />)}</ul>}
    </section>
  );
}
