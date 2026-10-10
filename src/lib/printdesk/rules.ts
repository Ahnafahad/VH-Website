/**
 * Pure PrintDesk rules — no DB, unit-tested.
 */

import type { PrintRequestStatus } from '@/lib/db/schema';

/** Statuses that hold their materials: the same material can't be requested again while one of these is open. */
export const LIVE_STATUSES: PrintRequestStatus[] = ['requested', 'printed', 'collected'];

export const MAX_ITEMS_PER_REQUEST = 50;

/** Staff transitions. A download moves requested → printed on its own. */
const STAFF_TRANSITIONS: Record<PrintRequestStatus, PrintRequestStatus[]> = {
  requested: ['printed', 'rejected'],
  printed: ['collected', 'rejected', 'requested'],
  collected: ['printed'],
  rejected: [],
  cancelled: [],
};

export function canStaffMove(from: PrintRequestStatus, to: PrintRequestStatus): boolean {
  return STAFF_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isPrintableMaterial(m: { type: string; docType: string | null }, solutionIds: Set<number>, id: number): boolean {
  return m.type === 'pdf' && m.docType !== 'solution' && !solutionIds.has(id);
}

/**
 * Validates a student's selection. `printable` = ids they may request;
 * `taken` = ids already on another live request of theirs.
 * Returns the de-duplicated ids or an error message.
 */
export function validateSelection(raw: unknown, printable: Set<number>, taken: Set<number>): { ids: number[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Choose at least one material' };
  const ids = [...new Set(raw.map(Number))];
  if (ids.length === 0) return { error: 'Choose at least one material' };
  if (ids.length > MAX_ITEMS_PER_REQUEST) return { error: `At most ${MAX_ITEMS_PER_REQUEST} materials per request` };
  if (ids.some(id => !Number.isInteger(id) || !printable.has(id))) return { error: 'One of those materials is not available to print' };
  if (ids.some(id => taken.has(id))) return { error: 'You have already requested one of those materials' };
  return { ids };
}

export interface PackLine {
  materialId: number;
  title: string;
  subject: string;
  students: string[];
}

/** The plain-text summary that goes into the zip. */
export function packSummary(lines: PackLine[], fileNames: Map<number, string>, generatedAt: Date, failed: Set<number> = new Set()): string {
  const when = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(generatedAt);
  const totalCopies = lines.reduce((n, l) => n + l.students.length, 0);
  const out = [
    'PRINTDESK — PRINT LIST',
    `Generated ${when} (Dhaka)`,
    `${lines.length} material${lines.length === 1 ? '' : 's'}, ${totalCopies} cop${totalCopies === 1 ? 'y' : 'ies'} in total`,
    '',
    'COPIES TO PRINT',
  ];
  lines.forEach((l, i) => {
    const copies = l.students.length;
    out.push(`${i + 1}. ${l.title} — ${copies} cop${copies === 1 ? 'y' : 'ies'}  [${fileNames.get(l.materialId) ?? ''}]${failed.has(l.materialId) ? '  !! FILE COULD NOT BE DOWNLOADED — get it from Materials' : ''}`);
  });
  out.push('', 'WHO ASKED FOR WHAT');
  lines.forEach((l, i) => {
    out.push(`${i + 1}. ${l.title} (${l.subject})`);
    [...l.students].sort((a, b) => a.localeCompare(b)).forEach(s => out.push(`     - ${s}`));
  });
  return out.join('\r\n') + '\r\n';
}
