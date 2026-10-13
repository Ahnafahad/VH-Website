'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BORDER, MUTED, SLATE, SPIN_CSS, T_SM, T_XS, Toast, Toggle, fmtDhaka } from '../../lms/lms-shared';
import { SuperHeader, SuperCard, superApi } from '../super-ui';

interface Flag { key: string; label: string; hint: string; value: boolean; by: string | null; at: number | null }

export default function SwitchesClient() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setFlags((await superApi<{ flags: Flag[] }>('/api/admin/super/content/flags')).flags); }
    catch (e) { setToast((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function change(f: Flag, value: boolean) {
    try {
      await superApi('/api/admin/super/content/flags', { method: 'PUT', body: { key: f.key, value } });
      setToast(`${f.label}: ${value ? 'on' : 'off'}`);
      await load();
    } catch (e) { setToast((e as Error).message); }
  }

  return (
    <div>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Feature switches" subtitle="Site-wide on/off controls. Every change is audited." />
      <SuperCard>
        {!flags && <p style={{ margin: 0, color: MUTED, fontSize: T_SM }}>Loading…</p>}
        {flags?.map(f => (
          <div key={f.key} style={{ padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
            <Toggle checked={f.value} label={f.label} onChange={v => change(f, v)} />
            <p style={{ margin: '4px 0 0 46px', fontSize: T_SM, color: SLATE }}>{f.hint}</p>
            <p style={{ margin: '2px 0 0 46px', fontSize: T_XS, color: MUTED }}>
              {f.at ? `Last changed ${fmtDhaka(f.at)}${f.by ? ` by ${f.by}` : ''}` : 'Never changed (default)'}
            </p>
          </div>
        ))}
      </SuperCard>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
