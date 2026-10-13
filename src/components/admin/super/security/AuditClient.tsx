'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { SPIN_CSS, FieldInput, FieldLabel, PrimaryBtn, GhostBtn, Toast, fmtDhaka } from '../../lms/lms-shared';
import { SLATE, MUTED, BORDER, SURFACE_ALT, OK, OK_BG, WARN, WARN_BG, RED, T_XS, T_SM } from '../../lms/tokens';
import { SuperHeader, SuperCard, SuperTable, SuperBadge, tdStyle, superApi } from '../super-ui';
import { changedKeys, parseJson } from '@/lib/super/security/diff';

interface Row {
  id: number; action: string; entityType: string; entityId: number | null; before: string | null; after: string | null;
  createdAt: number; actorUserId: number | null; actorName: string | null; actorEmail: string | null;
}
interface Filters { actor: string; action: string; entityType: string; entityId: string; from: string; to: string }
const EMPTY: Filters = { actor: '', action: '', entityType: '', entityId: '', from: '', to: '' };

function qs(f: Filters, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, v);
  return p.toString();
}

function DiffView({ row }: { row: Row }) {
  const before = parseJson(row.before);
  const after = parseJson(row.after);
  const changed = new Set(changedKeys(before, after));
  const side = (label: string, v: unknown) => {
    const obj = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    return (
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontSize: T_XS, fontWeight: 700, color: MUTED, textTransform: 'uppercase' }}>{label}</p>
        {v == null ? <p style={{ margin: 0, fontSize: T_SM, color: MUTED }}>none</p> : obj ? (
          <div style={{ fontFamily: 'var(--font-math-mono), monospace', fontSize: T_SM }}>
            {Object.entries(obj).map(([k, val]) => (
              <div key={k} style={{ padding: '2px 6px', borderRadius: 4, wordBreak: 'break-word', background: changed.has(k) ? (label === 'Before' ? WARN_BG : OK_BG) : 'transparent', color: changed.has(k) ? (label === 'Before' ? WARN : OK) : SLATE }}>
                {k}: {typeof val === 'string' ? val : JSON.stringify(val)}
              </div>
            ))}
          </div>
        ) : <pre style={{ margin: 0, fontSize: T_SM, whiteSpace: 'pre-wrap' }}>{String(v)}</pre>}
      </div>
    );
  };
  return <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, background: SURFACE_ALT, borderRadius: 8 }}>{side('Before', before)}{side('After', after)}</div>;
}

export default function AuditClient() {
  const [f, setF] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (filters: Filters, after: number | null) => {
    setLoading(true);
    try {
      const d = await superApi<{ rows: Row[]; nextCursor: number | null }>(`/api/admin/super/security/audit?${qs(filters, after ? { cursor: String(after) } : {})}`);
      setRows(prev => (after ? [...prev, ...d.rows] : d.rows));
      setCursor(d.nextCursor);
    } catch (e) { setToast((e as Error).message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(EMPTY, null); }, [load]);

  const apply = () => { setApplied(f); setOpen(null); void load(f, null); };
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Audit log" subtitle="Every recorded change, newest first. Expand a row to see exactly what changed." />
      <SuperCard>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div><FieldLabel>Actor (name, email or id)</FieldLabel><FieldInput value={f.actor} onChange={set('actor')} /></div>
          <div><FieldLabel>Action (prefix)</FieldLabel><FieldInput value={f.action} onChange={set('action')} placeholder="role." /></div>
          <div><FieldLabel>Entity type</FieldLabel><FieldInput value={f.entityType} onChange={set('entityType')} placeholder="user" /></div>
          <div><FieldLabel>Entity id</FieldLabel><FieldInput value={f.entityId} onChange={set('entityId')} inputMode="numeric" /></div>
          <div><FieldLabel>From</FieldLabel><FieldInput type="date" value={f.from} onChange={set('from')} /></div>
          <div><FieldLabel>To</FieldLabel><FieldInput type="date" value={f.to} onChange={set('to')} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PrimaryBtn onClick={apply} loading={loading}>Apply filters</PrimaryBtn>
          <GhostBtn onClick={() => { setF(EMPTY); setApplied(EMPTY); void load(EMPTY, null); }}>Reset</GhostBtn>
          <a href={`/api/admin/super/security/audit?${qs(applied, { format: 'csv' })}`} style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: T_SM, color: RED, fontWeight: 600 }}>
            Export filtered set (CSV, max 5,000 rows, logged)
          </a>
        </div>
      </SuperCard>

      <SuperCard>
        {rows.length === 0 && !loading ? <p style={{ margin: 0, color: MUTED, fontSize: T_SM }}>No audit entries match.</p> : (
          <SuperTable head={['Time', 'Actor', 'Action', 'Entity', '']}>
            {rows.map(r => (
              <React.Fragment key={r.id}>
                <tr>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDhaka(r.createdAt)}</td>
                  <td style={tdStyle}>{r.actorName ?? (r.actorUserId ? `#${r.actorUserId}` : 'system')}<br /><span style={{ color: MUTED, fontSize: T_XS }}>{r.actorEmail}</span></td>
                  <td style={tdStyle}><SuperBadge tone="gold">{r.action}</SuperBadge></td>
                  <td style={tdStyle}>{r.entityType}{r.entityId != null ? ` #${r.entityId}` : ''}</td>
                  <td style={tdStyle}>
                    <button type="button" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: T_SM, fontWeight: 600 }}>
                      {open === r.id ? 'Hide' : 'Diff'}
                    </button>
                  </td>
                </tr>
                {open === r.id && <tr><td colSpan={5} style={{ padding: '0 10px 12px', borderBottom: `1px solid ${BORDER}` }}><DiffView row={r} /></td></tr>}
              </React.Fragment>
            ))}
          </SuperTable>
        )}
        {cursor && <div style={{ marginTop: 12 }}><GhostBtn onClick={() => void load(applied, cursor)} disabled={loading}>{loading ? 'Loading…' : 'Load older'}</GhostBtn></div>}
      </SuperCard>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
