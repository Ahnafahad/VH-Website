'use client';

import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import {
  FieldInput, FieldLabel, FieldSelect, FieldTextarea, PageHeader,
  RED, SLATE, MUTED, BORDER, SURFACE, BEIGE, R_MD,
} from './lms-shared';
import type {
  OperationalSection, InstructorReport, FinancialEntryRecord, ExtraClassRecord,
} from '@/lib/lms/operations';

const SECTIONS: { key: OperationalSection; label: string }[] = [
  { key: 'instructors', label: 'Instructor Classes' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'income', label: 'Other Income' },
  { key: 'extra-classes', label: 'Extra Classes' },
];

interface SectionData {
  report?: InstructorReport;
  entries?: FinancialEntryRecord[];
  classes?: ExtraClassRecord[];
  instructors?: { id: number; name: string }[];
}

const money = (minor: number) => new Intl.NumberFormat('en-BD', {
  style: 'currency', currency: 'BDT', minimumFractionDigits: 2,
}).format(minor / 100);
const localDateTime = (iso: string) => new Date(Date.parse(iso) + 6 * 60 * 60 * 1000).toISOString().slice(0, 16);
const today = () => localDateTime(new Date().toISOString()).slice(0, 10);
const displayTime = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

async function loadSection(section: OperationalSection, signal?: AbortSignal): Promise<SectionData> {
  const response = await fetch(`/api/lms/admin/operational/${section}`, { cache: 'no-store', signal });
  const result = await response.json();
  if (!response.ok) throw new Error(response.status === 403 ? 'Admin access required.' : 'Could not load this section. Please retry.');
  return result;
}

function InputField({ label, name, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div><FieldLabel htmlFor={`ops-${name}`}>{label}</FieldLabel><FieldInput id={`ops-${name}`} name={name} {...props} /></div>;
}

export default function OperationalAdminClient() {
  const [section, setSection] = useState<OperationalSection>('instructors');
  const [data, setData] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialEntryRecord | ExtraClassRecord | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    loadSection(section, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load this section. Please retry.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [section, retry]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '');
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const body = section === 'extra-classes' ? {
        instructorId: Number(text('instructorId')), subject: text('subject'),
        startsAt: new Date(`${text('startsAt')}:00+06:00`).toISOString(),
        endsAt: new Date(`${text('endsAt')}:00+06:00`).toISOString(),
        roomNumber: text('roomNumber'), status: text('status'), notes: text('notes'),
      } : {
        date: text('date'), amount: text('amount'), category: text('category'), description: text('description'),
      };
      const response = await fetch(`/api/lms/admin/operational/${section}${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status < 500 ? result.error : 'Could not save this entry. Please retry.');
      setEditorOpen(false);
      setEditing(null);
      setNotice('Entry saved.');
      setData(await loadSection(section));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this entry.');
    } finally {
      setSaving(false);
    }
  }

  const financial = editing && 'amountMinor' in editing ? editing : null;
  const extra = editing && 'roomNumber' in editing ? editing : null;
  const instructors = [...(data?.instructors ?? [])];
  if (extra && !instructors.some(i => i.id === extra.instructorId)) {
    instructors.push({ id: extra.instructorId, name: extra.instructorName ?? 'Unknown instructor' });
  }
  const edit = (record: FinancialEntryRecord | ExtraClassRecord) => {
    setEditing(record); setEditorOpen(true); setError(''); setNotice('');
  };
  const report = data?.report;

  return (
    <div className="ops-admin">
      <style>{`
        .ops-admin { max-width: 1400px; margin: 0 auto; color: ${SLATE}; }
        .ops-admin button { cursor: pointer; font: inherit; border: 1px solid ${BORDER}; border-radius: ${R_MD}px; padding: 9px 14px; background: ${SURFACE}; color: ${SLATE}; }
        .ops-admin button:disabled { opacity: .5; cursor: default; }
        .ops-admin button:focus-visible, .ops-admin input:focus-visible, .ops-admin select:focus-visible, .ops-admin textarea:focus-visible { outline: 2px solid ${RED}; outline-offset: 3px; }
        .ops-admin .ops-primary, .ops-admin button[aria-pressed="true"] { background: ${RED}; border-color: ${RED}; color: white; }
        .ops-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
        .ops-toolbar { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
        .ops-toolbar h2 { margin: 0; font-size: 18px; }
        .ops-panel { border: 1px solid ${BORDER}; border-radius: ${R_MD}px; padding: 20px; margin-bottom: 20px; }
        .ops-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .ops-actions { display: flex; gap: 8px; margin-top: 16px; }
        .ops-table-wrap { overflow-x: auto; border: 1px solid ${BORDER}; border-radius: ${R_MD}px; }
        .ops-admin table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .ops-admin th, .ops-admin td { padding: 12px 14px; border-bottom: 1px solid ${BORDER}; text-align: left; }
        .ops-admin th { white-space: nowrap; background: ${BEIGE}; font-weight: 600; }
        .ops-admin .ops-number { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .ops-admin .ops-sticky { position: sticky; left: 0; background: ${SURFACE}; min-width: 160px; border-right: 1px solid ${BORDER}; }
        .ops-admin thead .ops-sticky { background: ${BEIGE}; }
        .ops-admin .ops-notes { min-width: 160px; max-width: 320px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .ops-hint { color: ${MUTED}; font-size: 13px; }
        .ops-error { color: ${RED}; padding: 12px 0; }
        @media (max-width: 640px) { .ops-fields { grid-template-columns: 1fr; } .ops-panel { padding: 14px; } }
      `}</style>
      <PageHeader title="Operational Admin" subtitle="Instructor history, expenses, other income, and extra classes." />
      <nav className="ops-tabs" aria-label="Operational Admin sections">
        {SECTIONS.map(item => <button key={item.key} type="button" aria-pressed={section === item.key} disabled={saving}
          onClick={() => {
            if (item.key !== section) { setData(null); setLoading(true); setError(''); }
            setSection(item.key); setEditorOpen(false); setEditing(null); setNotice('');
          }}>
          {item.label}
        </button>)}
      </nav>
      <div className="ops-toolbar">
        <h2>{SECTIONS.find(item => item.key === section)?.label}</h2>
        {section !== 'instructors' && data && <button type="button" className="ops-primary" disabled={saving}
          onClick={() => { setEditing(null); setEditorOpen(true); setError(''); setNotice(''); }}>Add entry</button>}
      </div>
      {error && <div role="alert" className="ops-error">{error} <button type="button" disabled={saving} onClick={() => setRetry(n => n + 1)}>Retry loading</button></div>}
      {notice && <p role="status">{notice}</p>}
      {loading && <p role="status" className="ops-hint">Loading…</p>}

      {editorOpen && data && <form key={`${section}-${editing?.id ?? 'new'}`} onSubmit={save} className="ops-panel">
        <h3 style={{ marginTop: 0 }}>{editing ? 'Edit entry' : 'New entry'}</h3>
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="ops-fields">
            {section === 'extra-classes' ? <>
              <div><FieldLabel htmlFor="ops-instructorId">Instructor</FieldLabel>
                <FieldSelect id="ops-instructorId" name="instructorId" defaultValue={extra?.instructorId ?? ''} required>
                  <option value="">Select an instructor</option>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </FieldSelect>
              </div>
              <InputField label="Subject" name="subject" defaultValue={extra?.subject ?? ''} maxLength={120} required />
              <InputField label="Start (Bangladesh time)" name="startsAt" type="datetime-local" defaultValue={extra ? localDateTime(extra.startsAt) : ''} required />
              <InputField label="End (Bangladesh time)" name="endsAt" type="datetime-local" defaultValue={extra ? localDateTime(extra.endsAt) : ''} required />
              <InputField label="Room number" name="roomNumber" defaultValue={extra?.roomNumber ?? ''} maxLength={80} required />
              <div><FieldLabel htmlFor="ops-status">Status</FieldLabel>
                <FieldSelect id="ops-status" name="status" defaultValue={extra?.status ?? 'scheduled'}>
                  <option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                </FieldSelect>
              </div>
              <div><FieldLabel htmlFor="ops-notes">Notes</FieldLabel><FieldTextarea id="ops-notes" name="notes" maxLength={2000} defaultValue={extra?.notes ?? ''} /></div>
            </> : <>
              <InputField label="Date" name="date" type="date" defaultValue={financial?.date ?? today()} required />
              <InputField label="Amount (BDT)" name="amount" type="number" step="0.01" min="0.01" max="9999999999.99" defaultValue={financial ? (financial.amountMinor / 100).toFixed(2) : ''} required />
              <InputField label={section === 'expenses' ? 'Category' : 'Source'} name="category" defaultValue={financial?.category ?? ''} maxLength={120} required />
              <div><FieldLabel htmlFor="ops-description">Description</FieldLabel><FieldTextarea id="ops-description" name="description" maxLength={2000} defaultValue={financial?.description ?? ''} /></div>
            </>}
          </div>
          <div className="ops-actions"><button className="ops-primary" type="submit">{saving ? 'Saving…' : 'Save entry'}</button>
            <button type="button" onClick={() => { setEditorOpen(false); setEditing(null); }}>Cancel</button></div>
        </fieldset>
      </form>}

      {report && <>
        <p className="ops-hint">Completed LMS classes through today, grouped by Bangladesh calendar month. All months from the first completed class are shown. Extra classes are recorded separately.</p>
        {report.instructors.length === 0 ? <p className="ops-hint">No instructor records yet.</p> : <div className="ops-table-wrap" tabIndex={0} role="region" aria-label="Instructor class counts by month">
          <table><thead><tr><th scope="col" className="ops-sticky">Instructor</th>
            {report.months.map(month => <th scope="col" key={month.key} className="ops-number">{month.label}</th>)}
            <th scope="col" className="ops-number">Total</th></tr></thead>
            <tbody>{report.instructors.map(i => <tr key={i.id ?? 'unassigned'}><th scope="row" className="ops-sticky">{i.name}</th>
              {i.counts.map((count, index) => <td key={report.months[index].key} className="ops-number">{count}</td>)}
              <td className="ops-number"><strong>{i.total}</strong></td></tr>)}</tbody>
          </table>
        </div>}
      </>}

      {data?.entries && (data.entries.length === 0 ? <p className="ops-hint">No {section === 'expenses' ? 'expenses' : 'other income'} recorded yet.</p> : <>
        <p className="ops-hint">Total: {money(data.entries.reduce((sum, entry) => sum + entry.amountMinor, 0))}</p>
        <div className="ops-table-wrap" tabIndex={0} role="region" aria-label={section === 'expenses' ? 'Expenses' : 'Other income'}>
          <table><thead><tr><th scope="col">Date</th><th scope="col">{section === 'expenses' ? 'Category' : 'Source'}</th><th scope="col">Description</th><th scope="col" className="ops-number">Amount (BDT)</th><th scope="col">Actions</th></tr></thead>
            <tbody>{data.entries.map(entry => <tr key={entry.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{entry.date}</td><td>{entry.category}</td><td className="ops-notes">{entry.description || '—'}</td><td className="ops-number">{money(entry.amountMinor)}</td>
              <td><button type="button" disabled={saving} aria-label={`Edit ${entry.category} on ${entry.date}`} onClick={() => edit(entry)}>Edit</button></td>
            </tr>)}</tbody></table>
        </div>
      </>)}

      {data?.classes && <>
        <p className="ops-hint">Internal extra-class records. All times are Bangladesh time.</p>
        {data.classes.length === 0 ? <p className="ops-hint">No extra classes recorded yet.</p> : <div className="ops-table-wrap" tabIndex={0} role="region" aria-label="Extra classes">
          <table><thead><tr>{['Instructor', 'Subject', 'Start', 'End', 'Room', 'Status', 'Notes', 'Actions'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{data.classes.map(record => <tr key={record.id}>
              <td>{record.instructorName ?? 'Unknown instructor'}</td><td>{record.subject}</td><td style={{ whiteSpace: 'nowrap' }}>{displayTime(record.startsAt)}</td><td style={{ whiteSpace: 'nowrap' }}>{displayTime(record.endsAt)}</td>
              <td>{record.roomNumber}</td><td>{record.status}</td><td className="ops-notes">{record.notes || '—'}</td>
              <td><button type="button" disabled={saving} aria-label={`Edit ${record.subject} extra class`} onClick={() => edit(record)}>Edit</button></td>
            </tr>)}</tbody></table>
        </div>}
      </>}
    </div>
  );
}
