/** Weekly super-admin report: pure content generation (report.ts) + cheap data gathering (report-data.ts). */

export interface ReportData {
  weekEnding: string;                 // YYYY-MM-DD
  newStudents: number;
  registrations: number;
  /** Cheap at-risk proxy: active students with no test attempt in 14 days (NOT getAtRiskStudents(), which takes minutes). */
  atRiskProxy: number;
  errors7d: number;
  failedCrons: string[];              // empty when the Ops agent's super:ops:cron:* keys are absent
  cronsTracked: boolean;
  broadcasts: { sent: number; failed: number; scheduled: number };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildWeeklyReport(d: ReportData): { subject: string; text: string; html: string } {
  const cronLine = !d.cronsTracked ? 'Cron health: not tracked yet'
    : d.failedCrons.length === 0 ? 'Cron health: no failed crons'
    : `Cron health: ${d.failedCrons.length} failed (${d.failedCrons.join(', ')})`;
  const lines = [
    `New students: ${d.newStudents}`,
    `Registrations: ${d.registrations}`,
    `At-risk (no test activity in 14 days): ${d.atRiskProxy}`,
    `Errors logged: ${d.errors7d}`,
    cronLine,
    `Broadcasts: ${d.broadcasts.sent} sent, ${d.broadcasts.failed} failed, ${d.broadcasts.scheduled} scheduled`,
  ];
  const subject = `VH weekly report, week ending ${d.weekEnding}`;
  const text = `${subject}\n\nLast 7 days\n${lines.map(l => `- ${l}`).join('\n')}\n`;
  const html = `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1A0507;max-width:520px">`
    + `<h2 style="font-family:Georgia,serif;margin:0 0 12px">${esc(subject)}</h2>`
    + `<ul style="line-height:1.8;padding-left:18px">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
  return { subject, text, html };
}
