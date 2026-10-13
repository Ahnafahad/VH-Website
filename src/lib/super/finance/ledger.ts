/** Finance data access: registrations fee pipeline, revenue rollups, ledger CSV. Pure maths lives in money.ts. */
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { operationalEntries, registrationPayments, registrations, users } from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import { recordAudit } from '@/lib/audit-log';
import {
  deriveStatus, feesDue, groupBy, monthlyTotals, paidTotal, paisaToBdt, productLabel, toCsv, type PaymentState,
} from './money';

const FOLLOW_UP_NOTE = 'follow-up'; // marker rows: amount 0, status 'pending', note = this

export interface PipelineRow {
  id: number; name: string; email: string; phone: string; regStatus: string; product: string;
  due: number; paid: number; state: PaymentState; followUpAt: number | null;
  payments: { id: number; amount: number; method: string; status: string; note: string | null; at: number }[];
}

export async function getPipeline(): Promise<PipelineRow[]> {
  const [regs, pays] = await Promise.all([
    db.select().from(registrations).orderBy(desc(registrations.id)),
    db.select().from(registrationPayments).orderBy(asc(registrationPayments.id)),
  ]);
  const byReg = new Map<number, typeof pays>();
  for (const p of pays) byReg.set(p.registrationId, [...(byReg.get(p.registrationId) ?? []), p]);

  return regs.map(r => {
    const ps = byReg.get(r.id) ?? [];
    const money = ps.filter(p => !(p.amount === 0 && p.note === FOLLOW_UP_NOTE));
    const markers = ps.filter(p => p.amount === 0 && p.note === FOLLOW_UP_NOTE);
    const due = feesDue(r);
    const paid = paidTotal(money);
    return {
      id: r.id, name: r.name, email: r.email, phone: r.phone, regStatus: r.status, product: productLabel(r),
      due, paid, state: deriveStatus(due, paid, money.some(p => p.amount < 0)),
      followUpAt: markers.length ? markers[markers.length - 1].followUpAt?.getTime() ?? null : null,
      payments: money.map(p => ({ id: p.id, amount: p.amount, method: p.method, status: p.status, note: p.note, at: p.createdAt.getTime() })),
    };
  });
}

export const paymentInput = z.object({
  kind: z.enum(['payment', 'refund']),
  amount: z.number().int().positive().max(10_000_000),
  method: z.enum(['cash', 'bkash', 'bank', 'other']),
  note: z.string().trim().max(500).optional(),
});

async function requireRegistration(id: number) {
  const reg = await db.select().from(registrations).where(eq(registrations.id, id)).get();
  if (!reg) throw new ApiException('Registration not found', 404);
  return reg;
}

export async function recordPayment(regId: number, input: z.infer<typeof paymentInput>, actorId: number) {
  await requireRegistration(regId);
  const row = (await getPipeline()).find(r => r.id === regId)!;
  if (input.kind === 'refund' && input.amount > row.paid) throw new ApiException(`Refund exceeds the net paid amount (${row.paid} BDT)`, 400);
  const amount = input.kind === 'refund' ? -input.amount : input.amount;
  let insertedId: number;
  if (input.kind === 'refund') {
    // Check + insert in ONE statement so two concurrent refunds can't both pass the balance check.
    const rs = await db.$client.execute({
      sql: `INSERT INTO registration_payments (registration_id, amount, method, status, note, recorded_by)
            SELECT ?, ?, ?, 'refunded', ?, ?
            WHERE (SELECT coalesce(sum(amount), 0) FROM registration_payments WHERE registration_id = ? AND status != 'pending') >= ?
            RETURNING id`,
      args: [regId, amount, input.method, input.note || null, actorId, regId, input.amount],
    });
    if (!rs.rows.length) throw new ApiException('Refund exceeds the net paid amount', 400);
    insertedId = Number(rs.rows[0].id);
  } else {
    insertedId = (await db.insert(registrationPayments).values({
      registrationId: regId, amount, method: input.method, status: 'paid', note: input.note || null, recordedBy: actorId,
    }).returning({ id: registrationPayments.id }).get()).id;
  }
  await recordAudit({ actorUserId: actorId, action: input.kind === 'refund' ? 'finance.refund' : 'finance.payment', entityType: 'registration', entityId: regId,
    before: { paid: row.paid, state: row.state }, after: { paymentId: insertedId, amount, method: input.method, note: input.note ?? null } });
  return insertedId;
}

/** date = 'YYYY-MM-DD' (Dhaka calendar day) or null to clear. */
export async function setFollowUp(regId: number, date: string | null, actorId: number) {
  await requireRegistration(regId);
  const at = date ? new Date(`${date}T00:00:00+06:00`) : null;
  if (date && Number.isNaN(at!.getTime())) throw new ApiException('Invalid date', 400);
  await db.insert(registrationPayments).values({
    registrationId: regId, amount: 0, method: 'other', status: 'pending', note: FOLLOW_UP_NOTE, followUpAt: at, recordedBy: actorId,
  });
  await recordAudit({ actorUserId: actorId, action: 'finance.followup', entityType: 'registration', entityId: regId, after: { followUp: date } });
}

export async function getRevenue() {
  const [pays, regs, usr, ops] = await Promise.all([
    db.select().from(registrationPayments),
    db.select().from(registrations),
    db.select({ email: users.email, batch: users.batch }).from(users),
    db.select().from(operationalEntries),
  ]);
  const regById = new Map(regs.map(r => [r.id, r]));
  const batchByEmail = new Map(usr.map(u => [u.email.toLowerCase(), u.batch]));
  const money = pays.filter(p => p.status !== 'pending' && regById.has(p.registrationId));
  const enriched = money.map(p => {
    const r = regById.get(p.registrationId)!;
    return { amount: p.amount, createdAtMs: p.createdAt.getTime(), batch: batchByEmail.get(r.email.toLowerCase()) ?? 'Unassigned', product: productLabel(r) };
  });
  return {
    byBatch: groupBy(enriched, x => x.batch, x => x.amount),
    byProduct: groupBy(enriched, x => x.product, x => x.amount),
    byMonth: monthlyTotals(enriched, ops),
    totals: {
      registrationsBdt: enriched.reduce((s, x) => s + x.amount, 0),
      opIncomeBdt: paisaToBdt(ops.filter(o => o.kind === 'income').reduce((s, o) => s + o.amountMinor, 0)),
      opExpenseBdt: paisaToBdt(ops.filter(o => o.kind === 'expense').reduce((s, o) => s + o.amountMinor, 0)),
    },
  };
}

export async function ledgerCsv(): Promise<string> {
  const [pays, regs, ops] = await Promise.all([
    db.select().from(registrationPayments).orderBy(asc(registrationPayments.id)),
    db.select({ id: registrations.id, name: registrations.name }).from(registrations),
    db.select().from(operationalEntries).orderBy(asc(operationalEntries.date)),
  ]);
  const nameById = new Map(regs.map(r => [r.id, r.name]));
  const rows: (string | number | null)[][] = [['source', 'date', 'reference', 'type', 'method_or_category', 'amount_bdt', 'note']];
  for (const p of pays) {
    if (p.amount === 0 && p.note === FOLLOW_UP_NOTE) continue;
    rows.push(['registration', p.createdAt.toISOString().slice(0, 10), `#${p.registrationId} ${nameById.get(p.registrationId) ?? ''}`.trim(), p.amount < 0 ? 'refund' : p.status, p.method, p.amount, p.note]);
  }
  for (const o of ops) rows.push(['operational', o.date, `entry ${o.id}`, o.kind, o.category, paisaToBdt(o.amountMinor), o.description]);
  return toCsv(rows);
}
