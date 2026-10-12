'use client';

/**
 * Create / edit an essay series: name, general instructions, essay date, the
 * essays (each with its own prompt and maximum mark; the series total is their
 * sum), audience (programme + batch) and the submission deadline (Dhaka time).
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  BORDER, FieldInput, FieldLabel, FieldSelect, FieldTextarea, FormActions, GhostBtn, IconBtn, MUTED, Modal, PrimaryBtn, RED, SLATE, T_SM,
  dhakaLocalToISO, epochToDhakaLocal,
} from '@/components/admin/lms/lms-shared';
import { MAX_ESSAYS, seriesMax, type EssayPrompt } from '@/lib/essays/prompts';

export interface SeriesFormValue {
  id?: number;
  title: string;
  prompt: string;
  essayDate: string | null;
  essays: EssayPrompt[];
  product: string;
  batch: string | null;
  deadline: string; // ISO
}

interface BatchRow { id: number; name: string; product: string; status: string }

const PRODUCTS = [
  { key: 'iba', label: 'IBA' },
  { key: 'fbs', label: 'FBS' },
  { key: 'fbs_detailed', label: 'FBS Detailed' },
];

export function blankSeries(): SeriesFormValue {
  return {
    title: '',
    prompt: '',
    essayDate: null,
    essays: [{ prompt: '', max: 10 }],
    product: 'iba',
    batch: null,
    deadline: new Date(Date.now() + 3 * 3_600_000).toISOString(),
  };
}

export default function SeriesEditor({ open, initial, onClose, onSaved }: {
  open: boolean;
  initial: SeriesFormValue | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState<SeriesFormValue>(initial ?? blankSeries());
  const [deadlineLocal, setDeadlineLocal] = useState('');
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const start = initial ?? blankSeries();
    setV(start);
    setDeadlineLocal(epochToDhakaLocal(new Date(start.deadline).getTime()));
    setError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/admin/batches').then(r => (r.ok ? r.json() : { batches: [] })).then(j => setBatches(j.batches ?? [])).catch(() => {});
  }, [open]);

  const total = seriesMax(v.essays.map(e => ({ ...e, max: Number(e.max) || 0 })));
  const productBatches = batches.filter(b => b.product === v.product && (b.status === 'active' || b.name === v.batch));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { ...v, deadline: dhakaLocalToISO(deadlineLocal), essays: v.essays.map(e => ({ ...e, max: Number(e.max) })) };
      const res = await fetch(v.id ? `/api/admin/essays/series/${v.id}` : '/api/admin/essays/series', {
        method: v.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? 'Could not save'); return; }
      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const setEssay = (i: number, patch: Partial<EssayPrompt>) =>
    setV(prev => ({ ...prev, essays: prev.essays.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  return (
    <Modal open={open} onClose={onClose} title={v.id ? 'Edit essay series' : 'New essay series'} width={620}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <FieldLabel htmlFor="es-title">Series name</FieldLabel>
          <FieldInput id="es-title" value={v.title} placeholder="Essay Series 1" onChange={e => setV({ ...v, title: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="es-prompt">General instructions (optional)</FieldLabel>
          <FieldTextarea id="es-prompt" rows={2} value={v.prompt} placeholder="Shown above every essay in this series" onChange={e => setV({ ...v, prompt: e.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor="es-date">Essay date</FieldLabel>
          <FieldInput id="es-date" type="date" value={v.essayDate ?? ''} onChange={e => setV({ ...v, essayDate: e.target.value || null })} />
        </div>

        <div>
          <FieldLabel>Essays (each has its own prompt and maximum mark)</FieldLabel>
          <div style={{ display: 'grid', gap: 10 }}>
            {v.essays.map((e, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 96px 40px', gap: 8, alignItems: 'start' }}>
                <FieldTextarea aria-label={`Essay ${i + 1} prompt`} rows={2} value={e.prompt} placeholder={`Essay ${i + 1} prompt`} onChange={ev => setEssay(i, { prompt: ev.target.value })} />
                <FieldInput aria-label={`Essay ${i + 1} maximum mark`} type="number" min={1} step={0.5} value={e.max} onChange={ev => setEssay(i, { max: Number(ev.target.value) })} />
                <IconBtn icon={Trash2} label={`Remove essay ${i + 1}`} onClick={() => setV({ ...v, essays: v.essays.filter((_, j) => j !== i) })} disabled={v.essays.length <= 1} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <GhostBtn small onClick={() => setV({ ...v, essays: [...v.essays, { prompt: '', max: 10 }] })} disabled={v.essays.length >= MAX_ESSAYS}><Plus size={12} aria-hidden /> Add essay</GhostBtn>
            <span style={{ fontSize: T_SM, color: SLATE, fontWeight: 700 }}>Series total: {total}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel htmlFor="es-product">Programme</FieldLabel>
            <FieldSelect id="es-product" value={v.product} onChange={e => setV({ ...v, product: e.target.value, batch: null })}>
              {PRODUCTS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </FieldSelect>
          </div>
          <div>
            <FieldLabel htmlFor="es-batch">Batch</FieldLabel>
            <FieldSelect id="es-batch" value={v.batch ?? ''} onChange={e => setV({ ...v, batch: e.target.value || null })}>
              <option value="">All batches</option>
              {productBatches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </FieldSelect>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="es-deadline">Submission deadline (Dhaka time)</FieldLabel>
          <FieldInput id="es-deadline" type="datetime-local" value={deadlineLocal} onChange={e => setDeadlineLocal(e.target.value)} />
          <p style={{ margin: '6px 0 0', fontSize: T_SM, color: MUTED }}>
            Late submissions are blocked. Results publish automatically once the deadline has passed and every script is graded or rejected.
          </p>
        </div>

        {error && <p style={{ margin: 0, fontSize: T_SM, color: RED, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>{error}</p>}
        <FormActions>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={save} loading={saving} disabled={!v.title.trim() || !deadlineLocal}>{v.id ? 'Save changes' : 'Create series'}</PrimaryBtn>
        </FormActions>
      </div>
    </Modal>
  );
}
