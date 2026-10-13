'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, Paperclip, Plus, Search, X } from 'lucide-react';
import {
  ConfirmDialog, FieldInput, FieldSelect, Modal, Toast, useDialogBehaviour,
  RED, SLATE, MUTED, BORDER, BORDER_FIELD, SURFACE, SURFACE_ALT, BG, OK, OK_BG, WARN, WARN_BG, INFO, INFO_BG,
  R_SM, R_MD, SHADOW_LG, FONT_HEADING, Z_MODAL_BACKDROP, Z_MODAL,
} from './lms-shared';
import { uploadToR2 } from '@/lib/lms/upload-client';
import {
  expenseCategories, expenseProducts, paymentMethods, type FinancialEntryRecord,
} from '@/lib/lms/operations';
import {
  categoryTotals, dhakaToday, filterEntries, groupByDay, groupByPerson, monthKpis, needsReimbursement, roleLabel, shiftMonth, sumMinor,
  type PersonGroup,
} from '@/lib/lms/expense-report';

interface TrackerData {
  entries: FinancialEntryRecord[];
  payers: { id: number; name: string; role: string }[];
  classes: { id: number; label: string }[];
}

const money = (minor: number) => new Intl.NumberFormat('en-BD', {
  style: 'currency', currency: 'BDT', minimumFractionDigits: 2,
}).format(minor / 100);
const dayLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC',
});
const shortDate = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}`;
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});
const voucherNo = (id: number) => `V-${String(id).padStart(4, '0')}`;
const isLink = (ref: string) => ref.startsWith('https://');
const payerText = (e: Pick<FinancialEntryRecord, 'paidBy' | 'paidByName' | 'paidByRole'>) =>
  e.paidBy === null ? 'Organization' : `${e.paidByName ?? 'Unknown'}${e.paidByRole ? `, ${roleLabel(e.paidByRole)}` : ''}`;
const fileNameOf = (ref: string) => ref.replace(/^expense-receipts\/\d+-/, '');

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(response.status === 403 ? 'Admin access required.'
      : response.status < 500 && result.error ? result.error : 'Something went wrong. Please retry.');
  }
  return result as T;
}

interface FormState {
  date: string; paidBy: string; amount: string; payee: string; description: string; category: string;
  paymentMethod: string; referenceNo: string; product: string; batch: string; classSessionId: string;
  location: string; tags: string; receiptKey: string; reimbursedAt: string;
}

const blankForm = (): FormState => ({
  date: dhakaToday(), paidBy: '', amount: '', payee: '', description: '', category: '', paymentMethod: '',
  referenceNo: '', product: '', batch: '', classSessionId: '', location: '', tags: '', receiptKey: '', reimbursedAt: '',
});

const formFrom = (e: FinancialEntryRecord): FormState => ({
  date: e.date, paidBy: e.paidBy === null ? '' : String(e.paidBy), amount: (e.amountMinor / 100).toFixed(2),
  payee: e.payee ?? '', description: e.description, category: e.category, paymentMethod: e.paymentMethod ?? '',
  referenceNo: e.referenceNo ?? '', product: e.product ?? '', batch: e.batch ?? '',
  classSessionId: e.classSessionId === null ? '' : String(e.classSessionId), location: e.location ?? '',
  tags: e.tags.join(', '), receiptKey: e.receiptKey ?? '', reimbursedAt: e.reimbursedAt ?? '',
});

function formBody(f: FormState) {
  return {
    date: f.date, amount: f.amount.replace(/[,\s৳]/g, ''), category: f.category, description: f.description,
    paidBy: f.paidBy ? Number(f.paidBy) : null, reimbursedAt: f.paidBy && f.reimbursedAt ? f.reimbursedAt : null,
    payee: f.payee, paymentMethod: f.paymentMethod || null, referenceNo: f.referenceNo, receiptKey: f.receiptKey || null,
    product: f.product || null, batch: f.batch, classSessionId: f.classSessionId ? Number(f.classSessionId) : null,
    location: f.location, tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
  };
}

type Payer = Pick<FinancialEntryRecord, 'paidBy' | 'reimbursedAt'>;
const stampText = (e: Payer) => (e.paidBy === null ? 'Paid' : e.reimbursedAt ? 'Reimbursed' : 'To reimburse');
const stampStyle = (e: Payer) => {
  const [fg, bg] = e.paidBy === null ? [OK, OK_BG] : e.reimbursedAt ? [INFO, INFO_BG] : [WARN, WARN_BG];
  return { color: fg, borderColor: fg, background: bg };
};
function Stamp({ entry }: { entry: Payer }) {
  return <span className="exp-stamp" style={stampStyle(entry)}>{stampText(entry)}</span>;
}

export default function ExpensesTracker() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(() => dhakaToday().slice(0, 7));
  const [category, setCategory] = useState('');
  const [owedOnly, setOwedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'all' | 'people'>('all');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [confirmPerson, setConfirmPerson] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [form, setForm] = useState<{ editing: FinancialEntryRecord | null } | null>(null);
  const [deleting, setDeleting] = useState<FinancialEntryRecord | null>(null);

  const say = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(current => (current === message ? null : current)), 3000);
  };
  const load = useCallback(async () => {
    try {
      setData(await request<TrackerData>('/api/lms/admin/operational/expenses'));
      setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load expenses.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const monthEntries = useMemo(() => filterEntries(entries, { month }), [entries, month]);
  const shown = useMemo(
    () => filterEntries(monthEntries, { category, unreimbursed: owedOnly, q: query }), [monthEntries, category, owedOnly, query]);
  const kpis = useMemo(() => monthKpis(entries, month), [entries, month]);
  const bars = useMemo(() => categoryTotals(monthEntries), [monthEntries]);
  const days = useMemo(() => groupByDay(shown, monthEntries), [shown, monthEntries]);
  const people = useMemo(() => groupByPerson(filterEntries(monthEntries, { byPeople: true, q: query })), [monthEntries, query]);
  const open = entries.find(e => e.id === openId) ?? null;

  const exportHref = `/api/lms/admin/operational/export?${new URLSearchParams({
    month, ...(view === 'people' ? { people: '1' } : {
      ...(category ? { category } : {}), ...(owedOnly ? { unreimbursed: '1' } : {}),
    }), ...(query.trim() ? { q: query.trim() } : {}),
  })}`;

  async function reimburse(ids: number[]) {
    setSaving(true);
    try {
      const { updated } = await request<{ updated: number }>('/api/lms/admin/operational/reimburse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      });
      setConfirmPerson(null);
      say(updated === 1 ? 'Marked as reimbursed.' : `Marked ${updated} expenses as reimbursed.`);
      await load();
    } catch (err) { say(err instanceof Error ? err.message : 'Could not save.'); } finally { setSaving(false); }
  }
  const toggleCollapsed = (id: number) => setCollapsed(prev => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await request(`/api/lms/admin/operational/expenses/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null); setOpenId(null);
      say('Expense deleted.');
      await load();
    } catch (err) { setDeleting(null); say(err instanceof Error ? err.message : 'Could not delete.'); } finally { setSaving(false); }
  }

  async function viewReceipt(ref: string) {
    if (isLink(ref)) { window.open(ref, '_blank', 'noopener,noreferrer'); return; }
    try {
      const { url } = await request<{ url: string }>(`/api/lms/admin/operational/receipts?key=${encodeURIComponent(ref)}`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) { say(err instanceof Error ? err.message : 'Could not open the receipt.'); }
  }

  const step = (delta: number) => setMonth(m => shiftMonth(m, delta));
  const rowOpen = (id: number) => setOpenId(id);

  return (
    <div className="exp">
      <style>{`
        .exp { color: ${SLATE}; }
        .exp button, .exp .exp-btn { cursor: pointer; font: inherit; }
        .exp button:focus-visible, .exp a:focus-visible, .exp tr:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; }
        .exp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: ${R_MD}px; border: 1px solid ${BORDER}; background: ${SURFACE}; color: ${SLATE}; font-size: 13px; text-decoration: none; min-height: 36px; box-sizing: border-box; }
        .exp-btn:hover:not(:disabled) { background: ${SURFACE_ALT}; }
        .exp-btn:disabled { opacity: .5; cursor: default; }
        .exp-btn.primary { background: ${RED}; border-color: ${RED}; color: ${SURFACE}; font-weight: 600; }
        .exp-btn.primary:hover:not(:disabled) { background: ${RED}; filter: brightness(1.12); }
        .exp-btn.danger { color: ${RED}; border-color: ${RED}; }
        .exp-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; }
        .exp-month { display: flex; align-items: center; gap: 4px; }
        .exp-month input { width: 160px; }
        .exp-search { position: relative; flex: 1 1 220px; max-width: 360px; }
        .exp-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: ${MUTED}; pointer-events: none; }
        .exp-search input { padding-left: 32px !important; }
        .exp-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); border: 1px solid ${BORDER}; border-radius: ${R_MD}px; background: ${SURFACE}; margin-bottom: 16px; }
        .exp-kpi > div { padding: 14px 16px; border-left: 1px solid ${BORDER}; min-width: 0; }
        .exp-kpi > div:first-child { border-left: 0; }
        .exp-kpi b { display: block; font-size: 20px; font-variant-numeric: tabular-nums; line-height: 1.2; overflow-wrap: anywhere; }
        .exp-kpi span { font-size: 12px; color: ${MUTED}; }
        @media (max-width: 640px) { .exp-kpi > div { border-left: 0; border-top: 1px solid ${BORDER}; } .exp-kpi > div:first-child { border-top: 0; } }
        .exp-panel { border: 1px solid ${BORDER}; border-radius: ${R_MD}px; background: ${SURFACE}; padding: 14px 16px; margin-bottom: 16px; }
        .exp-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: ${MUTED}; margin: 0 0 8px; }
        .exp-cat { display: grid; grid-template-columns: minmax(110px, 170px) 1fr 110px; gap: 10px; align-items: center; width: 100%; border: 0; background: none; padding: 4px 6px; text-align: left; font-size: 12px; border-radius: ${R_SM}px; color: ${SLATE}; }
        .exp-cat:hover { background: ${SURFACE_ALT}; }
        .exp-cat[aria-pressed="true"] { background: ${SURFACE_ALT}; font-weight: 700; }
        .exp-cat .track { height: 10px; background: ${SURFACE_ALT}; border-radius: 3px; }
        .exp-cat[aria-pressed="true"] .track { background: ${BORDER}; }
        .exp-cat .track i { display: block; height: 100%; background: ${INFO}; border-radius: 3px; }
        .exp-cat[aria-pressed="true"] .track i { background: ${RED}; }
        .exp-cat .v { text-align: right; font-variant-numeric: tabular-nums; }
        @media (max-width: 640px) { .exp-cat { grid-template-columns: 1fr 90px; } .exp-cat .track { grid-column: 1 / -1; order: 3; } }
        .exp-chip { border: 1px solid ${BORDER_FIELD}; background: ${SURFACE}; border-radius: 999px; padding: 6px 12px; font-size: 12px; min-height: 32px; color: ${SLATE}; }
        .exp-chip[aria-pressed="true"] { background: ${RED}; border-color: ${RED}; color: ${SURFACE}; }
        .exp-wrap { overflow-x: auto; border: 1px solid ${BORDER}; border-radius: ${R_MD}px; background: ${SURFACE}; }
        .exp table { border-collapse: collapse; width: 100%; min-width: 820px; font-size: 13px; }
        .exp th, .exp td { padding: 10px 14px; border-bottom: 1px solid ${BORDER}; text-align: left; vertical-align: top; }
        .exp th { background: ${SURFACE_ALT}; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: ${MUTED}; white-space: nowrap; }
        .exp td.num, .exp th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .exp tr.entry { cursor: pointer; }
        .exp tr.entry:hover td, .exp tr.entry[aria-selected="true"] td { background: ${SURFACE_ALT}; }
        .exp tr.day td { background: ${BG}; font-family: ${FONT_HEADING}; font-style: italic; font-size: 14px; color: ${MUTED}; padding-block: 6px; }
        .exp tr.day td.num { font-style: normal; font-family: inherit; font-size: 12px; }
        .exp td .sub { font-size: 12px; color: ${MUTED}; margin-top: 2px; }
        .exp-tabs { display: flex; gap: 4px; border-bottom: 1px solid ${BORDER}; margin-bottom: 16px; }
        .exp-tab { border: 0; border-bottom: 2px solid transparent; background: none; padding: 10px 14px; font-size: 14px; color: ${MUTED}; min-height: 40px; margin-bottom: -1px; }
        .exp-tab[aria-selected="true"] { color: ${SLATE}; font-weight: 700; border-bottom-color: ${RED}; }
        .exp-person { border: 1px solid ${BORDER}; border-radius: ${R_MD}px; background: ${SURFACE}; margin-bottom: 12px; }
        .exp-person-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 10px 14px; }
        .exp-person-toggle { display: flex; align-items: center; gap: 8px; flex: 1 1 220px; min-width: 0; border: 0; background: none; padding: 4px 0; text-align: left; color: ${SLATE}; font-size: 15px; }
        .exp-person-toggle svg { transition: transform .15s; flex-shrink: 0; }
        .exp-person-toggle[aria-expanded="false"] svg { transform: rotate(-90deg); }
        .exp-person-nums { display: flex; flex-wrap: wrap; gap: 4px 20px; font-size: 12px; color: ${MUTED}; }
        .exp-person-nums b { display: block; font-size: 15px; color: ${SLATE}; font-variant-numeric: tabular-nums; }
        .exp-person .exp-wrap { border: 0; border-top: 1px solid ${BORDER}; border-radius: 0; }
        .exp-person table { min-width: 640px; }
        .exp-stamp { display: inline-block; border: 1.5px solid; border-radius: 4px; padding: 1px 7px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; }
        .exp-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 400px; max-width: 100vw; background: ${SURFACE}; border-left: 1px solid ${BORDER}; box-shadow: ${SHADOW_LG}; overflow-y: auto; padding: 18px; box-sizing: border-box; }
        .exp-drawer dl { display: grid; grid-template-columns: 96px 1fr; gap: 8px 10px; margin: 14px 0; font-size: 13px; }
        .exp-drawer dt { color: ${MUTED}; font-size: 12px; }
        .exp-drawer dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
        .exp-sentence { font-family: ${FONT_HEADING}; font-size: 18px; line-height: 2.5; color: ${SLATE}; }
        .exp-sentence .sf { display: inline-block; vertical-align: baseline; }
        .exp-sentence .sf-l { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .exp-sentence input, .exp-sentence select { font-family: system-ui, sans-serif; font-size: 14px; }
        .exp-more { font-family: system-ui, sans-serif; line-height: 1.4; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 6px 0 10px; }
        .exp-more label, .exp-more .sf-l2 { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: ${MUTED}; display: block; margin-bottom: 4px; }
        .exp-form-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 20px; align-items: start; }
        .exp-voucher { border: 1px solid ${SLATE}; background: ${SURFACE}; padding: 16px; position: relative; font-size: 13px; }
        .exp-voucher .st { position: absolute; right: 14px; top: 14px; transform: rotate(4deg); }
        .exp-voucher .no { font-size: 12px; color: ${MUTED}; font-family: ui-monospace, monospace; }
        .exp-voucher .amt { font-family: ${FONT_HEADING}; font-size: 30px; font-weight: 600; line-height: 1.1; margin: 8px 0; font-variant-numeric: tabular-nums; }
        .exp-voucher .ln { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px dotted ${BORDER_FIELD}; min-height: 28px; }
        .exp-voucher .ln > span:first-child { color: ${MUTED}; width: 88px; flex-shrink: 0; font-size: 12px; }
        .exp-voucher .ln > span:last-child { min-width: 0; overflow-wrap: anywhere; }
        @media (max-width: 760px) {
          .exp-form-grid { grid-template-columns: 1fr; }
          .exp-more { grid-template-columns: 1fr; }
          .exp-sentence { font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.4; display: grid; gap: 12px; }
          .exp-sentence .sf { display: block; }
          .exp-sentence .sf-l { position: static; width: auto; height: auto; clip: auto; white-space: normal; display: block; font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: ${MUTED}; margin-bottom: 4px; }
          .exp-sentence .sw { display: none; }
          .exp-sentence input, .exp-sentence select { width: 100% !important; }
        }
        @media (pointer: coarse) { .exp button, .exp .exp-btn, .exp input, .exp select { min-height: 44px; } }
        @media (prefers-reduced-motion: reduce) { .exp * { transition-duration: .01ms !important; } }
      `}</style>

      {error && <div role="alert" style={{ color: RED, padding: '8px 0' }}>{error} <button type="button" className="exp-btn" onClick={() => void load()}>Retry loading</button></div>}
      {!data && !error && <p role="status" style={{ color: MUTED }}>Loading…</p>}

      {data && <>
        <div className="exp-tabs" role="tablist" aria-label="Expense views">
          <button type="button" role="tab" className="exp-tab" aria-selected={view === 'all'} onClick={() => setView('all')}>All expenses</button>
          <button type="button" role="tab" className="exp-tab" aria-selected={view === 'people'} onClick={() => setView('people')}>Paid by people</button>
        </div>
        <div className="exp-bar">
          <div className="exp-month" role="group" aria-label="Month">
            <button type="button" className="exp-btn" aria-label="Previous month" onClick={() => step(-1)}><ChevronLeft size={14} aria-hidden /></button>
            <FieldInput type="month" aria-label="Month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} />
            <button type="button" className="exp-btn" aria-label="Next month" onClick={() => step(1)}><ChevronRight size={14} aria-hidden /></button>
          </div>
          <div className="exp-search">
            <Search size={14} aria-hidden />
            <FieldInput type="search" placeholder="Search payee, item, reference" aria-label="Search expenses" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <span style={{ flex: 1 }} />
          <a className="exp-btn" href={exportHref} download><Download size={14} aria-hidden /> Export CSV</a>
          <button type="button" className="exp-btn primary" onClick={() => { setOpenId(null); setForm({ editing: null }); }}><Plus size={14} aria-hidden /> New expense</button>
        </div>

        {view === 'all' && <>
        <div className="exp-kpi" aria-label={`Summary for ${monthLabel(month)}`}>
          <div><b>{money(kpis.spent)}</b><span>Spent in {monthLabel(month)}</span></div>
          <div><b style={{ color: kpis.toReimburse > 0 ? WARN : SLATE }}>{money(kpis.toReimburse)}</b>
            <span>To reimburse{kpis.toReimburseCount > 0 ? ` · ${kpis.toReimburseCount} ${kpis.toReimburseCount === 1 ? 'expense' : 'expenses'}, all months` : ''}</span></div>
          <div><b>{kpis.topCategory?.category ?? 'None yet'}</b><span>Biggest category{kpis.topCategory ? ` · ${kpis.topCategory.pct}%` : ''}</span></div>
          <div><b>{kpis.deltaPct === null ? 'No data' : `${kpis.deltaPct > 0 ? '+' : kpis.deltaPct < 0 ? '−' : ''}${Math.abs(kpis.deltaPct)}%`}</b>
            <span>vs {monthLabel(shiftMonth(month, -1))}</span></div>
        </div>

        <div className="exp-panel">
          <p className="exp-eyebrow">By category (select one to filter)</p>
          {bars.length === 0 ? <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No spending recorded in {monthLabel(month)}.</p> : <>
            {bars.map(b => (
              <button key={b.category} type="button" className="exp-cat" aria-pressed={category === b.category}
                onClick={() => setCategory(c => (c === b.category ? '' : b.category))}>
                <span>{b.category}</span>
                <span className="track" aria-hidden><i style={{ width: `${(b.amount / bars[0].amount) * 100}%` }} /></span>
                <span className="v">{money(b.amount)}</span>
              </button>
            ))}
          </>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" className="exp-chip" aria-pressed={owedOnly} onClick={() => setOwedOnly(v => !v)}>To reimburse only</button>
            {category && <button type="button" className="exp-chip" onClick={() => setCategory('')}>Clear category: {category}</button>}
          </div>
        </div>

        <div className="exp-wrap" tabIndex={0} role="region" aria-label={`Expenses for ${monthLabel(month)}`}>
          <table>
            <thead><tr>
              <th scope="col">Date</th><th scope="col">Payee and item</th><th scope="col">Category</th><th scope="col">Paid by</th>
              <th scope="col">Method</th><th scope="col" className="num">Amount</th><th scope="col" className="num">Month to date</th><th scope="col">Status</th>
            </tr></thead>
            <tbody>
              {days.length === 0 && <tr><td colSpan={8} style={{ color: MUTED, padding: 24 }}>
                {monthEntries.length === 0 ? `No expenses in ${monthLabel(month)} yet.` : 'No expenses match these filters.'}</td></tr>}
              {days.map(day => [
                <tr key={day.date} className="day"><td colSpan={6}>{dayLabel(day.date)}</td><td colSpan={2} className="num">{money(day.total)}</td></tr>,
                ...day.rows.map(({ entry, monthToDate }) => (
                  <tr key={entry.id} className="entry" tabIndex={0} aria-selected={openId === entry.id}
                    onClick={() => rowOpen(entry.id)} onKeyDown={e => { if (e.key === 'Enter') rowOpen(entry.id); }}>
                    <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{shortDate(entry.date)}</td>
                    <td style={{ minWidth: 220 }}>
                      <b>{entry.payee || entry.description || entry.category}</b>
                      {entry.payee && entry.description && <div className="sub">{entry.description}</div>}
                      {entry.receiptKey && <span className="sub"><Paperclip size={11} aria-hidden /> Receipt attached</span>}
                    </td>
                    <td>{entry.category}</td>
                    <td>{entry.paidBy === null ? 'Organization' : <>{entry.paidByName ?? 'Unknown'}<div className="sub">{roleLabel(entry.paidByRole)}</div></>}</td>
                    <td>{entry.paymentMethod ?? '—'}</td>
                    <td className="num"><b>{money(entry.amountMinor)}</b></td>
                    <td className="num" style={{ color: MUTED }}>{money(monthToDate)}</td>
                    <td><Stamp entry={entry} /></td>
                  </tr>
                )),
              ])}
            </tbody>
            {days.length > 0 && <tfoot><tr>
              <td colSpan={5} style={{ fontWeight: 600 }}>Total shown ({shown.length})</td>
              <td className="num"><b>{money(sumMinor(shown))}</b></td><td colSpan={2} />
            </tr></tfoot>}
          </table>
        </div>
        </>}

        {view === 'people' && <PeopleView people={people} month={month} emptyMonth={monthEntries.every(e => e.paidBy === null)}
          collapsed={collapsed} onToggle={toggleCollapsed} confirmPerson={confirmPerson} onConfirmPerson={setConfirmPerson}
          saving={saving} onOpen={rowOpen} onReimburse={ids => void reimburse(ids)} />}
      </>}

      {open && <Drawer entry={open} saving={saving} onClose={() => setOpenId(null)} onViewReceipt={viewReceipt}
        onReimburse={() => void reimburse([open.id])}
        onEdit={() => { setOpenId(null); setForm({ editing: open }); }} onDelete={() => setDeleting(open)} />}

      {form && data && <ExpenseForm data={data} editing={form.editing} nextVoucherId={Math.max(0, ...entries.map(e => e.id)) + 1}
        onClose={() => setForm(null)} onViewReceipt={viewReceipt}
        onSaved={async (id, wasEditing) => { setForm(null); say(wasEditing ? 'Expense updated.' : 'Voucher saved.'); await load(); if (wasEditing) setOpenId(id); }} />}

      <ConfirmDialog open={deleting !== null} title="Delete expense"
        message={`Permanently delete ${deleting ? `${money(deleting.amountMinor)} on ${deleting.date}` : 'this expense'}? This cannot be undone.`}
        confirmLabel="Delete" destructive loading={saving} onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(null)} />
      <Toast message={toast} />
    </div>
  );
}

function Drawer({ entry, saving, onClose, onViewReceipt, onReimburse, onEdit, onDelete }: {
  entry: FinancialEntryRecord; saving: boolean; onClose: () => void; onViewReceipt: (ref: string) => void;
  onReimburse: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const ref = useDialogBehaviour(true, onClose);
  return <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,5,7,0.28)', zIndex: Z_MODAL_BACKDROP }} />
    <aside ref={ref} className="exp-drawer exp" role="dialog" aria-modal="true" aria-label="Expense record" style={{ zIndex: Z_MODAL }} tabIndex={-1}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="exp-eyebrow" style={{ margin: 0 }}>Expense · {voucherNo(entry.id)}</span>
        <button type="button" className="exp-btn" aria-label="Close" onClick={onClose}><X size={14} aria-hidden /></button>
      </div>
      <div style={{ fontFamily: FONT_HEADING, fontSize: 28, fontWeight: 600, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{money(entry.amountMinor)}</div>
      <div style={{ fontWeight: 600 }}>{entry.payee || entry.description || entry.category}</div>
      <div style={{ marginTop: 6 }}><Stamp entry={entry} /></div>
      <dl>
        <dt>Date</dt><dd>{dayLabel(entry.date)}</dd>
        <dt>Item</dt><dd>{entry.description || '—'}</dd>
        <dt>Category</dt><dd>{entry.category}</dd>
        <dt>Paid by</dt><dd>{entry.paidBy === null ? 'Organization (paid directly)' : `${payerText(entry)} (own pocket)`}</dd>
        {entry.paidBy !== null && <><dt>Reimbursed</dt><dd>{entry.reimbursedAt ?? 'Not yet'}</dd></>}
        <dt>Method</dt><dd>{entry.paymentMethod ?? '—'}</dd>
        <dt>Reference</dt><dd style={{ fontVariantNumeric: 'tabular-nums' }}>{entry.referenceNo ?? '—'}</dd>
        <dt>Product</dt><dd>{entry.product ? `${entry.product}${entry.batch ? ` · ${entry.batch}` : ''}` : entry.batch ?? '—'}</dd>
        <dt>Class</dt><dd>{entry.classLabel ?? '—'}</dd>
        <dt>Location</dt><dd>{entry.location ?? '—'}</dd>
        <dt>Tags</dt><dd>{entry.tags.length ? entry.tags.join(', ') : '—'}</dd>
        <dt>Receipt</dt>
        <dd>{entry.receiptKey
          ? <button type="button" className="exp-btn" onClick={() => onViewReceipt(entry.receiptKey!)}><Paperclip size={13} aria-hidden /> View receipt</button>
          : <span className="exp-stamp" style={{ color: WARN, borderColor: WARN, background: WARN_BG }}>Missing</span>}</dd>
        <dt>Last edited</dt><dd>{new Date(entry.updatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
      </dl>
      <div style={{ display: 'grid', gap: 8 }}>
        {needsReimbursement(entry) && <button type="button" className="exp-btn primary" disabled={saving} onClick={onReimburse} style={{ justifyContent: 'center' }}>Mark reimbursed</button>}
        <button type="button" className="exp-btn" disabled={saving} onClick={onEdit} style={{ justifyContent: 'center' }}>Edit</button>
        <button type="button" className="exp-btn danger" disabled={saving} onClick={onDelete} style={{ justifyContent: 'center' }}>Delete</button>
      </div>
    </aside>
  </>;
}

function PeopleView({ people, month, emptyMonth, collapsed, onToggle, confirmPerson, onConfirmPerson, saving, onOpen, onReimburse }: {
  people: PersonGroup[]; month: string; emptyMonth: boolean; collapsed: Set<number>; onToggle: (id: number) => void;
  confirmPerson: number | null; onConfirmPerson: (id: number | null) => void; saving: boolean;
  onOpen: (id: number) => void; onReimburse: (ids: number[]) => void;
}) {
  if (people.length === 0) {
    return <p className="exp-panel" style={{ color: MUTED, fontSize: 13 }}>
      {emptyMonth ? `Nobody paid out of pocket in ${monthLabel(month)}.` : 'No person-paid expenses match this search.'}</p>;
  }
  return <>
    <div className="exp-kpi" aria-label={`People summary for ${monthLabel(month)}`}>
      <div><b>{money(people.reduce((n, p) => n + p.total, 0))}</b><span>Paid by people in {monthLabel(month)}</span></div>
      <div><b style={{ color: WARN }}>{money(people.reduce((n, p) => n + p.owed, 0))}</b><span>Still to reimburse</span></div>
      <div><b>{money(people.reduce((n, p) => n + p.reimbursed, 0))}</b><span>Reimbursed</span></div>
    </div>
    {people.map(p => {
      const isOpen = !collapsed.has(p.personId);
      const owedIds = p.entries.filter(needsReimbursement).map(e => e.id);
      return (
        <section key={p.personId} className="exp-person" aria-label={p.name}>
          <div className="exp-person-head">
            <button type="button" className="exp-person-toggle" aria-expanded={isOpen} aria-controls={`exp-person-${p.personId}`} onClick={() => onToggle(p.personId)}>
              <ChevronDown size={16} aria-hidden />
              <span><b>{p.name}</b> <span style={{ color: MUTED, fontSize: 12 }}>{roleLabel(p.role)} · {p.entries.length} {p.entries.length === 1 ? 'expense' : 'expenses'}</span></span>
            </button>
            <div className="exp-person-nums">
              <span><b>{money(p.total)}</b>Total paid</span>
              <span><b style={{ color: p.owed > 0 ? WARN : SLATE }}>{money(p.owed)}</b>To reimburse</span>
              <span><b>{money(p.reimbursed)}</b>Reimbursed</span>
            </div>
            {owedIds.length > 0 && (confirmPerson === p.personId ? (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} role="group" aria-label={`Confirm reimbursing ${p.name}`}>
                <span style={{ fontSize: 13 }}>Reimburse {owedIds.length} {owedIds.length === 1 ? 'expense' : 'expenses'}, {money(p.owed)}?</span>
                <button type="button" className="exp-btn primary" disabled={saving} onClick={() => onReimburse(owedIds)}>Confirm</button>
                <button type="button" className="exp-btn" disabled={saving} onClick={() => onConfirmPerson(null)}>Cancel</button>
              </span>
            ) : <button type="button" className="exp-btn" disabled={saving} onClick={() => onConfirmPerson(p.personId)}>Mark all reimbursed</button>)}
          </div>
          {isOpen && <div id={`exp-person-${p.personId}`} className="exp-wrap" tabIndex={0} role="region" aria-label={`Expenses paid by ${p.name}`}>
            <table>
              <thead><tr>
                <th scope="col">Date</th><th scope="col">Payee and item</th><th scope="col">Category</th>
                <th scope="col" className="num">Amount</th><th scope="col">Status</th><th scope="col" aria-label="Action" />
              </tr></thead>
              <tbody>
                {p.entries.map(e => (
                  <tr key={e.id} className="entry" tabIndex={0} onClick={() => onOpen(e.id)} onKeyDown={ev => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) onOpen(e.id); }}>
                    <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{shortDate(e.date)}</td>
                    <td style={{ minWidth: 200 }}>
                      <b>{e.payee || e.description || e.category}</b>
                      {e.payee && e.description && <div className="sub">{e.description}</div>}
                    </td>
                    <td>{e.category}</td>
                    <td className="num"><b>{money(e.amountMinor)}</b></td>
                    <td><Stamp entry={e} />{e.reimbursedAt && <div className="sub">{e.reimbursedAt}</div>}</td>
                    <td>{needsReimbursement(e) && <button type="button" className="exp-btn" disabled={saving}
                      onClick={ev => { ev.stopPropagation(); onReimburse([e.id]); }}>Mark reimbursed</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </section>
      );
    })}
  </>;
}

const RECEIPT_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

function ExpenseForm({ data, editing, nextVoucherId, onClose, onSaved, onViewReceipt }: {
  data: TrackerData; editing: FinancialEntryRecord | null; nextVoucherId: number; onClose: () => void;
  onSaved: (id: number, wasEditing: boolean) => Promise<void>; onViewReceipt: (ref: string) => void;
}) {
  const [f, setF] = useState<FormState>(() => (editing ? formFrom(editing) : blankForm()));
  const [more, setMore] = useState(() => !!editing && !!(editing.referenceNo || editing.product || editing.batch
    || editing.classSessionId || editing.location || editing.tags.length || editing.receiptKey || editing.reimbursedAt));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF(prev => ({ ...prev, [key]: value }));
  const text = (key: keyof FormState) => ({ value: f[key], onChange: (e: { target: { value: string } }) => set(key)(e.target.value) });

  const picked = data.payers.find(p => String(p.id) === f.paidBy);
  const payerName = picked ? `${picked.name}, ${roleLabel(picked.role)}` : editing ? payerText(editing) : 'Unknown';
  const amountMinor = Math.round((Number(f.amount.replace(/[,\s৳]/g, '')) || 0) * 100);
  const stampEntry: Payer = { paidBy: f.paidBy ? 1 : null, reimbursedAt: f.reimbursedAt || null };
  const classLabel = data.classes.find(c => String(c.id) === f.classSessionId)?.label ?? (f.classSessionId ? editing?.classLabel : null);

  async function pickReceipt(file: File | undefined) {
    if (!file) return;
    if (!RECEIPT_MIME.includes(file.type)) { setProblem('Receipts must be a PDF, JPG, PNG or WebP file.'); return; }
    if (file.size > MAX_RECEIPT_BYTES) { setProblem('Receipt is larger than 10 MB.'); return; }
    setProblem(''); setProgress(0);
    try {
      const { key } = await uploadToR2({ file, endpoint: '/api/lms/admin/operational/receipts', onProgress: setProgress });
      set('receiptKey')(key);
    } catch (err) { setProblem(err instanceof Error ? err.message : 'Upload failed.'); } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setProblem('');
    try {
      const result = await request<{ id: number }>(`/api/lms/admin/operational/expenses${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formBody(f)),
      });
      await onSaved(result.id, !!editing);
    } catch (err) { setProblem(err instanceof Error ? err.message : 'Could not save.'); setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Edit expense ${voucherNo(editing.id)}` : 'New expense'} width={940}>
      <form onSubmit={submit} autoComplete="off">
        <div className="exp exp-form-grid">
          <div>
            <div className="exp-sentence">
              <span className="sw">On </span>
              <label className="sf"><span className="sf-l">Date</span>
                <FieldInput type="date" required style={{ width: 150 }} {...text('date')} /></label>{' '}
              <label className="sf"><span className="sf-l">Paid by</span>
                <FieldSelect required={false} value={f.paidBy} onChange={e => set('paidBy')(e.target.value)} style={{ width: 240 }}>
                  <option value="">Organization (paid directly)</option>
                  {editing?.paidBy && !data.payers.some(p => p.id === editing.paidBy) && <option value={editing.paidBy}>{payerText(editing)} (own pocket)</option>}
                  {data.payers.map(p => <option key={p.id} value={p.id}>{p.name}, {roleLabel(p.role)} (own pocket)</option>)}
                </FieldSelect></label>{' '}
              <span className="sw">paid ৳</span>
              <label className="sf"><span className="sf-l">Amount (BDT)</span>
                <FieldInput required inputMode="decimal" placeholder="0.00" style={{ width: 110, fontVariantNumeric: 'tabular-nums' }} {...text('amount')} /></label>{' '}
              <span className="sw">to </span>
              <label className="sf"><span className="sf-l">Payee</span>
                <FieldInput placeholder="payee" maxLength={160} style={{ width: 160 }} {...text('payee')} /></label>{' '}
              <span className="sw">for </span>
              <label className="sf"><span className="sf-l">Item or description</span>
                <FieldInput placeholder="what for" maxLength={2000} style={{ width: 190 }} {...text('description')} /></label>{' '}
              <span className="sw">under </span>
              <label className="sf"><span className="sf-l">Category</span>
                <FieldSelect required value={f.category} onChange={e => set('category')(e.target.value)} style={{ width: 200 }}>
                  <option value="">category</option>
                  {editing && !(expenseCategories as readonly string[]).includes(editing.category) && <option value={editing.category}>{editing.category} (legacy)</option>}
                  {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </FieldSelect></label>{' '}
              <span className="sw">via </span>
              <label className="sf"><span className="sf-l">Payment method</span>
                <FieldSelect value={f.paymentMethod} onChange={e => set('paymentMethod')(e.target.value)} style={{ width: 150 }}>
                  <option value="">method</option>
                  {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                </FieldSelect></label><span className="sw">.</span>
            </div>

            <div style={{ marginTop: 8 }}>
              <button type="button" className="exp-btn" aria-expanded={more} onClick={() => setMore(v => !v)}>{more ? 'Hide detail' : 'Add detail'}</button>
            </div>
            {more && <div className="exp-more">
              <div><label htmlFor="exp-ref">Reference no.</label><FieldInput id="exp-ref" maxLength={120} {...text('referenceNo')} /></div>
              <div><label htmlFor="exp-prod">Product</label>
                <FieldSelect id="exp-prod" value={f.product} onChange={e => set('product')(e.target.value)}>
                  <option value="">None</option>{expenseProducts.map(p => <option key={p} value={p}>{p}</option>)}
                </FieldSelect></div>
              <div><label htmlFor="exp-batch">Batch</label><FieldInput id="exp-batch" maxLength={40} placeholder="e.g. 2026-27" {...text('batch')} /></div>
              <div><label htmlFor="exp-class">Linked class</label>
                <FieldSelect id="exp-class" value={f.classSessionId} onChange={e => set('classSessionId')(e.target.value)}>
                  <option value="">None</option>
                  {editing?.classSessionId && !data.classes.some(c => c.id === editing.classSessionId) && <option value={editing.classSessionId}>{editing.classLabel ?? `Class ${editing.classSessionId}`}</option>}
                  {data.classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </FieldSelect></div>
              <div><label htmlFor="exp-loc">Location</label><FieldInput id="exp-loc" maxLength={120} {...text('location')} /></div>
              <div><label htmlFor="exp-tags">Tags (comma separated)</label><FieldInput id="exp-tags" {...text('tags')} /></div>
              {f.paidBy && <div><label htmlFor="exp-reimb">Reimbursed on (leave blank if not yet)</label><FieldInput id="exp-reimb" type="date" {...text('reimbursedAt')} /></div>}
              <div style={{ gridColumn: '1 / -1' }}>
                <span className="sf-l2">Receipt (photo or PDF, up to 10 MB)</span>
                {f.receiptKey ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Paperclip size={14} aria-hidden /><span style={{ overflowWrap: 'anywhere' }}>{fileNameOf(f.receiptKey)}</span>
                    <button type="button" className="exp-btn" onClick={() => onViewReceipt(f.receiptKey)}>View</button>
                    <button type="button" className="exp-btn" onClick={() => set('receiptKey')('')}>Remove</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Upload receipt"
                      disabled={progress !== null} onChange={e => void pickReceipt(e.target.files?.[0])} />
                    {progress !== null && <span role="status" style={{ fontSize: 12, color: MUTED }}>Uploading… {progress}%</span>}
                    <FieldInput type="url" placeholder="or paste an https link to the receipt" aria-label="Receipt link"
                      onBlur={e => { if (/^https:\/\/\S+$/.test(e.target.value.trim())) set('receiptKey')(e.target.value.trim()); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
                  </div>
                )}
              </div>
            </div>}

            {problem && <p role="alert" style={{ color: RED, fontSize: 13, margin: '10px 0 0' }}>{problem}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" className="exp-btn primary" disabled={busy || progress !== null}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save voucher'}</button>
              <button type="button" className="exp-btn" onClick={onClose} disabled={busy}>Cancel</button>
            </div>
          </div>

          <div className="exp-voucher" aria-label="Payment voucher preview">
            <span className="exp-stamp st" style={stampStyle(stampEntry)}>{stampText(stampEntry)}</span>
            <div className="no">{editing ? `Payment voucher · ${voucherNo(editing.id)}` : `Payment voucher · draft (next ${voucherNo(nextVoucherId)})`}</div>
            <div className="amt">{money(amountMinor)}</div>
            <div className="ln"><span>Date</span><span>{f.date ? dayLabel(f.date) : '…'}</span></div>
            <div className="ln"><span>Pay to</span><span>{f.payee || '…'}</span></div>
            <div className="ln"><span>For</span><span>{f.description || '…'}{f.category ? ` · ${f.category}` : ''}</span></div>
            <div className="ln"><span>Paid by</span><span>{f.paidBy ? `${payerName} (own pocket)` : 'Organization'}{f.paymentMethod ? ` via ${f.paymentMethod}` : ''}</span></div>
            <div className="ln"><span>Reference</span><span>{f.referenceNo || 'None'}</span></div>
            {(f.product || f.batch) && <div className="ln"><span>Product</span><span>{[f.product, f.batch].filter(Boolean).join(' · ')}</span></div>}
            {classLabel && <div className="ln"><span>Class</span><span>{classLabel}</span></div>}
            <div className="ln"><span>Receipt</span><span>{f.receiptKey ? 'Attached' : 'None'}</span></div>
            <div className="ln" style={{ border: 0, marginTop: 14 }}><span>Approved</span><span style={{ fontFamily: FONT_HEADING, fontStyle: 'italic', color: MUTED }}>Admin signature</span></div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

