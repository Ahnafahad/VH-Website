import { z } from 'zod';

export const operationalSections = ['instructors', 'expenses', 'income', 'extra-classes'] as const;
export type OperationalSection = typeof operationalSections[number];

export function isOperationalAdmin(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Enter a valid date');

export const financialEntryInput = z.object({
  date,
  amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter a positive amount with up to two decimal places')
    .transform(value => {
      const [whole, fraction = ''] = value.split('.');
      return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    }).refine(value => value > 0, 'Amount must be greater than zero'),
  category: z.string().trim().min(1, 'Category or source is required').max(120),
  description: z.string().trim().max(2000).default(''),
});

export const extraClassInput = z.object({
  instructorId: z.number().int().positive(),
  subject: z.string().trim().min(1, 'Subject is required').max(120),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  roomNumber: z.string().trim().min(1, 'Room number is required').max(80),
  status: z.enum(['scheduled', 'completed', 'cancelled']),
  notes: z.string().trim().max(2000).default(''),
}).refine(value => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
  message: 'End time must be after start time', path: ['endsAt'],
});

export interface InstructorReport {
  months: { key: string; label: string }[];
  instructors: { id: number | null; name: string; counts: number[]; total: number }[];
}

interface TaughtSession {
  instructorId: number | null;
  instructorName: string | null;
  scheduledAt: Date;
  status: string;
}

export function buildInstructorReport(
  sessions: TaughtSession[], teachingUsers: { id: number; name: string }[], now = new Date(),
): InstructorReport {
  const monthIndex = (date: Date) => {
    const dhaka = new Date(date.getTime() + 6 * 60 * 60 * 1000);
    return dhaka.getUTCFullYear() * 12 + dhaka.getUTCMonth();
  };
  const completed = sessions.filter(s => s.status === 'completed' && s.scheduledAt <= now);
  const end = monthIndex(now);
  const start = completed.reduce((first, s) => Math.min(first, monthIndex(s.scheduledAt)), end);
  const months = Array.from({ length: end - start + 1 }, (_, i) => {
    const value = new Date(Date.UTC(Math.floor((start + i) / 12), (start + i) % 12, 1));
    return {
      key: value.toISOString().slice(0, 7),
      label: value.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    };
  });
  const names = new Map<number | null, string>(teachingUsers.map(u => [u.id, u.name]));
  for (const s of completed) {
    names.set(s.instructorId, s.instructorName ?? (s.instructorId === null ? 'Unassigned' : 'Unknown instructor'));
  }
  const counts = new Map([...names.keys()].map(id => [id, months.map(() => 0)]));
  for (const s of completed) counts.get(s.instructorId)![monthIndex(s.scheduledAt) - start]++;
  return {
    months,
    instructors: [...names].map(([id, name]) => ({
      id, name, counts: counts.get(id)!, total: counts.get(id)!.reduce((sum, n) => sum + n, 0),
    })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export interface FinancialEntryRecord {
  id: number;
  date: string;
  amountMinor: number;
  category: string;
  description: string;
}

export interface ExtraClassRecord {
  id: number;
  instructorId: number;
  instructorName: string | null;
  subject: string;
  startsAt: string;
  endsAt: string;
  roomNumber: string;
  status: string;
  notes: string;
}
