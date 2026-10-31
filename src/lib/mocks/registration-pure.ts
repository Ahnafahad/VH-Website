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

export const MOCK_SUBJECTS = ['English', 'Mathematics', 'Analytical'] as const;

export interface MockSlot {
  n: number;
  /** YYYY-MM-DD, Dhaka calendar date */
  date: string;
  /** 'HH:MM-HH:MM' 24h, Dhaka time */
  time: string;
}

// The routine for the November 2026 IBA mocks (times are Bangladesh time).
export const MOCK_SCHEDULE: readonly MockSlot[] = [
  { n: 1,  date: '2026-11-02', time: '14:00-16:00' },
  { n: 2,  date: '2026-11-05', time: '11:30-13:30' },
  { n: 3,  date: '2026-11-09', time: '14:00-16:00' },
  { n: 4,  date: '2026-11-12', time: '11:30-13:30' },
  { n: 5,  date: '2026-11-16', time: '14:00-16:00' },
  { n: 6,  date: '2026-11-19', time: '11:30-13:30' },
  { n: 7,  date: '2026-11-21', time: '09:00-11:00' },
  { n: 8,  date: '2026-11-23', time: '14:00-16:00' },
  { n: 9,  date: '2026-11-26', time: '11:30-13:30' },
  { n: 10, date: '2026-11-28', time: '09:00-11:00' },
];

export const MOCK_FEATURES = [
  { title: 'Data-driven mock statistics', body: 'Your score, your rank, and where you lost marks, section by section, against everyone who sat the paper.' },
  { title: 'Detailed solutions', body: 'Worked solutions for every paper, released with the official results.' },
  { title: "Examiner's report", body: 'What each paper tested, and the mistakes that cost the most marks.' },
  { title: 'Community support & guidance', body: 'Somewhere to ask questions and get guidance between mocks.' },
] as const;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Calendar-date parts for a YYYY-MM-DD string (no timezone maths: it is a Dhaka calendar date). */
export function slotDay(date: string): { weekday: string; day: number; month: string; year: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { weekday: DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], day: d, month: MONTHS[m - 1], year: y };
}

function clock12(hhmm: string): { t: string; ap: 'AM' | 'PM' } {
  const [h, m] = hhmm.split(':').map(Number);
  return { t: `${h % 12 || 12}:${String(m).padStart(2, '0')}`, ap: h >= 12 ? 'PM' : 'AM' };
}

/** '14:00-16:00' → '2:00 – 4:00 PM'; '11:30-13:30' → '11:30 AM – 1:30 PM'. */
export function formatSlotTime(time: string): string {
  const [a, b] = time.split('-').map(clock12);
  return a.ap === b.ap ? `${a.t} – ${b.t} ${b.ap}` : `${a.t} ${a.ap} – ${b.t} ${b.ap}`;
}

/** The first mock whose end time (Dhaka, UTC+6) has not passed yet, or null once the routine is over. */
export function nextMock(now: Date): MockSlot | null {
  return MOCK_SCHEDULE.find(s => {
    const end = s.time.split('-')[1];
    return new Date(`${s.date}T${end}:00+06:00`).getTime() > now.getTime();
  }) ?? null;
}
