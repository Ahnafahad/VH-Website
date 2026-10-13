'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SPIN_CSS, TabBar, FieldSelect, FieldLabel, GhostBtn, PrimaryBtn, Toast, fmtDhaka } from '../../lms/lms-shared';
import { MUTED, BORDER, T_SM, T_XS } from '../../lms/tokens';
import { SuperHeader, SuperCard, StatGrid, StatTile, SuperTable, SuperBadge, tdStyle, superApi } from '../super-ui';

type Sev = 'high' | 'warn' | 'info';
const sevTone = (s: Sev) => (s === 'high' ? 'bad' : s === 'warn' ? 'warn' : 'neutral') as 'bad' | 'warn' | 'neutral';

interface DriftRow { severity: Sev; kind: string; table: string; item: string; detail: string }
interface CheckResult {
  id: string; title: string; description: string; severity: Sev; count: number;
  columns: string[]; sample: (string | number | null)[][]; links: (string | null)[]; error?: string;
}
interface AccessReq { id: number; userId: number; name: string; email: string; whatsapp: string | null; message: string | null; createdAt: string }
interface Upgrade { id: number; userId: number; name: string; email: string; option: string; submittedAt: string }

const TABS = [
  { id: 'drift', label: 'Schema drift' },
  { id: 'checks', label: 'Data checks' },
  { id: 'export', label: 'Export' },
  { id: 'queue', label: 'Access queue' },
];

export default function IntegrityClient() {
  const [tab, setTab] = useState('drift');
  const [toast, setToast] = useState<string | null>(null);
  return (
    <div>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Integrity" subtitle="Schema drift, data health checks, CSV exports and the access request queue." />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'drift' && <Drift onError={setToast} />}
      {tab === 'checks' && <Checks onError={setToast} />}
      {tab === 'export' && <Export onError={setToast} />}
      {tab === 'queue' && <Queue onError={setToast} />}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function Drift({ onError }: { onError: (m: string) => void }) {
  const [data, setData] = useState<{ tables: number; rows: DriftRow[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await superApi('/api/admin/super/data/drift')); } catch (e) { onError((e as Error).message); }
    setLoading(false);
  }, [onError]);
  useEffect(() => { void load(); }, [load]);
  const count = (s: Sev) => data?.rows.filter(r => r.severity === s).length ?? 0;
  return (
    <>
      <StatGrid>
        <StatTile label="Tables in schema.ts" value={data?.tables ?? '—'} />
        <StatTile label="High" value={data ? count('high') : '—'} tone={data ? (count('high') ? 'bad' : 'ok') : undefined} hint="missing tables / columns" />
        <StatTile label="Warnings" value={data ? count('warn') : '—'} tone={data ? (count('warn') ? 'warn' : 'ok') : undefined} hint="indexes, types" />
        <StatTile label="Info" value={data ? count('info') : '—'} hint="extra in live DB" />
      </StatGrid>
      <SuperCard title="Differences" action={<GhostBtn small onClick={load} disabled={loading}>{loading ? 'Checking…' : 'Re-check'}</GhostBtn>}>
        {data && data.rows.length === 0 && <p style={{ margin: 0, color: MUTED }}>Live database matches schema.ts.</p>}
        {data && data.rows.length > 0 && (
          <SuperTable head={['Severity', 'Kind', 'Table', 'Item', 'Detail']}>
            {data.rows.map((r, i) => (
              <tr key={i}>
                <td style={tdStyle}><SuperBadge tone={sevTone(r.severity)}>{r.severity}</SuperBadge></td>
                <td style={tdStyle}>{r.kind}</td>
                <td style={tdStyle}>{r.table}</td>
                <td style={{ ...tdStyle, wordBreak: 'break-all' }}>{r.item}</td>
                <td style={{ ...tdStyle, color: MUTED }}>{r.detail}</td>
              </tr>
            ))}
          </SuperTable>
        )}
        <p style={{ margin: '12px 0 0', fontSize: T_XS, color: MUTED }}>Fix drift with the db-schema-change workflow (drizzle-kit push). Nothing here writes to the database.</p>
      </SuperCard>
    </>
  );
}

function Checks({ onError }: { onError: (m: string) => void }) {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setResults((await superApi<{ results: CheckResult[] }>('/api/admin/super/data/checks')).results); } catch (e) { onError((e as Error).message); }
    setLoading(false);
  }, [onError]);
  useEffect(() => { void load(); }, [load]);
  return (
    <SuperCard title="Data checks" action={<GhostBtn small onClick={load} disabled={loading}>{loading ? 'Running…' : 'Re-run'}</GhostBtn>}>
      {!results && <p style={{ margin: 0, color: MUTED }}>Running checks…</p>}
      {results?.map(c => {
        const clean = c.count === 0 && !c.error;
        return (
          <div key={c.id} style={{ borderTop: `1px solid ${BORDER}`, paddingBottom: 10 }}>
            <button
              onClick={() => setOpen(open === c.id ? null : c.id)}
              disabled={clean}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '10px 0', background: 'none', border: 'none', cursor: clean ? 'default' : 'pointer', textAlign: 'left' }}
            >
              <SuperBadge tone={c.error ? 'bad' : clean ? 'ok' : sevTone(c.severity)}>{c.error ? 'error' : clean ? 'clean' : c.count}</SuperBadge>
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: T_SM }}>{c.title}</strong>
                <span style={{ display: 'block', fontSize: T_XS, color: MUTED }}>{c.error ?? c.description}</span>
              </span>
            </button>
            {open === c.id && c.sample.length > 0 && (
              <SuperTable head={[...c.columns, '']}>
                {c.sample.map((row, i) => (
                  <tr key={i}>
                    {row.map((v, j) => <td key={j} style={tdStyle}>{v === null ? '—' : String(v)}</td>)}
                    <td style={tdStyle}>{c.links[i] ? <Link href={c.links[i]!}>Open</Link> : null}</td>
                  </tr>
                ))}
              </SuperTable>
            )}
            {open === c.id && c.count > c.sample.length && <p style={{ margin: '6px 0 0', fontSize: T_XS, color: MUTED }}>Showing first {c.sample.length} of {c.count}.</p>}
          </div>
        );
      })}
    </SuperCard>
  );
}

function Export({ onError }: { onError: (m: string) => void }) {
  const [tests, setTests] = useState<{ id: number; title: string }[]>([]);
  const [testId, setTestId] = useState('');
  useEffect(() => {
    superApi<{ tests: { id: number; title: string }[] }>('/api/admin/super/data/export?meta=1')
      .then(d => { setTests(d.tests); setTestId(String(d.tests[0]?.id ?? '')); })
      .catch(e => onError((e as Error).message));
  }, [onError]);
  const Row = ({ kind, label, desc, extra }: { kind: string; label: string; desc: string; extra?: React.ReactNode }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <div style={{ flex: '1 1 220px' }}>
        <strong style={{ fontSize: T_SM }}>{label}</strong>
        <span style={{ display: 'block', fontSize: T_XS, color: MUTED }}>{desc}</span>
      </div>
      {extra}
      <a href={`/api/admin/super/data/export?kind=${kind}${kind === 'marks' ? `&testId=${testId}` : ''}`} download
        style={{ pointerEvents: kind === 'marks' && !testId ? 'none' : 'auto' }}>
        <PrimaryBtn small disabled={kind === 'marks' && !testId}>Download CSV</PrimaryBtn>
      </a>
    </div>
  );
  return (
    <SuperCard title="CSV exports">
      <p style={{ margin: '0 0 8px', fontSize: T_XS, color: MUTED }}>Every export is audit-logged. Cells starting with = + - @ are prefixed with an apostrophe so spreadsheets do not run them as formulas.</p>
      <Row kind="users" label="Users" desc="All accounts: role, status, batch, contact" />
      <Row kind="marks" label="Test marks" desc="One test: every attempt with scores" extra={
        <div style={{ minWidth: 200 }}>
          <FieldLabel htmlFor="exp-test">Test</FieldLabel>
          <FieldSelect id="exp-test" value={testId} onChange={e => setTestId(e.target.value)}>
            {tests.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </FieldSelect>
        </div>} />
      <Row kind="registrations" label="Registrations" desc="Registration form submissions with status" />
      <Row kind="attendance" label="Attendance" desc="Every class attendance row with session details" />
    </SuperCard>
  );
}

function Queue({ onError }: { onError: (m: string) => void }) {
  const [data, setData] = useState<{ access: AccessReq[]; upgrades: Upgrade[] } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    try { setData(await superApi('/api/admin/super/data/access-queue')); } catch (e) { onError((e as Error).message); }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);
  async function decide(id: number, decision: 'approve' | 'deny') {
    setBusy(id);
    try { await superApi('/api/admin/super/data/access-queue', { method: 'POST', body: { id, decision } }); await load(); }
    catch (e) { onError((e as Error).message); }
    setBusy(null);
  }
  return (
    <>
      <SuperCard title="LexiCore access requests (pending)">
        {data && data.access.length === 0 && <p style={{ margin: 0, color: MUTED }}>Nothing pending.</p>}
        {data && data.access.length > 0 && (
          <SuperTable head={['Student', 'WhatsApp', 'Message', 'Requested', '']}>
            {data.access.map(r => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.name}<span style={{ display: 'block', fontSize: T_XS, color: MUTED }}>{r.email}</span></td>
                <td style={tdStyle}>{r.whatsapp ?? '—'}</td>
                <td style={{ ...tdStyle, maxWidth: 260 }}>{r.message ?? '—'}</td>
                <td style={tdStyle}>{fmtDhaka(new Date(r.createdAt).getTime())}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <PrimaryBtn small loading={busy === r.id} onClick={() => decide(r.id, 'approve')}>Approve</PrimaryBtn>
                    <GhostBtn small disabled={busy === r.id} onClick={() => decide(r.id, 'deny')}>Deny</GhostBtn>
                  </span>
                </td>
              </tr>
            ))}
          </SuperTable>
        )}
      </SuperCard>
      <SuperCard title="Upgrade interest (read-only)">
        <p style={{ margin: '0 0 8px', fontSize: T_XS, color: MUTED }}>Students who picked an upgrade option. These have no approve/deny step today.</p>
        {data && data.upgrades.length === 0 && <p style={{ margin: 0, color: MUTED }}>None yet.</p>}
        {data && data.upgrades.length > 0 && (
          <SuperTable head={['Student', 'Option', 'Submitted']}>
            {data.upgrades.map(u => (
              <tr key={u.id}>
                <td style={tdStyle}>{u.name}<span style={{ display: 'block', fontSize: T_XS, color: MUTED }}>{u.email}</span></td>
                <td style={tdStyle}>{u.option}</td>
                <td style={tdStyle}>{fmtDhaka(new Date(u.submittedAt).getTime())}</td>
              </tr>
            ))}
          </SuperTable>
        )}
      </SuperCard>
    </>
  );
}
