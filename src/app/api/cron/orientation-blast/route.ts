/**
 * GET /api/cron/orientation-blast
 *
 * One-shot cron: fires at 2am UTC on June 24, 2026 (8am Bangladesh time).
 * Sends orientation email to remaining recipients who didn't get it in the first batch.
 *
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const CRON_SECRET = process.env.CRON_SECRET;

const REMAINING_RECIPIENTS = [
  { name: 'Hasan', email: 'hasanxsarower@gmail.com' },
  { name: 'Rahmita', email: 'rahmitasnim2342@gmail.com' },
  { name: 'Habibur', email: 'habiburrahmanrayat@gmail.com' },
  { name: 'Kaif', email: 'kaifkabir2004@gmail.com' },
  { name: 'Ahnaf', email: 'ahnafahad16@gmail.com' },
  { name: 'Ahnaf', email: 'iamahnafahad@gmail.com' },
  { name: 'Farhan', email: 'farhanhossaincops@gmail.com' },
  { name: 'Samiha', email: 'samihaseen45@gmail.com' },
  { name: 'Tarannum', email: 'sk.tarannum06@gmail.com' },
  { name: 'Zayan', email: 'zayan10010@gmail.com' },
  { name: 'Zuhayr', email: 'zuhayradeeb@gmail.com' },
  { name: 'Mehka', email: 'mehkatarannum@gmail.com' },
];

const EMAIL_HTML = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;1,9..144,300&family=Geist:wght@300;400;500;600&family=Great+Vibes&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
.eo{background:#E8E1D5;padding:48px 20px 64px;font-family:'Geist',system-ui,sans-serif}
.ew{max-width:590px;margin:0 auto;background:#FAF5EF;box-shadow:0 4px 32px rgba(26,5,7,0.12)}
.eh{background:#460809;padding:26px 38px;text-align:center}
.eh img{height:auto;max-height:138px;width:auto;max-width:550px;display:inline-block}
.br{height:3px;background:linear-gradient(90deg,#A86E58,#D4B094,#A86E58)}
.hero{padding:52px 52px 36px}
.eyebrow{font-size:9.5px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:#A86E58;margin-bottom:22px;display:flex;align-items:center;gap:12px}
.eyebrow::after{content:'';flex:1;height:.5px;background:#D4B094}
.hero h1{font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:40px;line-height:1.1;color:#1A0507;letter-spacing:-.01em}
.hero h1 em{font-style:italic;color:#760F13}
.tagline{font-family:'Fraunces',Georgia,serif;font-style:italic;font-weight:300;font-size:15px;color:#A86E58;margin-top:16px}
.dband{display:flex;border-top:.5px solid #D4B094;border-bottom:.5px solid #D4B094;margin:0 52px}
.di{flex:1;padding:18px 12px;display:flex;flex-direction:column;gap:4px;text-align:center;align-items:center}
.di+.di{border-left:.5px solid #D4B094}
.dl{font-size:9px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#A86E58}
.dv{font-size:13.5px;font-weight:500;color:#1A0507}
.body{padding:40px 52px}
.body p{font-size:14.5px;font-weight:300;line-height:1.8;color:#2E0F12;margin-bottom:18px}
.cl{border-left:2px solid #D4B094;padding-left:20px;margin:22px 0 26px;display:flex;flex-direction:column;gap:11px}
.ci{font-size:14px;color:#1A0507;display:flex;align-items:baseline;gap:10px}
.ci::before{content:'—';color:#D4B094;font-size:11px;flex-shrink:0}
.badge-row{display:flex;align-items:center;gap:16px;margin:26px 0 8px}
.badge{border:1.5px solid #760F13;color:#760F13;font-size:9.5px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;padding:8px 20px;display:inline-block}
.parents{font-size:12.5px;color:#A86E58;font-family:'Fraunces',Georgia,serif;font-style:italic}
.divider{border:none;border-top:.5px solid #D4B094;margin:34px 0}
.signoff p{font-size:14px;font-weight:300;color:#2E0F12;line-height:1.7;margin-bottom:20px}
.sig-name{font-size:11px;font-weight:500;letter-spacing:.06em;color:#A86E58;margin-top:8px}
.ef{background:#460809;padding:20px 52px;display:flex;justify-content:space-between;align-items:center}
.ef span{font-family:'Fraunces',Georgia,serif;font-weight:300;font-size:12px;color:rgba(250,245,239,.45)}
.ef a{font-size:10.5px;color:rgba(212,176,148,.55);text-decoration:none;letter-spacing:.05em}
@media(max-width:480px){.ew{width:100%!important}.hero,.body{padding:36px 28px!important}.dband{margin:0 28px!important;flex-direction:column!important}.di+.di{border-left:none!important;border-top:.5px solid #D4B094!important}.eh{padding:24px 28px!important}}
</style>
<div class="eo">
<div class="ew">
  <div class="eh"><img src="https://www.vh-beyondthehorizons.org/bth_horizontal_lockup_maroon.png" alt="Beyond the Horizons"></div>
  <div class="br"></div>
  <div class="hero">
    <div class="eyebrow">VH Beyond the Horizons Presents</div>
    <h1>IBA / BUP Admission Course<br><em>2026–27 Orientation</em></h1>
    <p class="tagline">Strategy over struggle.</p>
  </div>
  <div style="padding:0 52px 32px">
    <div class="dband">
      <div class="di"><span class="dl">Date</span><span class="dv">Wednesday, 24 June 2026</span></div>
      <div class="di"><span class="dl">Time</span><span class="dv">3:30 PM onwards</span></div>
      <div class="di"><span class="dl">Venue</span><span class="dv">Room 305, VH Premises</span></div>
    </div>
  </div>
  <div class="body">
    <p>The IBA and BUP admission exams are among the most competitive in the country. Most students don't know where to start — this session is designed to change that.</p>
    <p>We'll cover:</p>
    <div class="cl">
      <div class="ci">What the exam actually demands</div>
      <div class="ci">How to structure your preparation intelligently</div>
      <div class="ci">Where VH's programme fits into your timeline</div>
      <div class="ci">Open Q&amp;A — all questions welcome</div>
    </div>
    <p>Come prepared to ask. There are no wrong questions at this stage.</p>
    <div class="badge-row">
      <span class="badge">Open for all</span>
      <span class="parents">Parents are warmly welcome to attend.</span>
    </div>
    <hr class="divider">
    <div class="signoff">
      <p>Looking forward to seeing you there.</p>
      <div style="font-family:'Great Vibes',cursive;font-size:52px;color:#1A0507;line-height:1;margin:8px 0 4px;letter-spacing:.01em">Ahnaf</div>
      <div class="sig-name">Ahnaf Ahad &nbsp;·&nbsp; VH Beyond the Horizons</div>
    </div>
  </div>
  <div class="br"></div>
  <div class="ef">
    <span>VH Beyond the Horizons</span>
    <a href="https://www.vh-beyondthehorizons.org">vh-beyondthehorizons.org</a>
  </div>
</div>
</div>`;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // One-shot guard: only run on 2026-06-24 (UTC)
  const now = new Date();
  const utcDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  if (utcDate !== '2026-06-24') {
    return NextResponse.json({ skipped: true, reason: `Not the target date (${utcDate})` });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 });
  }
  const resend = new Resend(resendKey);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const { name, email } of REMAINING_RECIPIENTS) {
    const result = await resend.emails.send({
      from: 'Ahnaf <ahnaf@vh-beyondthehorizons.org>',
      to: email,
      subject: 'IBA/BUP Admission Course 2026–27 — Orientation Today at 3:30 PM',
      html: EMAIL_HTML,
    });

    if (result.error) {
      console.error(`[orientation-blast] Failed ${email}: ${result.error.message}`);
      errors.push(`${email}: ${result.error.message}`);
      failed++;
    } else {
      console.log(`[orientation-blast] Sent to ${name} <${email}>`);
      sent++;
    }

    await sleep(300);
  }

  return NextResponse.json({ sent, failed, total: REMAINING_RECIPIENTS.length, errors });
}
