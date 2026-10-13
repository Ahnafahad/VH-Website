'use client';
import React, { useState } from 'react';
import { MUTED, T_SM, T_XS, GhostBtn, PrimaryBtn, FieldInput, FieldLabel } from '../../lms/lms-shared';
import { SuperCard, StatTile, StatGrid, SuperTable, tdStyle, superApi } from '../super-ui';
import type { StorageReport } from '@/lib/super/ops/storage';
import { evaluateThreshold, type Thresholds } from '@/lib/super/ops/thresholds-core';
import { useOpsData } from './use-ops-data';

const GB = 1024 ** 3;
const fmtBytes = (n: number) => (n >= GB ? `${(n / GB).toFixed(2)} GB` : `${(n / 1024 ** 2).toFixed(1)} MB`);
const LABELS: Record<keyof Thresholds, [string, number]> = {
  tursoRows: ['Turso rows', 1], tursoBytes: ['Turso size (GB)', GB], r2Bytes: ['R2 size (GB)', GB], r2Objects: ['R2 objects', 1],
};

export default function StorageTab({ toast }: { toast: (m: string) => void }) {
  const { data, error, reload } = useOpsData<{ report: StorageReport; thresholds: Thresholds }>('/api/admin/super/ops/storage');
  const [draft, setDraft] = useState<Thresholds | null>(null);
  const [saving, setSaving] = useState(false);

  if (error) return <SuperCard><p style={{ color: MUTED }}>{error}</p></SuperCard>;
  if (!data) return <p style={{ color: MUTED }}>Loading…</p>;
  const { report: r, thresholds: t } = data;

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await superApi('/api/admin/super/ops/storage', { method: 'PUT', body: draft });
      toast('Thresholds saved'); setDraft(null); await reload();
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }
  const edit = draft ?? t;
  const setLimit = (k: keyof Thresholds, f: 'warn' | 'bad', v: string) =>
    setDraft({ ...edit, [k]: { ...edit[k], [f]: Math.max(0, Number(v) || 0) * LABELS[k][1] } });

  return (
    <>
      <StatGrid>
        <StatTile label="Turso rows" value={r.totalRows.toLocaleString()} tone={evaluateThreshold(r.totalRows, t.tursoRows)} hint={`${r.tables.length} tables${r.tablesCapped ? ' (capped)' : ''}`} />
        <StatTile label="Turso size" value={r.turso.bytes != null ? fmtBytes(r.turso.bytes) : 'n/a'} tone={evaluateThreshold(r.turso.bytes, t.tursoBytes)}
          hint={r.turso.error ?? (r.turso.configured ? undefined : 'set TURSO_PLATFORM_TOKEN, TURSO_ORG, TURSO_DB_NAME')} />
        <StatTile label="R2 recordings" value={r.r2.bytes != null ? fmtBytes(r.r2.bytes) : 'n/a'} tone={evaluateThreshold(r.r2.bytes, t.r2Bytes)}
          hint={r.r2.error ?? (r.r2.configured ? `${r.r2.objects?.toLocaleString()} objects${r.r2.capped ? ' (sampled: first 20k)' : ''}` : 'R2 not configured')} />
        <StatTile label="R2 growth / day" value={r.r2.growthBytesPerDay != null ? fmtBytes(Math.max(0, r.r2.growthBytesPerDay)) : 'n/a'}
          hint="Recordings are never auto-deleted; needs 24h+ of snapshots" />
      </StatGrid>

      <SuperCard title="Other usage">
        <p style={{ margin: 0, fontSize: T_SM }}>
          <strong>Resend (last 100 emails):</strong>{' '}
          {r.resend.last100 ? Object.entries(r.resend.last100).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none' : (r.resend.error ?? 'RESEND_API_KEY not set')}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: T_SM }}><strong>AI spend (Gemini / DeepSeek):</strong> not tracked (no usage log exists).</p>
      </SuperCard>

      <SuperCard title="Alert thresholds" action={draft ? <PrimaryBtn small loading={saving} onClick={save}>Save</PrimaryBtn> : undefined}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {(Object.keys(LABELS) as (keyof Thresholds)[]).map(k => (
            <div key={k}>
              <FieldLabel>{LABELS[k][0]}</FieldLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                <FieldInput type="number" min={0} aria-label={`${LABELS[k][0]} warn`} value={+(edit[k].warn / LABELS[k][1]).toFixed(2)} onChange={e => setLimit(k, 'warn', e.target.value)} />
                <FieldInput type="number" min={0} aria-label={`${LABELS[k][0]} bad`} value={+(edit[k].bad / LABELS[k][1]).toFixed(2)} onChange={e => setLimit(k, 'bad', e.target.value)} />
              </div>
              <span style={{ fontSize: T_XS, color: MUTED }}>warn / bad</span>
            </div>
          ))}
        </div>
        {draft && <div style={{ marginTop: 10 }}><GhostBtn small onClick={() => setDraft(null)}>Discard</GhostBtn></div>}
      </SuperCard>

      <SuperCard title="Rows per table" action={<GhostBtn small onClick={reload}>Refresh</GhostBtn>}>
        <SuperTable head={['Table', 'Rows']}>
          {r.tables.map(x => <tr key={x.name}><td style={tdStyle}>{x.name}</td><td style={tdStyle}>{x.rows.toLocaleString()}</td></tr>)}
        </SuperTable>
        <p style={{ margin: '8px 0 0', fontSize: T_XS, color: MUTED }}>Cached for 60 seconds.</p>
      </SuperCard>
    </>
  );
}
