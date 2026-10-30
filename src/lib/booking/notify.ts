/**
 * Emails for the 1-on-1 session request flow. One shared template; every
 * send is best-effort (a mail failure must never fail the booking itself).
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function baseUrl(): string {
  return (process.env.NEXTAUTH_URL ?? 'https://www.vh-beyondthehorizons.org').replace(/\/$/, '');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatDhaka(ms: number): string {
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(ms));
}

/** "Mon, 2 Nov, 9:00 pm – 12:00 am" style range for offers. */
export function formatRange(startAt: number, endAt: number): string {
  const time = new Intl.DateTimeFormat('en-BD', { timeStyle: 'short', timeZone: 'Asia/Dhaka' });
  return `${formatDhaka(startAt)} – ${time.format(new Date(endAt))}`;
}

interface MailInput {
  to: string;
  subject: string;
  heading: string;
  intro: string;
  /** label → value rows; values are escaped, `link` rows become anchors. */
  details?: Array<{ label: string; value: string; link?: boolean }>;
  ctaLabel: string;
  /** Path on this site, e.g. /dashboard/book */
  ctaPath: string;
}

async function send(m: MailInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[booking] RESEND_API_KEY not set — skipping email:', m.subject);
    return;
  }
  const rows = (m.details ?? [])
    .map((d) => {
      const v = d.link
        ? `<a href="${esc(d.value)}" style="color:#1A0507;">${esc(d.value)}</a>`
        : esc(d.value);
      return `<tr><td style="padding:4px 14px 4px 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#A86E58;vertical-align:top;">${esc(d.label)}</td><td style="padding:4px 0;font-size:14px;color:#1A0507;">${v}</td></tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#FAF5EF;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1A0507;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="background:#1A0507;padding:24px 32px;">
      <p style="margin:0 0 4px 0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#D4B094;">VH 1-on-1 Sessions</p>
      <h1 style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:400;color:#FAF5EF;">${esc(m.heading)}</h1>
    </div>
    <div style="padding:28px 32px;background:#FAF5EF;">
      <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#3D1A0E;">${esc(m.intro)}</p>
      ${rows ? `<table style="background:#fff;border-left:3px solid #D4B094;padding:14px 18px;margin-bottom:22px;width:100%;border-collapse:collapse;">${rows}</table>` : ''}
      <a href="${baseUrl()}${m.ctaPath}" style="display:inline-block;background:#1A0507;color:#FAF5EF;text-decoration:none;padding:12px 28px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">${esc(m.ctaLabel)}</a>
    </div>
  </div>
</body></html>`;

  const result = await resend.emails.send({
    from: 'VH Sessions <noreply@vh-beyondthehorizons.org>',
    to: m.to,
    subject: m.subject,
    html,
  });
  if (result.error) console.error('[booking] email failed:', m.subject, result.error);
}

/** Fire-and-forget batch: never throws. */
export async function sendAll(mails: MailInput[]): Promise<void> {
  const results = await Promise.allSettled(mails.map(send));
  for (const r of results) {
    if (r.status === 'rejected') console.error('[booking] email threw:', r.reason);
  }
}

export interface RequestFacts {
  studentName: string;
  subjectLabel: string;
  topic: string;
  durationMinutes: number;
  modeLabel: string;
  notes?: string | null;
}

function requestRows(f: RequestFacts) {
  const rows = [
    { label: 'Student', value: f.studentName },
    { label: 'Subject', value: f.subjectLabel },
    { label: 'Topic', value: f.topic },
    { label: 'Length', value: `${f.durationMinutes} min` },
    { label: 'Mode', value: f.modeLabel },
  ];
  if (f.notes) rows.push({ label: 'Notes', value: f.notes });
  return rows;
}

const STAFF_PATH = '/admin/bookings';
const STUDENT_PATH = '/dashboard/book';

export const mails = {
  /** New request, or the student answered a counter with new times → instructors. */
  requested(to: string, f: RequestFacts, times: number[], again: boolean): MailInput {
    return {
      to,
      subject: again
        ? `${f.studentName} suggested new times for a 1-on-1`
        : `New 1-on-1 request: ${f.studentName} · ${f.subjectLabel}`,
      heading: again ? 'New times suggested' : 'New session request',
      intro: again
        ? `${f.studentName} can't do your proposed times and suggested these instead.`
        : `${f.studentName} would like a 1-on-1 session. Accept one of their times, or propose your own.`,
      details: [
        ...requestRows(f),
        ...times.map((t, i) => ({ label: `Time ${i + 1}`, value: formatDhaka(t) + ' (Dhaka)' })),
      ],
      ctaLabel: 'Open request',
      ctaPath: STAFF_PATH,
    };
  },

  /** Instructor countered → student. */
  proposed(to: string, f: RequestFacts, instructorName: string, offers: Array<{ startAt: number; endAt?: number }>): MailInput {
    return {
      to,
      subject: `${instructorName} proposed times for your 1-on-1`,
      heading: 'Pick a time',
      intro: `${instructorName} can't do your times but offered these. Open the page and pick one to confirm.`,
      details: [
        { label: 'Subject', value: f.subjectLabel },
        { label: 'Topic', value: f.topic },
        ...offers.map((o, i) => ({
          label: o.endAt ? `Range ${i + 1}` : `Time ${i + 1}`,
          value: (o.endAt ? formatRange(o.startAt, o.endAt) : formatDhaka(o.startAt)) + ' (Dhaka)',
        })),
      ],
      ctaLabel: 'Choose a time',
      ctaPath: STUDENT_PATH,
    };
  },

  /** Both sides agreed → student and instructor. */
  confirmed(to: string, f: RequestFacts, startAt: number, withWhom: string, online: boolean, linkOrLocation: string | null, forStudent: boolean): MailInput {
    return {
      to,
      subject: `Confirmed: ${f.subjectLabel} 1-on-1, ${formatDhaka(startAt)}`,
      heading: 'Session confirmed',
      intro: forStudent
        ? `Your session with ${withWhom} is confirmed. A calendar invite is on its way too.`
        : `Your session with ${withWhom} is confirmed. A calendar invite is on its way too.`,
      details: [
        { label: 'When', value: formatDhaka(startAt) + ' (Dhaka)' },
        { label: 'With', value: withWhom },
        { label: 'Subject', value: f.subjectLabel },
        { label: 'Topic', value: f.topic },
        ...(linkOrLocation
          ? [{ label: online ? 'Meet link' : 'Location', value: linkOrLocation, link: online }]
          : []),
      ],
      ctaLabel: 'View session',
      ctaPath: forStudent ? STUDENT_PATH : STAFF_PATH,
    };
  },

  declined(to: string, f: RequestFacts, instructorName: string, note?: string | null): MailInput {
    return {
      to,
      subject: `Your 1-on-1 request couldn't be accommodated`,
      heading: 'Request declined',
      intro: `${instructorName} wasn't able to take this request.${note ? ` Note: ${note}` : ''} You can send a new request with different times.`,
      details: [
        { label: 'Subject', value: f.subjectLabel },
        { label: 'Topic', value: f.topic },
      ],
      ctaLabel: 'Request again',
      ctaPath: STUDENT_PATH,
    };
  },

  cancelled(to: string, f: RequestFacts, byName: string, startAt: number | null, forStudent: boolean): MailInput {
    return {
      to,
      subject: `1-on-1 cancelled: ${f.subjectLabel}`,
      heading: 'Session cancelled',
      intro: `${byName} cancelled this 1-on-1.`,
      details: [
        ...(startAt ? [{ label: 'Was at', value: formatDhaka(startAt) + ' (Dhaka)' }] : []),
        { label: 'Subject', value: f.subjectLabel },
        { label: 'Topic', value: f.topic },
      ],
      ctaLabel: forStudent ? 'Request again' : 'Open bookings',
      ctaPath: forStudent ? STUDENT_PATH : STAFF_PATH,
    };
  },
};
