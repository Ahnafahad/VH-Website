'use client';

import React, { useEffect, useState } from 'react';
import { SPIN_CSS, FieldTextarea, FieldInput, GhostBtn, PrimaryBtn, Toast } from '../../lms/lms-shared';
import { MUTED, T_SM, T_XS, BORDER, SURFACE_ALT } from '../../lms/tokens';
import { csvRow } from '@/lib/super/data/csv';
import { SuperHeader, SuperCard, SuperTable, SuperBadge, tdStyle, superApi } from '../super-ui';

interface Result { columns: string[]; rows: unknown[][]; truncated: boolean; ms: number; redacted: string[] }
interface TableDef { name: string; columns: { name: string; type: string }[] }

const show = (v: unknown) => (v === null ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function SqlConsole() {
  const [query, setQuery] = useState('SELECT id, email, role, status FROM users ORDER BY id DESC LIMIT 20');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [tables, setTables] = useState<TableDef[]>([]);
  const [filter, setFilter] = useState('');
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    superApi<{ tables: TableDef[] }>('/api/admin/super/data/sql/schema').then(d => setTables(d.tables)).catch(e => setToast((e as Error).message));
  }, []);

  async function run() {
    setRunning(true); setError(null);
    try { setResult(await superApi<Result>('/api/admin/super/data/sql', { method: 'POST', body: { query } })); }
    catch (e) { setError((e as Error).message); setResult(null); }
    setRunning(false);
  }

  async function copyCsv() {
    if (!result) return;
    const text = csvRow(result.columns) + result.rows.map(r => csvRow(r)).join('');
    try { await navigator.clipboard.writeText(text); setToast('CSV copied'); } catch { setToast('Copy failed'); }
  }

  const visible = tables.filter(t => t.name.includes(filter.trim().toLowerCase()));

  return (
    <div>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="SQL console" subtitle="Read-only. One SELECT / WITH / EXPLAIN / PRAGMA table_info per run, 500 rows max. Every query is audit-logged." />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <aside style={{ flex: '1 1 220px', maxWidth: 300, minWidth: 0 }}>
          <SuperCard title="Tables">
            <FieldInput placeholder="Filter tables" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter tables" />
            <div style={{ maxHeight: 360, overflowY: 'auto', marginTop: 8 }}>
              {visible.map(t => (
                <div key={t.name}>
                  <button onClick={() => setOpenTable(openTable === t.name ? null : t.name)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 2px', background: 'none', border: 'none', cursor: 'pointer', fontSize: T_SM, wordBreak: 'break-all' }}>
                    {openTable === t.name ? '▾' : '▸'} {t.name}
                  </button>
                  {openTable === t.name && (
                    <ul style={{ margin: '0 0 6px 14px', padding: 0, listStyle: 'none', fontSize: T_XS, color: MUTED }}>
                      {t.columns.map(c => <li key={c.name}>{c.name} <span style={{ opacity: 0.7 }}>{c.type}</span></li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </SuperCard>
        </aside>

        <div style={{ flex: '3 1 360px', minWidth: 0 }}>
          <SuperCard>
            <FieldTextarea value={query} onChange={e => setQuery(e.target.value)} rows={7} spellCheck={false} aria-label="SQL query"
              style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: T_SM }}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void run(); }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <PrimaryBtn onClick={run} loading={running}>Run (Ctrl+Enter)</PrimaryBtn>
              <GhostBtn onClick={copyCsv} disabled={!result}>Copy CSV</GhostBtn>
              {result && <span style={{ fontSize: T_XS, color: MUTED }}>{result.rows.length} row(s) in {result.ms} ms{result.truncated ? ' (capped at 500)' : ''}</span>}
            </div>
          </SuperCard>

          {error && <SuperCard tone="danger"><p style={{ margin: 0, fontSize: T_SM, whiteSpace: 'pre-wrap' }}>{error}</p></SuperCard>}

          {result && (
            <SuperCard>
              {result.redacted.length > 0 && <p style={{ margin: '0 0 8px' }}><SuperBadge tone="gold">redacted: {result.redacted.join(', ')}</SuperBadge></p>}
              <SuperTable head={result.columns}>
                {result.rows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 ? SURFACE_ALT : undefined }}>
                    {r.map((v, j) => (
                      <td key={j} style={{ ...tdStyle, borderBottomColor: BORDER, maxWidth: 320, overflowWrap: 'anywhere', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: T_XS }}>{show(v)}</td>
                    ))}
                  </tr>
                ))}
              </SuperTable>
              {result.rows.length === 0 && <p style={{ margin: 0, color: MUTED }}>No rows.</p>}
            </SuperCard>
          )}
        </div>
      </div>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
