/**
 * The three emails of mock registration: processing (with the schedule), access granted
 * (LexiCore + Zap) and "could not verify". Pure: each returns { subject, html, text } so they can
 * be unit-tested and previewed without sending. Table layout + inline styles for email clients.
 */

import { formatSlotTime, MOCK_ACCESS_DAYS, MOCK_FEE_BDT, MOCK_SCHEDULE, MOCK_SUBJECTS, slotDay } from './registration-pure';

const INK = '#1A0507';
const MAROON = '#760F13';
const CREAM = '#FAF5EF';
const PAPER = '#F5EDE3';
const TAN = '#D4B094';
const CLAY = '#A86E58';
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

export interface MockEmail { subject: string; html: string; text: string }

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const para = (html: string) =>
  `<p style="margin:0 0 18px 0;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK};">${html}</p>`;

const label = (t: string) =>
  `<p style="margin:0 0 10px 0;font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${CLAY};">${esc(t)}</p>`;

function button(href: string, text: string, tone: 'ink' | 'ghost' = 'ink'): string {
  const solid = tone === 'ink';
  return `<a href="${esc(href)}" style="display:inline-block;padding:14px 30px;border-radius:999px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:0.4px;text-decoration:none;${
    solid ? `background:${INK};color:${CREAM};border:1px solid ${INK};` : `background:transparent;color:${INK};border:1px solid ${INK};`
  }">${esc(text)}</a>`;
}

function shell(o: { title: string; preheader: string; kicker: string; heading: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>${esc(o.title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER};">${esc(o.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${CREAM};border:1px solid #E6D9CB;">
    <tr><td style="background:${INK};padding:26px 36px 22px 36px;">
      <p style="margin:0;font-family:${SERIF};font-size:15px;letter-spacing:5px;text-transform:uppercase;color:${CREAM};">Beyond</p>
      <p style="margin:0;font-family:${SERIF};font-size:15px;font-style:italic;color:${TAN};">the</p>
      <p style="margin:0;font-family:${SERIF};font-size:15px;letter-spacing:5px;text-transform:uppercase;color:${CREAM};">Horizons</p>
      <p style="margin:8px 0 0 0;font-family:${SANS};font-size:10px;letter-spacing:2px;color:${CLAY};">by Vertical Horizon</p>
    </td></tr>
    <tr><td style="height:3px;line-height:3px;font-size:0;background:${MAROON};">&nbsp;</td></tr>
    <tr><td style="padding:40px 36px 8px 36px;">
      ${label(o.kicker)}
      <h1 style="margin:0 0 24px 0;font-family:${SERIF};font-size:32px;line-height:1.15;font-weight:400;color:${INK};">${o.heading}</h1>
      ${o.body}
    </td></tr>
    <tr><td style="padding:8px 36px 36px 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${TAN};padding-top:18px;">
        <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.7;color:${CLAY};">
          Questions? WhatsApp <a href="https://wa.me/8801835200626" style="color:${MAROON};text-decoration:underline;">+880 1835-200626</a>, or reply to this email.<br />
          Beyond the Horizons by Vertical Horizon &middot; <a href="https://www.vh-beyondthehorizons.org" style="color:${CLAY};">vh-beyondthehorizons.org</a>
        </p>
      </td></tr></table>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function scheduleTable(): string {
  const th = (t: string, extra = '') =>
    `<td style="padding:0 0 8px 0;border-bottom:1px solid ${INK};font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${CLAY};${extra}">${t}</td>`;
  const rows = MOCK_SCHEDULE.map(s => {
    const d = slotDay(s.date);
    const td = (inner: string, extra = '') =>
      `<td style="padding:11px 0;border-bottom:1px solid #E6D9CB;font-family:${SANS};font-size:14px;color:${INK};${extra}">${inner}</td>`;
    return `<tr>
      ${td(`<span style="font-family:'Times New Roman',Times,serif;font-size:21px;color:${MAROON};">${String(s.n).padStart(2, '0')}</span>`, 'width:48px;')}
      ${td(`${d.weekday}<br /><span style="color:${CLAY};font-size:13px;">${d.day} ${d.month} ${d.year}</span>`)}
      ${td(formatSlotTime(s.time), 'text-align:right;white-space:nowrap;')}
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px 0;">
    <tr>${th('Mock', 'width:48px;')}${th('Day')}${th('Time', 'text-align:right;')}</tr>${rows}</table>
    <p style="margin:8px 0 28px 0;font-family:${SANS};font-size:12px;color:${CLAY};">All times are Bangladesh time.</p>`;
}

function textSchedule(): string {
  return MOCK_SCHEDULE.map(s => {
    const d = slotDay(s.date);
    return `  ${String(s.n).padStart(2, '0')}  ${d.weekday}, ${d.day} ${d.month} ${d.year}  ${formatSlotTime(s.time)}`;
  }).join('\n');
}

export function processingEmail(o: { name: string; reference: string; trxId: string | null; statusUrl: string }): MockEmail {
  const subject = 'Your mock registration is being processed';
  const summary = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;background:${PAPER};border-left:3px solid ${MAROON};"><tr><td style="padding:16px 20px;font-family:${SANS};font-size:13px;line-height:1.9;color:${INK};">
    <span style="color:${CLAY};">Fee</span>&nbsp; ${MOCK_FEE_BDT.toLocaleString('en-US')} BDT via bKash<br />
    <span style="color:${CLAY};">Reference</span>&nbsp; ${esc(o.reference)}<br />
    <span style="color:${CLAY};">Transaction ID</span>&nbsp; ${o.trxId ? esc(o.trxId) : 'screenshot sent'}
  </td></tr></table>`;
  const body = [
    para(`Hi ${esc(o.name)},`),
    para(`We have your payment details and we are checking them against bKash now. As soon as your registration is approved you will get a second email, and your LexiCore and Zap access opens with it.`),
    summary,
    label('Your mock schedule'),
    para(`Ten full-length IBA mocks (${MOCK_SUBJECTS.join(', ')}) between 2 and 28 November 2026.`),
    scheduleTable(),
    `<p style="margin:0 0 32px 0;">${button(o.statusUrl, 'Track my registration')}</p>`,
  ].join('');
  const text = `Hi ${o.name},

We have your payment details and are checking them against bKash. You will get a second email as soon as your registration is approved.

Fee: ${MOCK_FEE_BDT} BDT via bKash
Reference: ${o.reference}
Transaction ID: ${o.trxId ?? 'screenshot sent'}

Your mock schedule (Bangladesh time):
${textSchedule()}

Track your registration: ${o.statusUrl}
`;
  return { subject, html: shell({ title: subject, preheader: 'We have your payment details. Here is your mock schedule.', kicker: 'Mock registration', heading: 'Your registration is <em style="color:' + MAROON + ';">being processed</em>', body }), text };
}

export function accessEmail(o: { name: string; untilText: string; lexicoreUrl: string; zapUrl: string; statusUrl: string }): MockEmail {
  const subject = 'You are in: LexiCore and Zap are open';
  const card = (title: string, blurb: string, href: string, cta: string, note?: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;border:1px solid ${INK};"><tr><td style="padding:22px 24px;">
      <p style="margin:0 0 6px 0;font-family:${SERIF};font-size:24px;color:${INK};">${title}</p>
      ${note ? `<p style="margin:0 0 10px 0;font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${MAROON};">${note}</p>` : ''}
      <p style="margin:0 0 18px 0;font-family:${SANS};font-size:14px;line-height:1.65;color:${INK};">${blurb}</p>
      ${button(href, cta)}
    </td></tr></table>`;
  const body = [
    para(`Hi ${esc(o.name)},`),
    para(`Your payment is verified and your mock registration is confirmed. Two things are now open on your account.`),
    card('LexiCore', 'Our vocabulary app. It turns the words that matter for admission tests into short daily practice, and brings each one back for review just before you would forget it.', o.lexicoreUrl, 'Open LexiCore', `Full access until ${esc(o.untilText)}`),
    card('Zap', 'Our mental-math game. Quick rounds that build the speed you need in the Mathematics section.', o.zapUrl, 'Play Zap'),
    para(`<span style="color:${CLAY};">LexiCore stays fully open for ${MOCK_ACCESS_DAYS} days. After that it returns to the free word set, and your progress is kept.</span>`),
    `<p style="margin:8px 0 32px 0;font-family:${SANS};font-size:14px;color:${INK};">Your mock schedule is always on your <a href="${esc(o.statusUrl)}" style="color:${MAROON};">registration page</a>.</p>`,
  ].join('');
  const text = `Hi ${o.name},

Your payment is verified and your mock registration is confirmed. Two things are now open on your account:

LexiCore (full access until ${o.untilText}): ${o.lexicoreUrl}
Our vocabulary app: short daily practice with spaced review.

Zap: ${o.zapUrl}
Our mental-math game.

After ${MOCK_ACCESS_DAYS} days LexiCore returns to the free word set; your progress is kept.
Your mock schedule is on your registration page: ${o.statusUrl}
`;
  return { subject, html: shell({ title: subject, preheader: `LexiCore (until ${o.untilText}) and Zap are now open on your account.`, kicker: 'Mock registration', heading: 'You are in. <em style="color:' + MAROON + ';">LexiCore and Zap are open.</em>', body }), text };
}

export function rejectedEmail(o: { name: string; note: string; statusUrl: string }): MockEmail {
  const subject = 'About your mock registration';
  const body = [
    para(`Hi ${esc(o.name)},`),
    para(`We could not verify your payment yet.`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;background:${PAPER};border-left:3px solid ${MAROON};"><tr><td style="padding:16px 20px;font-family:${SANS};font-size:14px;line-height:1.7;color:${INK};">${esc(o.note)}</td></tr></table>`,
    para(`Check the details and submit again, or message us on WhatsApp and we will sort it out.`),
    `<p style="margin:0 0 32px 0;">${button(o.statusUrl, 'Fix my registration')}</p>`,
  ].join('');
  const text = `Hi ${o.name},\n\nWe could not verify your payment yet.\n\n${o.note}\n\nCheck the details and submit again: ${o.statusUrl}\nOr WhatsApp us: +8801835200626\n`;
  return { subject, html: shell({ title: subject, preheader: 'We could not verify your payment yet.', kicker: 'Mock registration', heading: 'We could not verify <em style="color:' + MAROON + ';">your payment</em>', body }), text };
}
