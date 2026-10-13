import { db } from '@/lib/db';
import { csvRow } from './csv';

export const EXPORT_MAX_ROWS = 100_000;
const PAGE = 1000;

export interface ExportDef {
  header: string[];
  from: string;          // FROM/JOIN clause; the base table alias is always `t`
  select: string;        // columns, in header order
  where?: string;       // extra condition, may use ? bound to `arg`
  needsArg?: boolean;
}

export const EXPORTS: Record<string, ExportDef> = {
  users: {
    header: ['id', 'name', 'email', 'role', 'status', 'student_id', 'batch', 'class', 'whatsapp', 'created_at'],
    from: 'users t',
    select: `t.id, t.name, t.email, t.role, t.status, t.student_id, t.batch, t.class, t.whatsapp, datetime(t.created_at, 'unixepoch')`,
  },
  marks: {
    header: ['attempt_id', 'name', 'email', 'student_id', 'batch', 'mode', 'status', 'score', 'correct', 'wrong', 'unattempted', 'submitted_at'],
    from: 'test_attempts t JOIN users u ON u.id = t.user_id',
    select: `t.id, u.name, u.email, u.student_id, u.batch, t.mode, t.status, t.total_score, t.total_correct, t.total_wrong, t.total_unattempted, datetime(t.submitted_at, 'unixepoch')`,
    where: 't.test_id = ?',
    needsArg: true,
  },
  registrations: {
    header: ['id', 'name', 'email', 'phone', 'education_type', 'program_mode', 'final_price', 'status', 'created_at'],
    from: 'registrations t',
    select: `t.id, t.name, t.email, t.phone, t.education_type, t.program_mode, t.pricing_final_price, t.status, datetime(t.created_at, 'unixepoch')`,
  },
  attendance: {
    header: ['id', 'session', 'subject', 'session_date', 'name', 'email', 'batch', 'mode', 'source', 'joined_at'],
    from: 'class_attendance t JOIN class_sessions s ON s.id = t.session_id JOIN users u ON u.id = t.user_id',
    select: `t.id, s.title, s.subject, datetime(s.scheduled_at, 'unixepoch'), u.name, u.email, u.batch, t.mode, t.source, datetime(t.joined_at, 'unixepoch')`,
  },
};

export async function countExport(def: ExportDef, arg?: number): Promise<number> {
  const rs = await db.$client.execute({ sql: `SELECT count(*) AS n FROM ${def.from}${def.where ? ` WHERE ${def.where}` : ''}`, args: def.needsArg ? [arg!] : [] });
  return Number(rs.rows[0]?.n ?? 0);
}

/** Pages by primary key so memory stays flat; each chunk is already CSV-escaped. */
export function streamExport(def: ExportDef, arg?: number): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let after = 0;
  let sentHeader = false;
  return new ReadableStream({
    async pull(ctrl) {
      if (!sentHeader) { sentHeader = true; ctrl.enqueue(enc.encode('﻿' + csvRow(def.header))); return; }
      const where = ['t.id > ?', def.where].filter(Boolean).join(' AND ');
      const rs = await db.$client.execute({
        sql: `SELECT ${def.select}, t.id AS _id FROM ${def.from} WHERE ${where} ORDER BY t.id LIMIT ${PAGE}`,
        args: def.needsArg ? [after, arg!] : [after],
      });
      if (!rs.rows.length) { ctrl.close(); return; }
      let out = '';
      for (const r of rs.rows) {
        out += csvRow(Array.from(r).slice(0, rs.columns.length - 1).map(v => (typeof v === 'bigint' ? v.toString() : v)));
        after = Number(r[rs.columns.length - 1]);
      }
      ctrl.enqueue(enc.encode(out));
      if (rs.rows.length < PAGE) ctrl.close();
    },
  });
}
