/**
 * "Your mock results are in": the rich results email (rank, scores, per-section marks, missed chances,
 * top 10, optional reward block). Pure: returns { subject, html, text }. Table layout + inline styles for email clients.
 */

import { esc, type MockEmail } from './registration-emails';

const INK = '#1A0507', MAROON = '#760F13', DEEP = '#460809', CREAM = '#FAF5EF', PAPER = '#F5EDE3', TAN = '#D4B094', CLAY = '#A86E58', LINE = '#E6D9CB';
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const SITE = 'https://www.vh-beyondthehorizons.org';

export interface ResultsEmailInput {
  name: string;                 // stored full name, used as-is
  mockTitle: string;
  mockNumber: number | null;    // for "Mock 4" wording; null falls back to the title
  rank: number; outOf: number; percentile: number;
  combined: number; combinedMax: number; mcq: number; mcqMax: number; essay: number; essayMax: number;
  avgCombined: number | null;
  /** only for external students: their place among externals */
  externalRank: { rank: number; outOf: number } | null;
  sections: { title: string; score: number; max: number; correct: number; wrong: number; skipped: number; penalty: number }[];
  missed: { number: number; section: string; pct: number; mine: 'wrong' | 'skipped'; yourAnswer: string | null; correctAnswer: string }[];
  board: { rank: number; name: string; mcq: number; essay: number; total: number; me: boolean }[];
  /** top-5-external reward: access to `rewardFromMock` onwards, with its schedule */
  reward: { fromMock: number; schedule: { n: number; day: string; date: string; time: string }[] } | null;
  resultsUrl: string; mockUrl: string;
}

export const ordinal = (n: number): string => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};
const num = (x: number): string => String(Math.round(x * 100) / 100);
const marks = (x: number): string => `${num(x)} ${num(x) === '1' ? 'mark' : 'marks'}`;

const label = (t: string, c = CLAY) => `<div style="font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${c};margin:0 0 12px;">${t}</div>`;
const h2 = (t: string) => `<div style="font-family:${SERIF};font-size:22px;color:${INK};margin:0 0 4px;">${t}</div>`;
const sec = (inner: string, pad = '34px 36px 0') => `<tr><td style="padding:${pad};">${inner}</td></tr>`;
const note = (t: string) => `<div style="font-family:${SANS};font-size:12px;color:${CLAY};margin:0 0 6px;">${t}</div>`;

/** Score bar built from table cells (Gmail/Outlook strip absolute positioning). Negative scores draw empty. */
function bar(score: number, max: number): string {
  const p = max > 0 ? Math.max(0, Math.min(100, Math.round((score / max) * 100))) : 0;
  const fill = p > 0 ? `<td width="${p}%" style="width:${p}%;height:10px;font-size:0;line-height:0;background:${MAROON};">&nbsp;</td>` : '';
  const rest = p < 100 ? `<td style="height:10px;font-size:0;line-height:0;">&nbsp;</td>` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};background:${PAPER};"><tr>${fill}${rest}</tr></table>`;
}

function rewardBlock(i: ResultsEmailInput): string {
  const r = i.reward!;
  const rows = r.schedule.map(s => `<tr>
    <td style="padding:9px 0;border-bottom:1px solid #6b1f20;width:44px;font-family:${SERIF};font-size:20px;color:${TAN};">${String(s.n).padStart(2, '0')}</td>
    <td style="padding:9px 0;border-bottom:1px solid #6b1f20;font-family:${SANS};font-size:14px;color:${CREAM};">${esc(s.day)}<br><span style="color:#cdb7a6;font-size:13px;">${esc(s.date)}</span></td>
    <td align="right" style="padding:9px 0;border-bottom:1px solid #6b1f20;font-family:${SANS};font-size:13px;color:${CREAM};white-space:nowrap;">${esc(s.time)}</td></tr>`).join('');
  const th = (t: string, a = 'left') => `<td align="${a}" style="padding:0 0 8px;border-bottom:1px solid ${TAN};font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${TAN};">${t}</td>`;
  return sec(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${DEEP};"><tr><td style="padding:30px 30px 26px;">
    ${label('Your reward for a top 5 finish', TAN)}
    <div style="font-family:${SERIF};font-size:28px;line-height:1.2;color:${CREAM};margin:0 0 14px;">You've unlocked Mock ${r.fromMock} onwards.</div>
    <p style="font-family:${SANS};font-size:14.5px;line-height:1.7;color:#EADFD0;margin:0 0 12px;">You finished in the top 5 among external students, essay and MCQ combined. That earns you full access to Mock ${r.fromMock} and every mock after it, and it's already switched on for your account. Nothing to pay and nothing to apply for.</p>
    <p style="font-family:${SANS};font-size:14.5px;line-height:1.7;color:#EADFD0;margin:0 0 20px;"><b style="color:${CREAM};">Sitting online?</b> Open the link when the mock starts and you're in. That's all it takes.<br><b style="color:${CREAM};">Prefer the room?</b> You're welcome to attend offline too.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;"><tr>${th('Mock')}${th('Day')}${th('Time', 'right')}</tr>${rows}</table>
    <p style="font-family:${SANS};font-size:12px;color:#cdb7a6;margin:8px 0 22px;">All times are Bangladesh time.</p>
    <a href="${esc(i.mockUrl)}" style="display:inline-block;padding:14px 30px;border-radius:999px;background:${TAN};color:${INK};font-family:${SANS};font-size:14px;font-weight:600;text-decoration:none;">Open Mock ${r.fromMock}</a>
  </td></tr></table>`);
}

export function mockResultsEmail(i: ResultsEmailInput): MockEmail {
  const mock = i.mockNumber != null ? `Mock ${i.mockNumber}` : i.mockTitle;
  const subject = i.reward
    ? `Your ${mock} results are in, and there's a reward inside`
    : `Your ${mock} results are in: ${ordinal(i.rank)} of ${i.outOf}`;
  const preheader = i.reward
    ? `You finished ${ordinal(i.rank)} overall and top 5 among externals. Your reward is inside.`
    : `You finished ${ordinal(i.rank)} of ${i.outOf}. Your full breakdown is inside.`;

  const opening = i.reward
    ? `${mock} results are out, and yours made us grin. You came ${ordinal(i.externalRank!.rank)} among ${i.externalRank!.outOf} external students, and a top 5 finish comes with a reward. Your full breakdown is below, and the reward is further down.`
    : i.externalRank
      ? `${mock} results are out. It was a tough paper and you sat it anyway, which counts for a lot. Here's exactly where you stand and where the quickest marks are.`
      : `${mock} results are out. Your MCQs and essays are marked and here's exactly where you stand, section by section.`;
  const closing = i.reward
    ? `Really well done. We can't wait to see you in the room, or on the link.`
    : i.missed.length > 0
      ? `Keep going. The missed chances above are the fastest way to a higher number next time.`
      : `Keep going. Every mock is a chance to move up.`;

  const sections = i.sections.map(s => `<tr><td style="padding:14px 0;border-bottom:1px solid ${LINE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:${SANS};font-size:14px;font-weight:600;color:${INK};">${esc(s.title)}</td>
      <td align="right" style="font-family:${SERIF};font-size:16px;color:${MAROON};">${num(s.score)}<span style="font-family:${SANS};font-size:12px;color:${CLAY};"> / ${num(s.max)}</span></td></tr></table>
    <div style="margin:8px 0 6px;">${bar(s.score, s.max)}</div>
    <div style="font-family:${SANS};font-size:12px;color:${CLAY};">${s.correct} right · ${s.wrong} wrong · ${s.skipped} skipped${s.penalty > 0 ? ` · <span style="color:${MAROON};">${marks(s.penalty)} lost to wrong answers</span>` : ''}</div>
  </td></tr>`).join('');

  const missed = i.missed.map(m => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${LINE};width:56px;font-family:${SERIF};font-size:20px;color:${MAROON};">Q${m.number}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:13.5px;line-height:1.5;color:${INK};">${esc(m.section)}<br><span style="color:${CLAY};font-size:12.5px;">${m.pct}% of everyone got it · you ${m.mine === 'skipped' ? 'skipped it' : `chose ${esc(m.yourAnswer ?? '?')}`} · answer ${esc(m.correctAnswer)}</span></td></tr>`).join('');

  const th = (t: string, a = 'left') => `<td align="${a}" style="padding:0 0 8px;border-bottom:1px solid ${INK};font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${CLAY};">${t}</td>`;
  const board = i.board.map(r => {
    const td = (x: string, extra = '') => `<td style="padding:9px ${r.me ? '10px' : '0'};border-bottom:1px solid ${LINE};font-family:${SANS};font-size:13.5px;color:${INK};${r.me ? `background:${PAPER};font-weight:600;` : ''}${extra}">${x}</td>`;
    return `<tr>${td(`<span style="font-family:${SERIF};font-size:16px;color:${r.me ? MAROON : CLAY};">${r.rank}</span>`, 'width:34px;')}${td(esc(r.name) + (r.me ? ' (you)' : ''))}${td(num(r.mcq), 'text-align:right;')}${td(num(r.essay), 'text-align:right;')}${td(`<span style="font-family:${SERIF};font-size:15px;color:${MAROON};">${num(r.total)}</span>`, 'text-align:right;')}</tr>`;
  }).join('');

  const stat = (l: string, v: string, c: string, first = false) =>
    `<td align="center" width="25%" style="padding:18px 4px;${first ? '' : `border-left:1px solid ${TAN};`}"><div style="font-family:${SANS};font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${CLAY};">${l}</div><div style="font-family:${SERIF};font-size:26px;color:${c};margin-top:5px;">${v}</div></td>`;
  const of = (x: string) => `<span style="font-size:14px;color:${CLAY};"> / ${x}</span>`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER};">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${CREAM};border:1px solid ${LINE};">
<tr><td align="center" style="background:${DEEP};padding:22px 20px 20px;"><img src="${SITE}/email/bth-lockup-email.png" width="280" alt="Beyond the Horizons by Vertical Horizon" style="display:block;width:280px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background:${MAROON};">&nbsp;</td></tr>
${sec(`${label(`BTH ${esc(mock)} · Official results`)}
  <div style="font-family:${SERIF};font-size:32px;line-height:1.2;color:${INK};margin:0 0 16px;">${esc(i.name)}, you finished <span style="color:${MAROON};font-style:italic;">${ordinal(i.rank)}</span> of ${i.outOf}.</div>
  <p style="font-family:${SANS};font-size:15px;line-height:1.7;color:${INK};margin:0;">${esc(opening)}</p>`, '38px 36px 0')}
${sec(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${TAN};border-bottom:1px solid ${TAN};"><tr>
  ${stat('Rank', `${i.rank}${of(String(i.outOf))}`, MAROON, true)}${stat('Combined', `${num(i.combined)}${of(num(i.combinedMax))}`, INK)}${stat('MCQ', `${num(i.mcq)}${of(num(i.mcqMax))}`, INK)}${stat('Essay', `${num(i.essay)}${of(num(i.essayMax))}`, INK)}
  </tr></table>
  <p style="font-family:${SANS};font-size:13px;color:${CLAY};margin:12px 0 0;text-align:center;">Ahead of <b style="color:${INK};">${num(i.percentile)}%</b> of everyone who sat it${i.avgCombined != null ? `. Average combined score: <b style="color:${INK};">${num(i.avgCombined)}</b>` : ''}.</p>`, '24px 36px 0')}
${i.sections.length ? sec(`${label('Part 1 · by section')}${h2('Where your marks came from')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">${sections}</table>`) : ''}
${i.missed.length ? sec(`${label('Your cheapest marks')}${h2('Biggest missed chances')}${note('Questions most people got right that you didn\'t. Fix these first.')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${missed}</table>`) : ''}
${i.board.length ? sec(`${label('Leaderboard')}${h2('Top 10, MCQ + essay')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>${th('#')}${th('Name')}${th('MCQ', 'right')}${th('Essay', 'right')}${th('Total', 'right')}</tr>${board}</table>`) : ''}
${i.reward ? rewardBlock(i) : ''}
${sec(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <a href="${esc(i.resultsUrl)}" style="display:inline-block;padding:14px 30px;border-radius:999px;background:${INK};color:${CREAM};font-family:${SANS};font-size:14px;font-weight:600;text-decoration:none;">Open your full results</a>
  <div style="font-family:${SANS};font-size:12px;color:${CLAY};margin-top:10px;">Question-by-question review, answer key and worked solutions are on your results page.</div></td></tr></table>`, '32px 36px 0')}
${sec(`<p style="font-family:${SANS};font-size:15px;line-height:1.7;color:${INK};margin:0 0 14px;">${esc(closing)}</p>
  <div style="font-family:${SERIF};font-style:italic;font-size:24px;color:${INK};">Ahnaf</div>
  <div style="font-family:${SANS};font-size:11px;letter-spacing:1px;color:${CLAY};margin-top:2px;">Beyond the Horizons by Vertical Horizon</div>`, '26px 36px 32px')}
<tr><td style="padding:0 36px 30px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${TAN};padding-top:16px;font-family:${SANS};font-size:12px;line-height:1.7;color:${CLAY};">
  Questions? WhatsApp <a href="https://wa.me/8801835200626" style="color:${MAROON};">+880 1835-200626</a>, or reply to this email.<br><a href="${SITE}" style="color:${CLAY};">vh-beyondthehorizons.org</a></td></tr></table></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `${i.name}, you finished ${ordinal(i.rank)} of ${i.outOf} in ${mock}.`, '',
    opening, '',
    `Rank ${i.rank} of ${i.outOf} · Combined ${num(i.combined)}/${num(i.combinedMax)} · MCQ ${num(i.mcq)}/${num(i.mcqMax)} · Essay ${num(i.essay)}/${num(i.essayMax)}`,
    `Ahead of ${num(i.percentile)}% of everyone who sat it.`,
    ...(i.sections.length ? ['', 'By section:', ...i.sections.map(s => `  ${s.title}: ${num(s.score)}/${num(s.max)} (${s.correct} right, ${s.wrong} wrong, ${s.skipped} skipped${s.penalty > 0 ? `, ${marks(s.penalty)} lost to wrong answers` : ''})`)] : []),
    ...(i.missed.length ? ['', 'Biggest missed chances:', ...i.missed.map(m => `  Q${m.number} (${m.section}): ${m.pct}% got it, you ${m.mine === 'skipped' ? 'skipped' : `chose ${m.yourAnswer ?? '?'}`}, answer ${m.correctAnswer}`)] : []),
    ...(i.reward ? ['', `REWARD: you've unlocked Mock ${i.reward.fromMock} onwards (top 5 among external students). It's already on for your account. Sit online by opening the link, or attend offline.`, ...i.reward.schedule.map(s => `  Mock ${s.n}: ${s.day} ${s.date}, ${s.time} (Bangladesh time)`), `  ${i.mockUrl}`] : []),
    '', `Your full results, with question-by-question review and solutions: ${i.resultsUrl}`, '', closing, 'Ahnaf', 'Beyond the Horizons by Vertical Horizon',
  ].join('\n');

  return { subject, html, text };
}
