'use client';

import React from 'react';
import {
  SLATE, MUTED, BORDER, OK, T_SM, T_BASE, SPIN_CSS,
  TabBar, Toast, PrimaryBtn, GhostBtn, FieldInput, FieldSelect, FieldLabel, Modal, FormActions, Toggle, useConfirm, fmtDhaka,
} from '../../lms/lms-shared';
import { SuperHeader, SuperCard, SuperBadge, SuperTable, StatGrid, StatTile, tdStyle, superApi, SUPER_GOLD } from '../super-ui';

interface Pay { id: number; amount: number; method: string; status: string; note: string | null; at: number }
interface Row { id: number; name: string; email: string; phone: string; regStatus: string; product: string; due: number; paid: number; state: 'pending' | 'partial' | 'paid' | 'refunded'; followUpAt: number | null; payments: Pay[] }
interface MonthRow { month: string; registrations: number; opIncome: number; opExpense: number; net: number }
interface Group { label: string; bdt: number }
interface Revenue { byBatch: Group[]; byProduct: Group[]; byMonth: MonthRow[]; totals: { registrationsBdt: number; opIncomeBdt: number; opExpenseBdt: number } }

const TABS = [{ id: 'pipeline', label: 'Registrations & fees' }, { id: 'revenue', label: 'Revenue' }, { id: 'controls', label: 'Controls' }];
const stateTone = (s: Row['state']) => s === 'paid' ? 'ok' : s === 'partial' ? 'warn' : s === 'refunded' ? 'bad' : 'neutral';
const bdt = (n: number) => `${n.toLocaleString('en-BD', { maximumFractionDigits: 2 })} BDT`;
const todayDhaka = () => new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);

/** Minimal inline SVG bars: total income (registrations + operational income) per month. */
function MonthBars({ rows }: { rows: MonthRow[] }) {
  const data = rows.map(r => ({ m: r.month, v: r.registrations + r.opIncome }));
  const max = Math.max(1, ...data.map(d => d.v));
  const W = 560, H = 160, pad = 24, bw = Math.min(40, (W - pad * 2) / Math.max(1, data.length) - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" role="img" aria-label="Monthly income in BDT" style={{ maxWidth: W }}>
      <line x1={pad} y1={H} x2={W - pad} y2={H} stroke={BORDER} />
      {data.map((d, i) => {
        const h = (d.v / max) * (H - 16);
        const x = pad + i * ((W - pad * 2) / data.length) + 4;
        return (
          <g key={d.m}>
            <rect x={x} y={H - h} width={bw} height={h} fill={SUPER_GOLD} rx={2}><title>{`${d.m}: ${bdt(d.v)}`}</title></rect>
            <text x={x + bw / 2} y={H + 14} textAnchor="middle" fontSize={10} fill={MUTED}>{d.m.slice(2)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function FinanceClient() {
  const [tab, setTab] = React.useState('pipeline');
  const [toast, setToast] = React.useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [rev, setRev] = React.useState<Revenue | null>(null);
  const [moneyOnly, setMoneyOnly] = React.useState<boolean | null>(null);
  const [filter, setFilter] = React.useState('all');

  // modal state
  const [target, setTarget] = React.useState<Row | null>(null);
  const [kind, setKind] = React.useState<'payment' | 'refund'>('payment');
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState('cash');
  const [note, setNote] = React.useState('');
  const [followDate, setFollowDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const note$ = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };
  const fail = (e: unknown) => note$(e instanceof Error ? e.message : 'Something went wrong');

  const loadRows = React.useCallback(() => {
    superApi<{ rows: Row[] }>('/api/admin/super/finance/registrations').then(d => setRows(d.rows)).catch(fail);
  }, []);
  React.useEffect(() => { loadRows(); }, [loadRows]);
  React.useEffect(() => {
    if (tab === 'revenue' && !rev) superApi<Revenue>('/api/admin/super/finance/revenue').then(setRev).catch(fail);
    if (tab === 'controls' && moneyOnly === null) superApi<{ moneySuperOnly: boolean }>('/api/admin/super/finance/settings').then(d => setMoneyOnly(d.moneySuperOnly)).catch(fail);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (r: Row) => { setTarget(r); setKind('payment'); setAmount(''); setMethod('cash'); setNote(''); setFollowDate(r.followUpAt ? new Date(r.followUpAt + 6 * 3600_000).toISOString().slice(0, 10) : ''); };

  async function submitPayment() {
    if (!target) return;
    setBusy(true);
    try {
      await superApi(`/api/admin/super/finance/registrations/${target.id}`, { method: 'POST', body: { action: 'payment', kind, amount: Number(amount), method, note: note || undefined } });
      setTarget(null); setRev(null); loadRows(); note$(kind === 'refund' ? 'Refund recorded' : 'Payment recorded');
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function submitFollowUp(clear: boolean) {
    if (!target) return;
    setBusy(true);
    try {
      await superApi(`/api/admin/super/finance/registrations/${target.id}`, { method: 'POST', body: { action: 'followup', date: clear ? null : followDate || null } });
      setTarget(null); loadRows(); note$(clear ? 'Follow-up cleared' : 'Follow-up set');
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function toggleGate(v: boolean) {
    if (!(await confirm({ title: v ? 'Hide Operational Admin from plain admins?' : 'Show Operational Admin to admins again?', message: v ? 'Only the super admin will see /admin/operational and its data.' : 'All admins will see the operational finance pages again.', confirmLabel: v ? 'Restrict' : 'Allow admins' }))) return;
    try { const d = await superApi<{ moneySuperOnly: boolean }>('/api/admin/super/finance/settings', { method: 'PUT', body: { moneySuperOnly: v } }); setMoneyOnly(d.moneySuperOnly); note$('Saved'); } catch (e) { fail(e); }
  }

  const today = todayDhaka();
  const followUpsDue = (rows ?? []).filter(r => r.followUpAt !== null && r.state !== 'paid' && new Date(r.followUpAt + 6 * 3600_000).toISOString().slice(0, 10) <= today);
  const shown = (rows ?? []).filter(r => filter === 'all' || r.state === filter);
  const sumDue = (rows ?? []).reduce((s, r) => s + r.due, 0);
  const sumPaid = (rows ?? []).reduce((s, r) => s + r.paid, 0);
  const groupTable = (title: string, g: Group[]) => (
    <SuperCard title={title}>
      {g.length === 0 ? <p style={{ margin: 0, color: MUTED, fontSize: T_BASE }}>No payments yet.</p> : (
        <SuperTable head={[title.replace('Revenue by ', ''), 'Collected']}>{g.map(x => <tr key={x.label}><td style={tdStyle}>{x.label}</td><td style={tdStyle}>{bdt(x.bdt)}</td></tr>)}</SuperTable>
      )}
    </SuperCard>
  );

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px 64px' }}>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Finance" subtitle="Registration fees, revenue and the money-view switch" />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'pipeline' && (!rows ? <p style={{ color: MUTED, fontSize: T_BASE }}>Loading…</p> : (<>
        <StatGrid>
          <StatTile label="Fees due" value={bdt(sumDue)} />
          <StatTile label="Collected (net)" value={bdt(sumPaid)} tone="ok" />
          <StatTile label="Follow-ups due" value={followUpsDue.length} tone={followUpsDue.length ? 'warn' : undefined} />
        </StatGrid>

        {followUpsDue.length > 0 && (
          <SuperCard title="Follow-ups due">
            <SuperTable head={['Name', 'Phone', 'Outstanding', 'Due on', '']}>
              {followUpsDue.map(r => (
                <tr key={r.id}><td style={tdStyle}>{r.name}</td><td style={tdStyle}>{r.phone}</td><td style={tdStyle}>{bdt(Math.max(0, r.due - r.paid))}</td>
                  <td style={tdStyle}>{fmtDhaka(r.followUpAt!, { dateStyle: 'medium' })}</td><td style={tdStyle}><GhostBtn small onClick={() => open(r)}>Open</GhostBtn></td></tr>
              ))}
            </SuperTable>
          </SuperCard>
        )}

        <SuperCard title="Registrations" action={
          <div style={{ width: 150 }}><FieldSelect aria-label="Filter by status" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
          </FieldSelect></div>}>
          <SuperTable head={['Name', 'Product', 'Due', 'Paid', 'Status', 'Follow-up', '']}>
            {shown.map(r => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.name}<div style={{ fontSize: T_SM, color: MUTED }}>{r.email}</div></td>
                <td style={tdStyle}>{r.product}{r.regStatus === 'cancelled' && <> <SuperBadge>cancelled</SuperBadge></>}</td>
                <td style={tdStyle}>{r.due ? bdt(r.due) : '-'}</td>
                <td style={tdStyle}>{bdt(r.paid)}</td>
                <td style={tdStyle}><SuperBadge tone={stateTone(r.state)}>{r.state}</SuperBadge></td>
                <td style={tdStyle}>{r.followUpAt ? fmtDhaka(r.followUpAt, { dateStyle: 'medium' }) : '-'}</td>
                <td style={tdStyle}><GhostBtn small onClick={() => open(r)}>Manage</GhostBtn></td>
              </tr>
            ))}
          </SuperTable>
          {shown.length === 0 && <p style={{ margin: '12px 0 0', color: MUTED, fontSize: T_BASE }}>No registrations match.</p>}
        </SuperCard>
      </>))}

      {tab === 'revenue' && (!rev ? <p style={{ color: MUTED, fontSize: T_BASE }}>Loading…</p> : (<>
        <StatGrid>
          <StatTile label="Registration fees" value={bdt(rev.totals.registrationsBdt)} tone="ok" />
          <StatTile label="Operational income" value={bdt(rev.totals.opIncomeBdt)} />
          <StatTile label="Operational expenses" value={bdt(rev.totals.opExpenseBdt)} tone="warn" />
          <StatTile label="Net" value={bdt(rev.totals.registrationsBdt + rev.totals.opIncomeBdt - rev.totals.opExpenseBdt)} />
        </StatGrid>
        <SuperCard title="Income by month">
          {rev.byMonth.length ? <MonthBars rows={rev.byMonth} /> : <p style={{ margin: 0, color: MUTED, fontSize: T_BASE }}>No data yet.</p>}
          <div style={{ marginTop: 12 }}>
            <SuperTable head={['Month', 'Registration fees', 'Operational income', 'Operational expenses', 'Net']}>
              {rev.byMonth.map(m => <tr key={m.month}><td style={tdStyle}>{m.month}</td><td style={tdStyle}>{bdt(m.registrations)}</td><td style={tdStyle}>{bdt(m.opIncome)}</td><td style={tdStyle}>{bdt(m.opExpense)}</td><td style={{ ...tdStyle, color: m.net >= 0 ? OK : SLATE }}>{bdt(m.net)}</td></tr>)}
            </SuperTable>
          </div>
        </SuperCard>
        {groupTable('Revenue by batch', rev.byBatch)}
        {groupTable('Revenue by product', rev.byProduct)}
      </>))}

      {tab === 'controls' && (<>
        <SuperCard title="Money view restriction">
          <p style={{ margin: '0 0 12px', fontSize: T_BASE, color: SLATE }}>When on, plain admins cannot open Operational Admin (instructor payments, expenses, income) or its API. You always can. Off by default.</p>
          {moneyOnly === null ? <p style={{ color: MUTED, fontSize: T_BASE }}>Loading…</p> : <Toggle checked={moneyOnly} onChange={toggleGate} label="Operational finance visible to super admin only" />}
        </SuperCard>
        <SuperCard title="Ledger export">
          <p style={{ margin: '0 0 12px', fontSize: T_BASE, color: SLATE }}>All registration payments and operational entries as one CSV, amounts in BDT. Each download is audited.</p>
          <a href="/api/admin/super/finance/ledger-csv" download><PrimaryBtn small>Download ledger CSV</PrimaryBtn></a>
        </SuperCard>
      </>)}

      <Modal open={target !== null} title={target ? `${target.name}: ${target.state}` : ''} onClose={() => setTarget(null)}>
        {target && (<>
          <p style={{ margin: '0 0 12px', fontSize: T_BASE, color: SLATE }}>Due {target.due ? bdt(target.due) : 'unknown'}, paid {bdt(target.paid)}.</p>
          {target.payments.length > 0 && (
            <div style={{ marginBottom: 12, fontSize: T_SM, color: MUTED }}>
              {target.payments.map(p => <div key={p.id}>{fmtDhaka(p.at, { dateStyle: 'medium' })}: {bdt(p.amount)} via {p.method}{p.note ? `, ${p.note}` : ''}</div>)}
            </div>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            <div><FieldLabel htmlFor="pm-kind">Type</FieldLabel><FieldSelect id="pm-kind" value={kind} onChange={e => setKind(e.target.value as 'payment' | 'refund')}><option value="payment">Payment received</option><option value="refund">Refund</option></FieldSelect></div>
            <div><FieldLabel htmlFor="pm-amt">Amount (BDT)</FieldLabel><FieldInput id="pm-amt" type="number" min={1} step={1} value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div><FieldLabel htmlFor="pm-method">Method</FieldLabel><FieldSelect id="pm-method" value={method} onChange={e => setMethod(e.target.value)}><option value="cash">Cash</option><option value="bkash">bKash</option><option value="bank">Bank</option><option value="other">Other</option></FieldSelect></div>
            <div><FieldLabel htmlFor="pm-note">Note</FieldLabel><FieldInput id="pm-note" value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></div>
          </div>
          <FormActions>
            <GhostBtn onClick={() => setTarget(null)}>Close</GhostBtn>
            <PrimaryBtn onClick={submitPayment} loading={busy} disabled={!(Number(amount) > 0) || !Number.isInteger(Number(amount))}>{kind === 'refund' ? 'Record refund' : 'Record payment'}</PrimaryBtn>
          </FormActions>
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 16, paddingTop: 12 }}>
            <FieldLabel htmlFor="pm-follow">Follow-up date</FieldLabel>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 150 }}><FieldInput id="pm-follow" type="date" value={followDate} onChange={e => setFollowDate(e.target.value)} /></div>
              <GhostBtn small onClick={() => submitFollowUp(false)} disabled={busy || !followDate}>Set</GhostBtn>
              <GhostBtn small onClick={() => submitFollowUp(true)} disabled={busy || !target.followUpAt}>Clear</GhostBtn>
            </div>
          </div>
        </>)}
      </Modal>

      {confirmDialog}
      <Toast message={toast} />
    </div>
  );
}
