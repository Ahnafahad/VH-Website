'use client';
import React, { useState } from 'react';
import { MUTED, T_SM, T_XS, GhostBtn, Toggle, fmtDhaka } from '../../lms/lms-shared';
import { SuperCard, SuperBadge, SuperTable, TypedConfirm, tdStyle, superApi } from '../super-ui';
import type { CronInfo } from '@/lib/super/ops/crons';
import { useOpsData } from './use-ops-data';

export default function CronsTab({ toast }: { toast: (m: string) => void }) {
  const { data, error, reload } = useOpsData<{ crons: CronInfo[] }>('/api/admin/super/ops/crons');
  const [runTarget, setRunTarget] = useState<CronInfo | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(name: string, action: 'pause' | 'resume' | 'run') {
    setBusy(true);
    try {
      const r = await superApi<{ status?: number; body?: unknown }>('/api/admin/super/ops/crons', { method: 'POST', body: { name, action } });
      toast(action === 'run' ? `${name}: HTTP ${r.status} ${JSON.stringify(r.body ?? {}).slice(0, 120)}` : `${name} ${action}d`);
      setRunTarget(null);
      await reload();
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  }

  if (error) return <SuperCard><p style={{ color: MUTED }}>{error}</p></SuperCard>;
  return (
    <SuperCard title="Cron jobs">
      <p style={{ margin: '0 0 12px', fontSize: T_SM, color: MUTED }}>
        Schedules are read from vercel.json (UTC). A paused cron returns immediately without running. Last-run data starts appearing after the first run following this deploy.
      </p>
      <SuperTable head={['Job', 'Schedule (UTC)', 'Last run', 'Paused', '']}>
        {(data?.crons ?? []).map(c => (
          <tr key={c.name}>
            <td style={tdStyle}><strong>{c.name}</strong><div style={{ fontSize: T_XS, color: MUTED }}>{c.description}</div></td>
            <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{c.schedules.map(s => <div key={s}>{s}</div>)}</td>
            <td style={tdStyle}>
              {c.lastRun ? (
                <>
                  <SuperBadge tone={c.lastRun.ok ? 'ok' : 'bad'}>{c.lastRun.ok ? 'ok' : 'failed'}</SuperBadge>
                  <div style={{ fontSize: T_XS, color: MUTED }}>{fmtDhaka(Date.parse(c.lastRun.startedAt))} · {(c.lastRun.durationMs / 1000).toFixed(1)}s</div>
                  {c.lastRun.error && <div style={{ fontSize: T_XS }}>{c.lastRun.error}</div>}
                </>
              ) : <span style={{ color: MUTED }}>no data yet</span>}
            </td>
            <td style={tdStyle}><Toggle checked={c.paused} label="" ariaLabel={`Pause ${c.name}`} onChange={v => act(c.name, v ? 'pause' : 'resume')} /></td>
            <td style={tdStyle}><GhostBtn small onClick={() => setRunTarget(c)} disabled={busy}>Run now</GhostBtn></td>
          </tr>
        ))}
      </SuperTable>
      <TypedConfirm
        open={!!runTarget} title={`Run ${runTarget?.name} now?`} phrase={runTarget?.name ?? ''} confirmLabel="Run now" loading={busy}
        message="This executes the real job immediately. Mass-email jobs will send real emails."
        onConfirm={() => runTarget && act(runTarget.name, 'run')} onCancel={() => setRunTarget(null)}
      />
    </SuperCard>
  );
}
