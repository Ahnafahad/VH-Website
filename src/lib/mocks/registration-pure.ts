/** Pure helpers for mock registration (no DB/R2 imports, so they unit-test without a database). */

export const MOCK_ACCESS_DAYS = 30;
export const MOCK_FEE_BDT = 3500;

export type MockRegStatus = 'registered' | 'submitted' | 'approved' | 'rejected';

/** Bangladeshi mobile → 01XXXXXXXXX, or null when it isn't one. */
export function normalizeBdPhone(raw: string): string | null {
  const d = raw.replace(/[\s\-()]/g, '').replace(/^\+?880/, '0');
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

/** The bKash reference the student must type: "Name_bthibamock" (letters/digits only in Name). */
export function paymentReference(name: string): string {
  const clean = name.normalize('NFKD').replace(/[^A-Za-z0-9]/g, '');
  return `${clean || 'Student'}_bthibamock`;
}

export function accessUntil(from: Date): Date {
  return new Date(from.getTime() + MOCK_ACCESS_DAYS * 86_400_000);
}
