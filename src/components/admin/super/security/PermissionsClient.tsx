'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { SPIN_CSS, FieldSelect, FieldLabel, PrimaryBtn, GhostBtn, Toggle, Toast } from '../../lms/lms-shared';
import { MUTED, BORDER, WARN_BG, WARN, T_SM, T_XS } from '../../lms/tokens';
import { SuperHeader, SuperCard, SuperBadge, superApi } from '../super-ui';

interface Section { href: string; label: string; group: string | null }
interface Instructor { id: number; name: string; email: string; override: string[] | null }
interface Data { sections: Section[]; global: string[]; instructors: Instructor[] }

export default function PermissionsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [scope, setScope] = useState('global'); // 'global' or an instructor id
  const [hidden, setHidden] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await superApi<Data>('/api/admin/super/security/permissions')); } catch (e) { setToast((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Reset the working copy whenever the scope or loaded data changes.
  useEffect(() => {
    if (!data) return;
    const inst = data.instructors.find(i => String(i.id) === scope);
    setHidden(scope === 'global' ? data.global : (inst?.override ?? data.global));
  }, [data, scope]);

  const toggle = (href: string, visible: boolean) => setHidden(h => (visible ? h.filter(x => x !== href) : [...h, href]));

  async function save(hiddenList: string[] | null) {
    setSaving(true);
    try {
      await superApi('/api/admin/super/security/permissions', { method: 'PUT', body: { userId: scope === 'global' ? undefined : Number(scope), hidden: hiddenList } });
      setToast('Saved'); await load();
    } catch (e) { setToast((e as Error).message); } finally { setSaving(false); }
  }

  const inst = data?.instructors.find(i => String(i.id) === scope);
  const groups = data ? [...new Set(data.sections.map(s => s.group ?? 'General'))] : [];

  return (
    <div>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Instructor permissions" subtitle="Choose which admin pages instructors can open." />
      <p role="note" style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: 8, background: WARN_BG, color: WARN, fontSize: T_SM }}>
        This hides pages from instructors (they are redirected to Today). It is not API-level authorization: an instructor who knows the underlying API address can still call it.
      </p>

      <SuperCard>
        <FieldLabel>Applies to</FieldLabel>
        <FieldSelect value={scope} onChange={e => setScope(e.target.value)}>
          <option value="global">All instructors (default)</option>
          {data?.instructors.map(i => <option key={i.id} value={i.id}>{i.name}{i.override ? ' (custom)' : ''}</option>)}
        </FieldSelect>
        {inst && <p style={{ margin: '8px 0 0', fontSize: T_XS, color: MUTED }}>{inst.override ? 'This instructor has their own list; it replaces the default.' : 'Using the default list. Saving creates a custom list for this instructor.'}</p>}
      </SuperCard>

      <SuperCard title="Visible pages" action={<SuperBadge tone="neutral">{hidden.length} hidden</SuperBadge>}>
        {groups.map(g => (
          <div key={g} style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 6px', fontSize: T_XS, fontWeight: 700, letterSpacing: '0.08em', color: MUTED }}>{g.toUpperCase()}</p>
            {data!.sections.filter(s => (s.group ?? 'General') === g).map(s => (
              <div key={s.href} style={{ padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                <Toggle checked={!hidden.includes(s.href)} onChange={v => toggle(s.href, v)} label={`${s.label}  ·  ${s.href}`} />
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <PrimaryBtn onClick={() => void save(hidden)} loading={saving}>Save</PrimaryBtn>
          {scope !== 'global' && inst?.override && <GhostBtn onClick={() => void save(null)} disabled={saving}>Remove custom list</GhostBtn>}
        </div>
      </SuperCard>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
