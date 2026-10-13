'use client';

import { useState } from 'react';
import { Check, Mail, MessageCircle, Pencil } from 'lucide-react';
import {
  PrimaryBtn, GhostBtn, DangerBtn, FieldInput, FieldLabel, FieldSelect,
  RED, SLATE, MUTED, BORDER, BORDER_FIELD, SURFACE, SURFACE_ALT, OK, OK_BG, WARN, WARN_BG, INFO,
  R_MD, FONT_HEADING, T_XS, T_SM, T_BASE, T_LG, T_XL,
} from '@/components/admin/lms/lms-shared';
import { ageDays, buildInvoice, isStale, productsForRegistration } from '@/lib/registrations/enrolment';
import type { EnrolmentRow, EnrolmentBatch } from './EnrolmentsClient';

const MONO = 'var(--font-mono), ui-monospace, monospace';
export const tk = (n: number) => `Tk ${Math.round(n).toLocaleString('en-US')}`;

/** Outlined "stamp" label: text always carries the state, colour only reinforces it. */
export function Stamp({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'ok' | 'warn' | 'info' | 'bad' }) {
  const c = { muted: MUTED, ok: OK, warn: WARN, info: INFO, bad: RED }[tone];
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', border: `1px solid ${c}`, borderRadius: 4, color: c,
      fontSize: T_XS, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

export function statusTone(status: string, stale: boolean): 'muted' | 'ok' | 'warn' | 'info' | 'bad' {
  if (status === 'enrolled') return 'ok';
  if (status === 'cancelled') return 'muted';
  if (status === 'contacted') return 'info';
  return stale ? 'bad' : 'warn';
}

const STEPS = ['pending', 'contacted', 'enrolled'] as const;

function Stepper({ status }: { status: string }) {
  const idx = STEPS.indexOf(status as typeof STEPS[number]);
  return (
    <ol aria-label="Registration progress" style={{ display: 'flex', gap: 0, margin: '14px 0', padding: 0, listStyle: 'none' }}>
      {STEPS.map((s, i) => {
        const done = status !== 'cancelled' && i < idx;
        const on = status !== 'cancelled' && i === idx;
        const c = done ? OK : on ? RED : MUTED;
        return (
          <li key={s} aria-current={on ? 'step' : undefined} style={{
            flex: 1, textAlign: 'center', paddingTop: 8, borderTop: `3px solid ${done ? OK : on ? RED : BORDER}`,
            fontSize: T_XS, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: c,
          }}>
            {done && <Check size={11} aria-hidden style={{ verticalAlign: '-1px', marginRight: 3 }} />}{s}
          </li>
        );
      })}
    </ol>
  );
}

function EmailChip({ label, status }: { label: string; status: string | null }) {
  const tone = status === 'sent' ? 'ok' : status === 'failed' ? 'bad' : 'warn';
  const text = status === 'sent' ? 'sent' : status === 'failed' ? 'failed' : 'not sent yet';
  return <span style={{ fontSize: T_SM, color: MUTED }}>{label} <Stamp tone={tone}>{text}</Stamp></span>;
}

interface DetailProps {
  row: EnrolmentRow;
  batches: EnrolmentBatch[];
  canEnrol: boolean;
  busy: boolean;
  onContacted: () => void;
  onCancel: () => void;
  onEnrol: (batch: string) => Promise<void>;
  onSaveContact: (patch: { name: string; email: string; phone: string }) => Promise<void>;
}

export default function EnrolmentDetail({ row, batches, canEnrol, busy, onContacted, onCancel, onEnrol, onSaveContact }: DetailProps) {
  const [asking, setAsking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: row.name, email: row.email, phone: row.phone });

  const inv = buildInvoice(row);
  const products = productsForRegistration(row);
  const batchNames = [...new Set(batches.filter((b) => (products as string[]).includes(b.product)).map((b) => b.name))].sort();
  const [batch, setBatch] = useState(batchNames.length === 1 ? batchNames[0] : '');

  const age = ageDays(row.createdAtMs);
  const stale = isStale(row.status, row.createdAtMs);
  const open = row.status === 'pending' || row.status === 'contacted';
  const waDigits = row.phone.replace(/[^\d]/g, '');
  const years = row.educationType === 'hsc'
    ? `HSC ${row.hscYear ?? '-'} · SSC ${row.sscYear ?? '-'}`
    : `A level ${row.aLevelYear ?? '-'} · O level ${row.oLevelYear ?? '-'}`;

  return (
    <div style={{ padding: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: FONT_HEADING, fontSize: T_XL, fontWeight: 700, color: SLATE, overflowWrap: 'anywhere' }}>{row.name}</h2>
          <div style={{ fontSize: T_SM, color: MUTED, marginTop: 2 }}>
            {row.educationType === 'hsc' ? 'HSC track' : 'A levels track'} · {years}
          </div>
          <div style={{ fontSize: T_SM, color: stale ? RED : MUTED, marginTop: 2, fontWeight: stale ? 600 : 400 }}>
            Registered {new Date(row.createdAtMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}{age} {age === 1 ? 'day' : 'days'} ago{stale ? ' · waiting more than 14 days' : ''}
          </div>
        </div>
        <GhostBtn small onClick={() => { setDraft({ name: row.name, email: row.email, phone: row.phone }); setEditing((v) => !v); }}>
          <Pencil size={12} aria-hidden /> {editing ? 'Close edit' : 'Edit contact'}
        </GhostBtn>
      </div>

      {editing ? (
        <form
          onSubmit={async (e) => { e.preventDefault(); await onSaveContact(draft); setEditing(false); }}
          style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', margin: '14px 0', padding: 12, border: `1px solid ${BORDER}`, borderRadius: R_MD, background: SURFACE_ALT }}
        >
          <div><FieldLabel htmlFor="en-name">Name</FieldLabel><FieldInput id="en-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></div>
          <div><FieldLabel htmlFor="en-email">Email</FieldLabel><FieldInput id="en-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required /></div>
          <div><FieldLabel htmlFor="en-phone">Phone</FieldLabel><FieldInput id="en-phone" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} required /></div>
          <div style={{ alignSelf: 'end' }}><PrimaryBtn type="submit" small loading={busy}>Save</PrimaryBtn></div>
        </form>
      ) : (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: T_BASE, color: SLATE, marginTop: 10, alignItems: 'center' }}>
          <span style={{ overflowWrap: 'anywhere' }}>{row.email}</span>
          <span style={{ fontFamily: MONO }}>{row.phone}</span>
          {waDigits && (
            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" style={{ color: INFO, fontSize: T_SM, display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 24 }}>
              <MessageCircle size={13} aria-hidden /> WhatsApp
            </a>
          )}
        </div>
      )}

      <Stepper status={row.status} />
      {row.status === 'cancelled' && <p style={{ margin: '0 0 10px' }}><Stamp>cancelled</Stamp></p>}

      <section aria-label="Registration invoice" style={{ border: `1px solid ${SLATE}`, background: SURFACE, padding: 16, maxWidth: 480 }}>
        <div style={{ fontSize: T_XS, fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Registration invoice · {row.programMode === 'mocks' ? `mock programs${row.mockIntent === 'trial' ? ' (trial first)' : ''}` : 'full course'}
        </div>
        {inv.lines.length === 0 && <div style={{ fontSize: T_BASE, color: MUTED, padding: '5px 0' }}>No course recorded.</div>}
        {inv.lines.map((l) => (
          <div key={l.label} style={lineStyle}><span>{l.label}</span><span style={{ fontFamily: MONO }}>{l.amount == null ? '-' : tk(l.amount)}</span></div>
        ))}
        <div style={lineStyle}><span style={{ color: MUTED }}>Subtotal</span><span style={{ fontFamily: MONO }}>{tk(inv.subtotal)}</span></div>
        {inv.discount > 0 ? (
          <div style={lineStyle}>
            <span>Discount{inv.discountReason ? <span style={{ color: MUTED }}> · {inv.discountReason}</span> : null}</span>
            <span style={{ fontFamily: MONO }}>-{tk(inv.discount)}</span>
          </div>
        ) : (
          <div style={lineStyle}><span style={{ color: MUTED }}>No discount</span><span style={{ fontFamily: MONO }}>-</span></div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: `2px solid ${SLATE}`, marginTop: 6, paddingTop: 8, fontWeight: 700, fontSize: T_LG }}>
          <span>To pay</span><span style={{ fontFamily: MONO }}>{tk(inv.finalAmount)}</span>
        </div>
        {inv.referral && <div style={{ fontSize: T_SM, color: MUTED, marginTop: 8 }}>Referred by {inv.referral}</div>}
      </section>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        <Mail size={13} color={MUTED} aria-hidden />
        <EmailChip label="Student email" status={row.studentEmailStatus} />
        <EmailChip label="Admin email" status={row.adminEmailStatus} />
      </div>

      {open && (
        <div style={{ marginTop: 18 }}>
          {asking ? (
            <div role="group" aria-label={`Confirm enrolling ${row.name}`} style={{ border: `1px solid ${WARN}`, background: WARN_BG, borderRadius: R_MD, padding: '12px 14px', fontSize: T_BASE, color: SLATE }}>
              <b>Enrol {row.name} and grant access?</b>
              <p style={{ margin: '6px 0 10px', lineHeight: 1.5 }}>
                This sets the status to enrolled, finds or creates the student account for {row.email}, puts them in the batch below and
                grants {products.length ? products.map((p) => p.toUpperCase()).join(' and ') : 'no'} access. All of it happens together or not at all.
                No email is sent.
              </p>
              <div style={{ maxWidth: 260, marginBottom: 10 }}>
                <FieldLabel htmlFor="en-batch">Batch</FieldLabel>
                <FieldSelect id="en-batch" value={batch} onChange={(e) => setBatch(e.target.value)}>
                  <option value="">Choose a batch…</option>
                  {batchNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </FieldSelect>
                {batchNames.length === 0 && <p style={{ margin: '6px 0 0', fontSize: T_SM, color: RED }}>No active batch exists for this product. Create one first.</p>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <PrimaryBtn loading={busy} disabled={!batch || products.length === 0} onClick={async () => { await onEnrol(batch); setAsking(false); }}>Enrol and grant access</PrimaryBtn>
                <GhostBtn onClick={() => setAsking(false)}>Not yet</GhostBtn>
              </div>
            </div>
          ) : canEnrol ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {row.status === 'pending' && <GhostBtn onClick={onContacted} disabled={busy}>Mark contacted</GhostBtn>}
              <PrimaryBtn onClick={() => setAsking(true)} disabled={busy}>Mark enrolled and grant access</PrimaryBtn>
              <DangerBtn onClick={onCancel} disabled={busy}>Cancel registration</DangerBtn>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {row.status === 'pending' && <GhostBtn onClick={onContacted} disabled={busy}>Mark contacted</GhostBtn>}
              <DangerBtn onClick={onCancel} disabled={busy}>Cancel registration</DangerBtn>
              <span style={{ fontSize: T_SM, color: MUTED }}>Only admins can enrol and grant access.</span>
            </div>
          )}
        </div>
      )}

      {row.status === 'enrolled' && (
        <p style={{ margin: '16px 0 0', fontSize: T_SM, color: OK, background: OK_BG, display: 'inline-block', padding: '6px 10px', borderRadius: R_MD }}>
          <Stamp tone="ok">enrolled</Stamp> Access was granted. Manage their batch and products on the Users page.
        </p>
      )}
    </div>
  );
}

const lineStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0',
  borderBottom: `1px dotted ${BORDER_FIELD}`, fontSize: T_BASE,
};
