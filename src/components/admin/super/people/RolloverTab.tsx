'use client';

import { useState } from 'react';
import { FieldInput, FieldLabel, FieldSelect, GhostBtn, PrimaryBtn, Toggle, MUTED, T_SM } from '../../lms/lms-shared';
import { SuperCard, SuperTable, StatGrid, StatTile, TypedConfirm, tdStyle, superApi } from '../super-ui';

const API = '/api/admin/super/people/students/rollover';
interface Student { id: number; name: string; email: string; status: string; batch: string | null; products: string[] }
interface Ctx { batchRows: { name: string; product: string; status: string }[]; students: Student[] }
interface Plan { createBatch: boolean; reviveBatch: boolean; archiveOld: boolean; repoint: number[]; alreadyThere: number[]; grantAccess: number[]; skipped: { id: number; reason: string }[] }

export default function RolloverTab({ notify }: { notify: (m: string) => void }) {
  const [product, setProduct] = useState('iba');
  const [oldBatch, setOldBatch] = useState('');
  const [newBatch, setNewBatch] = useState('');
  const [archiveOld, setArchiveOld] = useState(false);
  const [copyAccess, setCopyAccess] = useState(true);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [plan, setPlan] = useState<Plan | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const c = await superApi<Ctx>(`${API}?product=${product}&oldBatch=${encodeURIComponent(oldBatch.trim())}`);
      setCtx(c); setSel(new Set(c.students.filter(s => s.status === 'active').map(s => s.id))); setPlan(null);
    } catch (e) { notify((e as Error).message); }
    finally { setBusy(false); }
  }

  const body = (mode: 'preview' | 'apply') => ({
    mode, confirm: mode === 'apply' ? 'ROLLOVER' : undefined, product, oldBatch: oldBatch.trim() || null,
    newBatch: newBatch.trim(), archiveOld, copyAccess, userIds: [...sel],
  });

  async function run(mode: 'preview' | 'apply') {
    setBusy(true);
    try {
      const r = await superApi<{ plan: Plan }>(API, { method: 'POST', body: body(mode) });
      setPlan(r.plan);
      if (mode === 'apply') { notify(`Rolled over ${r.plan.repoint.length} students`); setConfirming(false); setCtx(null); setPlan(null); }
    } catch (e) { notify((e as Error).message); setConfirming(false); }
    finally { setBusy(false); }
  }

  const known = [...new Set((ctx?.batchRows ?? []).filter(b => b.product === product).map(b => b.name))];
  const toggle = (id: number) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <SuperCard title="Start a new academic year">
        <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          <div><FieldLabel>Product</FieldLabel>
            <FieldSelect value={product} onChange={e => { setProduct(e.target.value); setCtx(null); setPlan(null); }}>
              <option value="iba">iba</option><option value="fbs">fbs</option><option value="fbs_detailed">fbs_detailed</option>
            </FieldSelect></div>
          <div><FieldLabel htmlFor="ro-old">Current batch (students to move)</FieldLabel><FieldInput id="ro-old" value={oldBatch} onChange={e => setOldBatch(e.target.value)} placeholder="e.g. 2026-27" /></div>
          <div><FieldLabel htmlFor="ro-new">New batch name</FieldLabel><FieldInput id="ro-new" value={newBatch} onChange={e => { setNewBatch(e.target.value); setPlan(null); }} placeholder="e.g. 2027-28" /></div>
          <Toggle checked={archiveOld} onChange={v => { setArchiveOld(v); setPlan(null); }} label="Archive the old batch" />
          <Toggle checked={copyAccess} onChange={v => { setCopyAccess(v); setPlan(null); }} label="Give selected students this product's access" />
          <PrimaryBtn small disabled={busy || !oldBatch.trim() || !newBatch.trim()} onClick={() => void load()}>Load students</PrimaryBtn>
        </div>
        {known.length > 0 && <p style={{ color: MUTED, fontSize: T_SM }}>Existing {product} batches: {known.join(', ')}</p>}
      </SuperCard>

      {ctx && (
        <SuperCard title={`Students in ${oldBatch} (${sel.size} of ${ctx.students.length} selected)`}
          action={<GhostBtn small onClick={() => setSel(sel.size ? new Set() : new Set(ctx.students.filter(s => s.status === 'active').map(s => s.id)))}>{sel.size ? 'Clear' : 'Select all'}</GhostBtn>}>
          <SuperTable head={['', 'Student', 'Status', 'Products']}>
            {ctx.students.map(s => (
              <tr key={s.id}>
                <td style={tdStyle}><input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${s.name}`} /></td>
                <td style={tdStyle}>{s.name}<div style={{ color: MUTED, fontSize: T_SM }}>{s.email}</div></td>
                <td style={tdStyle}>{s.status}</td>
                <td style={tdStyle}>{s.products.join(', ') || 'none'}</td>
              </tr>
            ))}
          </SuperTable>
          <div style={{ marginTop: 12 }}>
            <PrimaryBtn disabled={busy || sel.size === 0} onClick={() => void run('preview')}>Preview (dry run)</PrimaryBtn>
          </div>
        </SuperCard>
      )}

      {plan && (
        <SuperCard title="Dry run">
          <StatGrid>
            <StatTile label="Re-pointed" value={plan.repoint.length} />
            <StatTile label="Already in new batch" value={plan.alreadyThere.length} />
            <StatTile label="Access granted" value={plan.grantAccess.length} />
            <StatTile label="Skipped" value={plan.skipped.length} tone={plan.skipped.length ? 'warn' : undefined} />
          </StatGrid>
          <ul style={{ fontSize: T_SM, paddingLeft: 18 }}>
            <li>{plan.createBatch ? `Create batch ${newBatch} (${product})` : plan.reviveBatch ? `Reactivate archived batch ${newBatch}` : `Batch ${newBatch} already exists`}</li>
            <li>{plan.archiveOld ? `Archive ${oldBatch}` : 'Old batch left as is'}</li>
            {plan.skipped.map(s => <li key={s.id}>Skipping user #{s.id}: {s.reason}</li>)}
          </ul>
          <PrimaryBtn disabled={busy} onClick={() => setConfirming(true)}>Apply rollover...</PrimaryBtn>
        </SuperCard>
      )}

      <TypedConfirm open={confirming} title="Apply batch rollover"
        message={`Move ${plan?.repoint.length ?? 0} students from ${oldBatch} to ${newBatch}.`}
        phrase="ROLLOVER" confirmLabel="Apply" loading={busy} onCancel={() => setConfirming(false)} onConfirm={() => void run('apply')} />
    </>
  );
}
