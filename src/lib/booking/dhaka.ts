// Client-safe Dhaka time helpers for the booking screens (Dhaka is UTC+6, no DST).
// <input type="datetime-local"> values are always read/written as Dhaka wall-clock
// time, so the result never depends on the browser's own timezone.

const OFFSET_MS = 6 * 3_600_000;

/** 'YYYY-MM-DDTHH:mm' (Dhaka wall-clock) → epoch ms. NaN for an empty/invalid value. */
export function dhakaLocalToEpoch(value: string): number {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return NaN;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MS;
}

/** epoch ms → 'YYYY-MM-DDTHH:mm' in Dhaka wall-clock time. */
export function epochToDhakaLocal(ms: number): string {
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 16);
}

export function fmtDhaka(ms: number): string {
  return new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(ms));
}

/** "2 Nov 2026, 9:00 pm – 12:00 am" */
export function fmtRange(startAt: number, endAt: number): string {
  const t = new Intl.DateTimeFormat('en-BD', { timeStyle: 'short', timeZone: 'Asia/Dhaka' });
  return `${fmtDhaka(startAt)} – ${t.format(new Date(endAt))}`;
}
