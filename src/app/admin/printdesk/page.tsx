'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  BG, BORDER, DangerBtn, EmptyState, FieldTextarea, FormActions, GhostBtn, MUTED, Modal, OK, OK_BG, PageHeader, PrimaryBtn, R_LG, R_PILL,
  RED, SLATE, SPIN_CSS, SURFACE, SURFACE_ALT, T_BASE, T_SM, T_XS, TabBar, Toast, WARN, WARN_BG, fmtDhaka,
} from '@/components/admin/lms/lms-shared';
import { SUBJECT_LABELS } from '@/lib/lms/subject-constants';
import { buildPrintZip, type PackResponse } from '@/lib/printdesk/pack-client';
import type { PrintRequestStatus } from '@/lib/db/schema';

interface Row {
  id: number;
  status: PrintRequestStatus;
  student: { id: number; name: string; email: string; studentId: string | null; batch: string | null };
  items: { materialId: number; title: string; subject: string }[];
  rejectReason: string | null;
  createdAt: string;
  printedAt: string | null;
  printedBy: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  rejectedBy: string | null;
}

const TABS: { id: PrintRequestStatus; label: string }[] = [
  { id: 'requested', label: 'Requested' },
  { id: 'printed', label: 'Printed' },
  { id: 'collected', label: 'Collected' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
];

const REJECT_REASONS = ['Material is no longer available in print', 'Already given a copy in class', 'Please ask your instructor in class'];
const subjectLabel = (s: string) => SUBJECT_LABELS[s as keyof typeof SUBJECT_LABELS] ?? s;

export default function PrintDeskAdminPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<PrintRequestStatus>('requested');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/printdesk');
    const j = await res.json().catch(() => ({}));
    setRows(res.ok ? j.requests : []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelected(new Set()); }, [tab]);

  const inTab = useMemo(() => (rows ?? []).filter(r => r.status === tab), [rows, tab]);
  const counts = useMemo(() => Object.fromEntries(TABS.map(t => [t.id, (rows ?? []).filter(r => r.status === t.id).length])), [rows]);
  const chosen = inTab.filter(r => selected.has(r.id));
  const target = chosen.length ? chosen : inTab; // no ticks = act on the whole tab

  // What the current selection needs printed.
  const needed = useMemo(() => {
    const map = new Map<number, { title: string; subject: string; students: string[] }>();
    for (const r of target) for (const i of r.items) {
      const e = map.get(i.materialId) ?? { title: i.title, subject: i.subject, students: [] };
      e.students.push(r.student.name);
      map.set(i.materialId, e);
    }
    return [...map.values()].sort((a, b) => a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title));
  }, [target]);

  const download = async () => {
    if (!target.length) return;
    setBusy('Preparing…');
    try {
      const res = await fetch('/api/admin/printdesk/pack', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestIds: target.map(r => r.id) }),
      });
      const pack: PackResponse & { error?: string } = await res.json();
      if (!res.ok) { setToast(pack.error ?? 'Could not prepare the print pack'); return; }
      const { blob, failed } = await buildPrintZip(pack, (d, t) => setBusy(`Downloading file ${d} of ${t}…`));
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `printdesk-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setToast(
        (pack.markedPrinted ? `${pack.markedPrinted} request${pack.markedPrinted === 1 ? '' : 's'} marked as printed. ` : '') +
        (failed ? `${failed} file${failed === 1 ? '' : 's'} could not be downloaded — see PRINT-LIST.txt.` : 'Zip downloaded.'),
      );
      setSelected(new Set());
      await load();
    } catch {
      setToast('Download failed — try again');
    } finally {
      setBusy(null);
    }
  };

  const move = async (status: PrintRequestStatus, why?: string) => {
    if (!target.length) return;
    setBusy('Saving…');
    const res = await fetch('/api/admin/printdesk/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestIds: target.map(r => r.id), status, reason: why }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setToast(j.error ?? 'Could not update'); return; }
    setToast(`${j.moved} request${j.moved === 1 ? '' : 's'} updated${j.skipped ? ` · ${j.skipped} skipped` : ''}`);
    setSelected(new Set());
    setRejectOpen(false);
    setReason('');
    await load();
  };

  const allTicked = inTab.length > 0 && inTab.every(r => selected.has(r.id));
  const scope = chosen.length ? `${chosen.length} selected` : `all ${inTab.length}`;
  const th = { textAlign: 'left' as const, fontSize: T_XS, fontWeight: 700, color: MUTED, padding: '8px 10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' };
  const td = { fontSize: T_BASE, color: SLATE, padding: 10, borderTop: `1px solid ${BORDER}`, verticalAlign: 'top' as const };

  return (
    <div style={{ maxWidth: 1100 }}>
      <style>{SPIN_CSS}</style>
      <PageHeader title="PrintDesk" subtitle="Students' requests for printed copies of materials. Downloading a pack marks those requests as printed." />

      <TabBar tabs={TABS.map(t => ({ id: t.id, label: `${t.label} (${counts[t.id] ?? 0})` }))} active={tab} onChange={id => setTab(id as PrintRequestStatus)} />

      {rows === null ? (
        <p style={{ fontSize: T_SM, color: MUTED }}>Loading…</p>
      ) : inTab.length === 0 ? (
        <EmptyState icon={Printer} message={tab === 'requested' ? 'No print requests waiting.' : 'Nothing here.'} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {tab === 'requested' && (
              <>
                <PrimaryBtn onClick={download} loading={!!busy}><Download size={14} aria-hidden /> {busy ?? `Download print pack (${scope})`}</PrimaryBtn>
                <DangerBtn onClick={() => setRejectOpen(true)} disabled={!!busy}>Reject {scope}…</DangerBtn>
              </>
            )}
            {tab === 'printed' && (
              <>
                <PrimaryBtn onClick={() => move('collected')} loading={busy === 'Saving…'}>Mark {scope} collected</PrimaryBtn>
                <GhostBtn onClick={download} disabled={!!busy}><Download size={14} aria-hidden /> {busy && busy !== 'Saving…' ? busy : 'Download again'}</GhostBtn>
                <GhostBtn onClick={() => move('requested')} disabled={!!busy}>Move back to requested</GhostBtn>
                <DangerBtn onClick={() => setRejectOpen(true)} disabled={!!busy}>Reject…</DangerBtn>
              </>
            )}
            {tab === 'collected' && <GhostBtn onClick={() => move('printed')} disabled={!!busy || !chosen.length}>Undo — back to printed</GhostBtn>}
            <span style={{ fontSize: T_XS, color: MUTED }}>Tick rows to act on some; otherwise the action applies to everything in this tab.</span>
          </div>

          {(tab === 'requested' || tab === 'printed') && needed.length > 0 && (
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 14, marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: T_SM, fontWeight: 700, color: SLATE }}>
                Copies needed ({scope}) — {needed.reduce((n, m) => n + m.students.length, 0)} in total
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 6 }}>
                {needed.map(m => (
                  <div key={`${m.subject}-${m.title}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, background: BG, borderRadius: R_LG, padding: '6px 10px', fontSize: T_SM, color: SLATE }}>
                    <span title={m.students.join(', ')}>{m.title} <span style={{ color: MUTED }}>· {subjectLabel(m.subject)}</span></span>
                    <strong style={{ whiteSpace: 'nowrap' }}>× {m.students.length}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: SURFACE_ALT }}>
                <tr>
                  <th style={{ ...th, width: 36 }}>
                    <input type="checkbox" aria-label="Select all" checked={allTicked} onChange={e => setSelected(e.target.checked ? new Set(inTab.map(r => r.id)) : new Set())} />
                  </th>
                  <th style={th}>Student</th>
                  <th style={th}>Materials (1 copy each)</th>
                  <th style={th}>Requested</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {inTab.map(r => (
                  <tr key={r.id}>
                    <td style={td}>
                      <input type="checkbox" aria-label={`Select request ${r.id}`} checked={selected.has(r.id)}
                        onChange={e => setSelected(prev => { const n = new Set(prev); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.student.name}</div>
                      <div style={{ fontSize: T_XS, color: MUTED }}>{r.student.studentId ?? r.student.email} · {r.student.batch ?? '—'}</div>
                    </td>
                    <td style={td}>
                      {r.items.map(i => <div key={i.materialId} style={{ fontSize: T_SM }}>{i.title} <span style={{ color: MUTED }}>· {subjectLabel(i.subject)}</span></div>)}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontSize: T_SM }}>{fmtDhaka(new Date(r.createdAt).getTime())}</td>
                    <td style={{ ...td, fontSize: T_XS, color: MUTED }}>
                      {r.status === 'printed' && <span style={{ fontWeight: 700, padding: '2px 8px', borderRadius: R_PILL, color: WARN, background: WARN_BG }}>Printed{r.printedBy ? ` by ${r.printedBy}` : ''}</span>}
                      {r.status === 'collected' && <span style={{ fontWeight: 700, padding: '2px 8px', borderRadius: R_PILL, color: OK, background: OK_BG }}>Collected{r.collectedAt ? ` ${fmtDhaka(new Date(r.collectedAt).getTime(), { dateStyle: 'medium' })}` : ''}</span>}
                      {r.status === 'rejected' && <span style={{ color: RED }}>{r.rejectReason}{r.rejectedBy ? ` — ${r.rejectedBy}` : ''}</span>}
                      {r.status === 'requested' && 'Waiting'}
                      {r.status === 'cancelled' && 'Cancelled by student'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title={`Reject ${scope} request${target.length === 1 ? '' : 's'}`} width={460}>
        <p style={{ margin: '0 0 10px', fontSize: T_SM, color: MUTED }}>The student sees this reason and can request the materials again.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {REJECT_REASONS.map(r => (
            <button key={r} type="button" onClick={() => setReason(r)} style={{ border: `1px solid ${reason === r ? RED : BORDER}`, background: reason === r ? `${RED}10` : SURFACE, color: reason === r ? RED : SLATE, borderRadius: R_PILL, padding: '5px 10px', fontSize: T_XS, cursor: 'pointer' }}>{r}</button>
          ))}
        </div>
        <FieldTextarea rows={3} value={reason} placeholder="Reason the student will see" onChange={e => setReason(e.target.value)} />
        <FormActions>
          <GhostBtn onClick={() => setRejectOpen(false)}>Cancel</GhostBtn>
          <PrimaryBtn onClick={() => move('rejected', reason)} loading={busy === 'Saving…'} disabled={!reason.trim()}>Reject</PrimaryBtn>
        </FormActions>
      </Modal>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
