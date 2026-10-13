'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  PageHeader, Toast, useConfirm, EmptyState, SPIN_CSS,
  RED, SLATE, MUTED, BORDER, BORDER_FIELD, BG, SURFACE, SURFACE_ALT, INFO_BG,
  R_MD, T_XS, T_SM, T_BASE,
} from '@/components/admin/lms/lms-shared';
import { ageDays, compareInbox, countByStatus, isStale, courseLabel, parseJsonList, type RegistrationStatus } from '@/lib/registrations/enrolment';
import EnrolmentDetail, { Stamp, statusTone } from './EnrolmentDetail';

export interface EnrolmentRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  educationType: string | null;
  hscYear: string | null; sscYear: string | null; aLevelYear: string | null; oLevelYear: string | null;
  programMode: string | null;
  selectedMocks: string | null;
  selectedFullCourses: string | null;
  mockIntent: string | null;
  pricingSubtotal: number | null;
  pricingDiscount: number | null;
  pricingFinalPrice: number | null;
  referralName: string | null;
  referralInstitution: string | null;
  referralBatch: string | null;
  status: string;
  studentEmailStatus: string | null;
  adminEmailStatus: string | null;
  createdAtMs: number;
}
export interface EnrolmentBatch { id: number; name: string; product: string }

type Filter = 'all' | RegistrationStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'contacted', label: 'Contacted' },
  { key: 'enrolled', label: 'Enrolled' }, { key: 'cancelled', label: 'Cancelled' },
];

const PAGE_CSS = `
.en-split{display:grid;grid-template-columns:300px minmax(0,1fr);border:1px solid ${BORDER};border-radius:${R_MD}px;background:${SURFACE};overflow:hidden;min-height:480px}
.en-list{border-right:1px solid ${BORDER};max-height:calc(100vh - 260px);overflow-y:auto}
.en-row{display:flex;gap:10px;align-items:center;width:100%;border:0;border-top:1px solid ${BORDER};background:${SURFACE};padding:10px 12px;text-align:left;min-height:56px;cursor:pointer;font:inherit;color:inherit}
.en-row:hover{background:${SURFACE_ALT}}
.en-row[aria-current="true"]{background:${INFO_BG};box-shadow:inset 3px 0 0 ${RED}}
.en-row:focus-visible,.en-chip:focus-visible{outline:2px solid ${RED};outline-offset:-2px}
.en-chip{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 14px;min-height:44px;border:1px solid ${BORDER};background:${SURFACE};border-radius:${R_MD}px;cursor:pointer;font:inherit;color:${SLATE}}
.en-chip[aria-pressed="true"]{border-color:${RED};box-shadow:inset 0 -3px 0 ${RED}}
@media (max-width:760px){
.en-split{grid-template-columns:1fr}
.en-list{border-right:0;border-bottom:1px solid ${BORDER};max-height:320px}
}
`;

export default function EnrolmentsClient({ initialRows, batches, canEnrol }: {
  initialRows: EnrolmentRow[]; batches: EnrolmentBatch[]; canEnrol: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const counts = useMemo(() => countByStatus(rows), [rows]);
  const staleCount = useMemo(() => rows.filter((r) => isStale(r.status, r.createdAtMs)).length, [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (filter === 'all' || r.status === filter)
        && (!needle || r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle) || r.phone.includes(needle)))
      .sort(compareInbox);
  }, [rows, filter, q]);

  const selected = rows.find((r) => r.id === selectedId) ?? visible[0] ?? null;

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 4000); };
  const patchRow = (id: number, patch: Partial<EnrolmentRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function call(url: string, method: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) return { ok: false, error: typeof data.error === 'string' ? data.error : `Request failed (${res.status})` };
      return { ok: true, data };
    } catch {
      return { ok: false, error: 'Network error' };
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(row: EnrolmentRow, status: RegistrationStatus) {
    const prev = row.status;
    patchRow(row.id, { status }); // optimistic
    const r = await call(`/api/registrations/${row.id}`, 'PATCH', { status });
    if (!r.ok) { patchRow(row.id, { status: prev }); flash(r.error ?? 'Could not update'); return; }
    flash(status === 'contacted' ? `${row.name} marked contacted` : `${row.name} cancelled`);
  }

  async function cancel(row: EnrolmentRow) {
    const ok = await confirm({
      title: `Cancel ${row.name}'s registration?`,
      message: 'The registration is closed and cannot be reopened. No access is granted.',
      confirmLabel: 'Cancel registration', cancelLabel: 'Keep it', destructive: true,
    });
    if (ok) await setStatus(row, 'cancelled');
  }

  async function enrol(row: EnrolmentRow, batch: string) {
    const r = await call(`/api/registrations/${row.id}/enrol`, 'POST', { batch });
    if (!r.ok) { flash(r.error ?? 'Could not enrol'); return; }
    patchRow(row.id, { status: 'enrolled' });
    flash(`${row.name} enrolled in ${batch}, access granted`);
  }

  async function saveContact(row: EnrolmentRow, patch: { name: string; email: string; phone: string }) {
    const r = await call(`/api/registrations/${row.id}`, 'PATCH', patch);
    if (!r.ok) { flash(r.error ?? 'Could not save'); return; }
    patchRow(row.id, { ...patch, email: patch.email.trim().toLowerCase() });
    flash('Contact details saved');
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', padding: '24px 16px' }}>
      <style>{SPIN_CSS}</style>
      <style>{PAGE_CSS}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <PageHeader title="Enrolments" subtitle="Sign-up form registrations: who chose what, what it costs, and whether they are enrolled." />

        <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="en-chip" aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setSelectedId(null); }}>
              <span style={{ fontSize: T_XS, fontWeight: 600, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{f.label}</span>
              <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
                {f.key === 'all' ? rows.length : counts[f.key]}
              </span>
            </button>
          ))}
          {staleCount > 0 && (
            <span style={{ alignSelf: 'center', fontSize: T_SM, color: RED, fontWeight: 600 }}>
              {staleCount} pending for more than 14 days
            </span>
          )}
        </div>

        <div className="en-split">
          <div className="en-list">
            <div style={{ padding: '8px 10px', position: 'relative' }}>
              <Search size={14} aria-hidden color={MUTED} style={{ position: 'absolute', left: 20, top: 20 }} />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search registrations" aria-label="Search registrations"
                className="lms-field"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 32px', borderRadius: R_MD, border: `1.5px solid ${BORDER_FIELD}`, background: BG, fontSize: T_BASE, color: SLATE, outline: 'none' }}
              />
            </div>
            {visible.length === 0 && <div style={{ padding: 16 }}><EmptyState icon={Search} message="No registrations match." /></div>}
            {visible.map((r) => {
              const stale = isStale(r.status, r.createdAtMs);
              const days = ageDays(r.createdAtMs);
              const pkg = (r.programMode === 'mocks' ? parseJsonList(r.selectedMocks) : parseJsonList(r.selectedFullCourses))
                .map(courseLabel).join(', ') || (r.programMode === 'mocks' ? 'Mocks' : 'Full course');
              return (
                <button key={r.id} type="button" className="en-row" aria-current={selected?.id === r.id} onClick={() => setSelectedId(r.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: T_BASE, color: SLATE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ fontSize: T_SM, color: stale ? RED : MUTED, fontWeight: stale ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pkg} · {days}d
                    </div>
                  </div>
                  <Stamp tone={statusTone(r.status, stale)}>{r.status}</Stamp>
                </button>
              );
            })}
          </div>

          <div>
            {selected ? (
              <EnrolmentDetail
                key={selected.id}
                row={selected}
                batches={batches}
                canEnrol={canEnrol}
                busy={busy}
                onContacted={() => setStatus(selected, 'contacted')}
                onCancel={() => cancel(selected)}
                onEnrol={(b) => enrol(selected, b)}
                onSaveContact={(p) => saveContact(selected, p)}
              />
            ) : (
              <div style={{ padding: 24 }}><EmptyState icon={Search} message="No registrations yet." /></div>
            )}
          </div>
        </div>
      </div>
      {confirmDialog}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
