/**
 * GET /api/cron/email-warmup
 *
 * Runs twice daily (9am + 3pm UTC) via Vercel cron.
 * Warms up the sending domain by sending gradually increasing
 * volumes of natural-looking emails to a seed list.
 *
 * No extra env vars needed beyond what's already in the project.
 * Uses: RESEND_API_KEY, CRON_SECRET (both already set)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// Warm-up schedule: how many emails to send per cron run (twice/day)
// Total daily = roughly double each entry × 2 runs
// ---------------------------------------------------------------------------
const DAILY_TARGETS = [
  2,  // day 1
  3,  // day 2
  4,  // day 3
  5,  // day 4
  6,  // day 5
  7,  // day 6
  8,  // day 7
  9,  // day 8
  10, // day 9
  11, // day 10
  12, // day 11
  13, // day 12
  14, // day 13
  14, // day 14
];

// ---------------------------------------------------------------------------
// Email templates — varied subjects, casual/conversational tone, no spam words
// ---------------------------------------------------------------------------
const TEMPLATES: Array<{ subject: string; html: string; text: string }> = [
  {
    subject: "Quick thought I wanted to share",
    html: `<p>Hey,</p><p>Was thinking about you earlier and figured I'd drop a line. Hope things are going well on your end.</p><p>Have you had a chance to look into any good reads lately? I've been going through a lot of material on productivity and focus — really shifting how I think about deep work.</p><p>Let me know if you want me to share some of the highlights.</p><p>Talk soon,<br/>Ahnaf</p>`,
    text: "Hey,\n\nWas thinking about you earlier and figured I'd drop a line. Hope things are going well on your end.\n\nHave you had a chance to look into any good reads lately? I've been going through a lot of material on productivity and focus — really shifting how I think about deep work.\n\nLet me know if you want me to share some of the highlights.\n\nTalk soon,\nAhnaf",
  },
  {
    subject: "Checking in — how's everything?",
    html: `<p>Hi there,</p><p>Just wanted to check in and see how you've been. It's been a while since we last caught up properly.</p><p>Things on my end have been busy but in a good way — lots of new projects taking shape. Would love to hear what you're up to when you get a moment.</p><p>Best,<br/>Ahnaf</p>`,
    text: "Hi there,\n\nJust wanted to check in and see how you've been. It's been a while since we last caught up properly.\n\nThings on my end have been busy but in a good way — lots of new projects taking shape. Would love to hear what you're up to when you get a moment.\n\nBest,\nAhnaf",
  },
  {
    subject: "Something interesting I came across",
    html: `<p>Hey,</p><p>Came across something I thought you'd find interesting — there's been a lot of discussion lately about how students are approaching exam prep differently than they did even 5 years ago.</p><p>The shift toward active recall over passive re-reading is massive. Curious if you've noticed the same trend or have thoughts on it.</p><p>Hope you're well,<br/>Ahnaf</p>`,
    text: "Hey,\n\nCame across something I thought you'd find interesting — there's been a lot of discussion lately about how students are approaching exam prep differently than they did even 5 years ago.\n\nThe shift toward active recall over passive re-reading is massive. Curious if you've noticed the same trend or have thoughts on it.\n\nHope you're well,\nAhnaf",
  },
  {
    subject: "A question for you",
    html: `<p>Hi,</p><p>I've been thinking about this a lot lately and figured you'd have an interesting perspective: what's the one habit you think most people underestimate in terms of long-term impact?</p><p>For me, it's probably consistent sleep — sounds boring, but the downstream effects on focus and decision-making are enormous.</p><p>Would love to hear yours.</p><p>Cheers,<br/>Ahnaf</p>`,
    text: "Hi,\n\nI've been thinking about this a lot lately and figured you'd have an interesting perspective: what's the one habit you think most people underestimate in terms of long-term impact?\n\nFor me, it's probably consistent sleep — sounds boring, but the downstream effects on focus and decision-making are enormous.\n\nWould love to hear yours.\n\nCheers,\nAhnaf",
  },
  {
    subject: "Following up on our last chat",
    html: `<p>Hey,</p><p>Just following up — did you ever get a chance to try what we talked about? I've been experimenting with it myself and the results have been genuinely surprising.</p><p>No pressure at all, just curious if it clicked for you the same way it did for me.</p><p>Talk soon,<br/>Ahnaf</p>`,
    text: "Hey,\n\nJust following up — did you ever get a chance to try what we talked about? I've been experimenting with it myself and the results have been genuinely surprising.\n\nNo pressure at all, just curious if it clicked for you the same way it did for me.\n\nTalk soon,\nAhnaf",
  },
  {
    subject: "This week has been something",
    html: `<p>Hi,</p><p>What a week. Between trying to stay on top of everything and actually making progress on things that matter, it's been a balancing act.</p><p>How are you finding it? Do you have any rituals that help you decompress when things stack up?</p><p>Always looking for what works for people I respect.</p><p>Best,<br/>Ahnaf</p>`,
    text: "Hi,\n\nWhat a week. Between trying to stay on top of everything and actually making progress on things that matter, it's been a balancing act.\n\nHow are you finding it? Do you have any rituals that help you decompress when things stack up?\n\nAlways looking for what works for people I respect.\n\nBest,\nAhnaf",
  },
  {
    subject: "Sharing something I've been working on",
    html: `<p>Hey,</p><p>I've been heads-down on a few things lately and it felt right to share an update with people who've been in my corner.</p><p>The short version: building something in the education space that I'm really proud of. More to come soon — but I wanted you to be among the first to know when it's ready to show properly.</p><p>Thanks for being someone I trust with early news.</p><p>Warm regards,<br/>Ahnaf</p>`,
    text: "Hey,\n\nI've been heads-down on a few things lately and it felt right to share an update with people who've been in my corner.\n\nThe short version: building something in the education space that I'm really proud of. More to come soon — but I wanted you to be among the first to know when it's ready to show properly.\n\nThanks for being someone I trust with early news.\n\nWarm regards,\nAhnaf",
  },
  {
    subject: "Random but genuine question",
    html: `<p>Hi,</p><p>Random question but I've been curious: if you could only recommend one thing — book, podcast, habit, whatever — to someone trying to get sharper at learning, what would it be?</p><p>Compiling a list of answers from people I genuinely respect. No agenda, just curiosity.</p><p>Cheers,<br/>Ahnaf</p>`,
    text: "Hi,\n\nRandom question but I've been curious: if you could only recommend one thing — book, podcast, habit, whatever — to someone trying to get sharper at learning, what would it be?\n\nCompiling a list of answers from people I genuinely respect. No agenda, just curiosity.\n\nCheers,\nAhnaf",
  },
  {
    subject: "Thinking about goals for the rest of the year",
    html: `<p>Hey,</p><p>We're almost halfway through the year (wild, right?). I've been doing a review of what I set out to do and what I've actually done — and there's a gap, but it's not discouraging. It's clarifying.</p><p>Have you done anything similar? Even a rough mental accounting of what's worked and what hasn't?</p><p>Would love to compare notes.</p><p>Ahnaf</p>`,
    text: "Hey,\n\nWe're almost halfway through the year (wild, right?). I've been doing a review of what I set out to do and what I've actually done — and there's a gap, but it's not discouraging. It's clarifying.\n\nHave you done anything similar? Even a rough mental accounting of what's worked and what hasn't?\n\nWould love to compare notes.\n\nAhnaf",
  },
  {
    subject: "Something on my mind lately",
    html: `<p>Hi,</p><p>I've been thinking a lot about the difference between staying busy and actually moving forward. They feel similar in the moment but lead to very different places.</p><p>I'm trying to be more intentional about which one I'm actually doing at any given time. Easier said than done, honestly.</p><p>Anyway — just sharing a thought. How are you?</p><p>Best,<br/>Ahnaf</p>`,
    text: "Hi,\n\nI've been thinking a lot about the difference between staying busy and actually moving forward. They feel similar in the moment but lead to very different places.\n\nI'm trying to be more intentional about which one I'm actually doing at any given time. Easier said than done, honestly.\n\nAnyway — just sharing a thought. How are you?\n\nBest,\nAhnaf",
  },
  {
    subject: "A small win worth sharing",
    html: `<p>Hey,</p><p>Just had a small win I wanted to share — finally cracked something that's been sitting in the back of my mind for weeks. Sometimes the answer is so obvious once you see it that you feel both relieved and slightly embarrassed.</p><p>Anyway, hope your week has some moments like that too.</p><p>Talk soon,<br/>Ahnaf</p>`,
    text: "Hey,\n\nJust had a small win I wanted to share — finally cracked something that's been sitting in the back of my mind for weeks. Sometimes the answer is so obvious once you see it that you feel both relieved and slightly embarrassed.\n\nAnyway, hope your week has some moments like that too.\n\nTalk soon,\nAhnaf",
  },
  {
    subject: "Heard something you might appreciate",
    html: `<p>Hi,</p><p>Heard something the other day that stuck with me: "You don't rise to the level of your goals, you fall to the level of your systems."</p><p>Not new — but hitting differently lately. I keep thinking about what systems I actually have vs. what I think I have.</p><p>Does anything like that resonate with you right now?</p><p>Ahnaf</p>`,
    text: "Hi,\n\nHeard something the other day that stuck with me: \"You don't rise to the level of your goals, you fall to the level of your systems.\"\n\nNot new — but hitting differently lately. I keep thinking about what systems I actually have vs. what I think I have.\n\nDoes anything like that resonate with you right now?\n\nAhnaf",
  },
  {
    subject: "Wanted to catch up properly",
    html: `<p>Hey,</p><p>I've been meaning to properly reach out for a while — keep getting sidetracked by the day-to-day. Bad excuse, I know.</p><p>How have things been on your end? Anything exciting or anything hard you've been navigating?</p><p>I'm genuinely curious. No rush on a reply — whenever you have a moment.</p><p>Warmly,<br/>Ahnaf</p>`,
    text: "Hey,\n\nI've been meaning to properly reach out for a while — keep getting sidetracked by the day-to-day. Bad excuse, I know.\n\nHow have things been on your end? Anything exciting or anything hard you've been navigating?\n\nI'm genuinely curious. No rush on a reply — whenever you have a moment.\n\nWarmly,\nAhnaf",
  },
  {
    subject: "Short question about something I'm building",
    html: `<p>Hi,</p><p>I'm working on something in the education space and I value your perspective — so I wanted to ask: what's the biggest friction point you've seen (or experienced) when it comes to preparing for high-stakes exams?</p><p>Not fishing for validation, genuinely trying to understand the problem better.</p><p>Even a sentence helps. Thank you.</p><p>Ahnaf</p>`,
    text: "Hi,\n\nI'm working on something in the education space and I value your perspective — so I wanted to ask: what's the biggest friction point you've seen (or experienced) when it comes to preparing for high-stakes exams?\n\nNot fishing for validation, genuinely trying to understand the problem better.\n\nEven a sentence helps. Thank you.\n\nAhnaf",
  },
  {
    subject: "Morning thought",
    html: `<p>Good morning,</p><p>Started the day with a long walk and it's incredible how much clarity that creates — no agenda, no podcast, just moving and thinking.</p><p>If you haven't tried it, I'd recommend it. Even 15 minutes.</p><p>Hope your morning is a good one.</p><p>Ahnaf</p>`,
    text: "Good morning,\n\nStarted the day with a long walk and it's incredible how much clarity that creates — no agenda, no podcast, just moving and thinking.\n\nIf you haven't tried it, I'd recommend it. Even 15 minutes.\n\nHope your morning is a good one.\n\nAhnaf",
  },
  {
    subject: "Something I've been reading",
    html: `<p>Hey,</p><p>Been reading a lot about how the brain consolidates information during sleep — the research on memory reconsolidation is fascinating and has genuinely changed how I approach studying and review.</p><p>The short version: spacing out review sessions and sleeping between them isn't just good advice, it's mechanistically how memory actually works.</p><p>Thought you'd find that interesting.</p><p>Best,<br/>Ahnaf</p>`,
    text: "Hey,\n\nBeen reading a lot about how the brain consolidates information during sleep — the research on memory reconsolidation is fascinating and has genuinely changed how I approach studying and review.\n\nThe short version: spacing out review sessions and sleeping between them isn't just good advice, it's mechanistically how memory actually works.\n\nThought you'd find that interesting.\n\nBest,\nAhnaf",
  },
  {
    subject: "An observation about high-performers",
    html: `<p>Hi,</p><p>One pattern I keep noticing in people who consistently do great work: they're almost universally good at saying no to things that don't fit.</p><p>Not rudely — just clearly. And the time they protect with those decisions seems to compound in ways that are hard to overstate.</p><p>Is that something you think about much? I'd be curious to hear your experience.</p><p>Ahnaf</p>`,
    text: "Hi,\n\nOne pattern I keep noticing in people who consistently do great work: they're almost universally good at saying no to things that don't fit.\n\nNot rudely — just clearly. And the time they protect with those decisions seems to compound in ways that are hard to overstate.\n\nIs that something you think about much? I'd be curious to hear your experience.\n\nAhnaf",
  },
  {
    subject: "Quick update from me",
    html: `<p>Hey,</p><p>Quick update: things are moving. Not always fast, not always perfectly — but moving. Which honestly feels like the main thing.</p><p>Wanted to check in on you too. What are you working toward right now? Anything I can support or just cheer on from the sidelines?</p><p>Ahnaf</p>`,
    text: "Hey,\n\nQuick update: things are moving. Not always fast, not always perfectly — but moving. Which honestly feels like the main thing.\n\nWanted to check in on you too. What are you working toward right now? Anything I can support or just cheer on from the sidelines?\n\nAhnaf",
  },
  {
    subject: "Thinking about feedback",
    html: `<p>Hi,</p><p>I've been thinking about how rare genuinely useful feedback is. Most of the time we get either validation or vague criticism — what's harder to find is specific, honest, caring observation from someone who wants you to improve.</p><p>If you have people like that in your life, hold onto them.</p><p>Just a thought for the day.</p><p>Warmly,<br/>Ahnaf</p>`,
    text: "Hi,\n\nI've been thinking about how rare genuinely useful feedback is. Most of the time we get either validation or vague criticism — what's harder to find is specific, honest, caring observation from someone who wants you to improve.\n\nIf you have people like that in your life, hold onto them.\n\nJust a thought for the day.\n\nWarmly,\nAhnaf",
  },
  {
    subject: "End of week reflection",
    html: `<p>Hey,</p><p>End of the week. I try to take five minutes on Fridays to ask: what did I actually learn this week that I didn't know Monday morning?</p><p>Some weeks the list is long. Some weeks it's embarrassingly short. Both are useful to know.</p><p>How would you answer that question for this week?</p><p>Have a good weekend,<br/>Ahnaf</p>`,
    text: "Hey,\n\nEnd of the week. I try to take five minutes on Fridays to ask: what did I actually learn this week that I didn't know Monday morning?\n\nSome weeks the list is long. Some weeks it's embarrassingly short. Both are useful to know.\n\nHow would you answer that question for this week?\n\nHave a good weekend,\nAhnaf",
  },
  {
    subject: "Something worth celebrating",
    html: `<p>Hi,</p><p>I think we're collectively bad at celebrating small wins before moving on to the next thing. There's always something else to do, so the wins just blur together.</p><p>But I'm trying to get better at it. Pause, acknowledge, then move forward.</p><p>What's a small win you've had recently that you didn't give yourself enough credit for?</p><p>Ahnaf</p>`,
    text: "Hi,\n\nI think we're collectively bad at celebrating small wins before moving on to the next thing. There's always something else to do, so the wins just blur together.\n\nBut I'm trying to get better at it. Pause, acknowledge, then move forward.\n\nWhat's a small win you've had recently that you didn't give yourself enough credit for?\n\nAhnaf",
  },
  {
    subject: "An honest question",
    html: `<p>Hey,</p><p>Honest question: what's one belief you held strongly a few years ago that you've since changed your mind about?</p><p>I ask because I think willingness to update beliefs is one of the rarest and most valuable traits — and I'm trying to stay honest with myself about where I've changed and where I might need to.</p><p>Genuinely curious about yours.</p><p>Ahnaf</p>`,
    text: "Hey,\n\nHonest question: what's one belief you held strongly a few years ago that you've since changed your mind about?\n\nI ask because I think willingness to update beliefs is one of the rarest and most valuable traits — and I'm trying to stay honest with myself about where I've changed and where I might need to.\n\nGenuinely curious about yours.\n\nAhnaf",
  },
  {
    subject: "Reminder: you're doing better than you think",
    html: `<p>Hi,</p><p>This is a low-stakes email with a simple message: you're probably doing better than you think.</p><p>I say that because I find it's almost universally true for people who are thoughtful and trying hard — and the fact that you care enough to worry about whether you're doing well enough is itself a pretty good sign.</p><p>Hope that lands well. Have a great day.</p><p>Ahnaf</p>`,
    text: "Hi,\n\nThis is a low-stakes email with a simple message: you're probably doing better than you think.\n\nI say that because I find it's almost universally true for people who are thoughtful and trying hard — and the fact that you care enough to worry about whether you're doing well enough is itself a pretty good sign.\n\nHope that lands well. Have a great day.\n\nAhnaf",
  },
  {
    subject: "The long game",
    html: `<p>Hey,</p><p>I keep coming back to this idea: most meaningful things take longer than we expect and are less dramatic than we imagine when they're happening.</p><p>Progress on hard things tends to feel like nothing, nothing, nothing — then suddenly something. The trick is trusting the process during the "nothing" phase.</p><p>Easier said than done. But I think about it a lot.</p><p>Best,<br/>Ahnaf</p>`,
    text: "Hey,\n\nI keep coming back to this idea: most meaningful things take longer than we expect and are less dramatic than we imagine when they're happening.\n\nProgress on hard things tends to feel like nothing, nothing, nothing — then suddenly something. The trick is trusting the process during the \"nothing\" phase.\n\nEasier said than done. But I think about it a lot.\n\nBest,\nAhnaf",
  },
  {
    subject: "Gratitude note",
    html: `<p>Hi,</p><p>I've started writing down three things I'm genuinely grateful for each morning — not as a performative habit, but as a real anchor before the day picks up pace.</p><p>It's surprisingly hard to do well. The mind wants to be vague. But specific gratitude — naming the person, naming the moment — hits differently.</p><p>Just sharing something that's been working for me. Hope it's a good day.</p><p>Ahnaf</p>`,
    text: "Hi,\n\nI've started writing down three things I'm genuinely grateful for each morning — not as a performative habit, but as a real anchor before the day picks up pace.\n\nIt's surprisingly hard to do well. The mind wants to be vague. But specific gratitude — naming the person, naming the moment — hits differently.\n\nJust sharing something that's been working for me. Hope it's a good day.\n\nAhnaf",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWarmupDay(startDateStr: string): number {
  const start = new Date(startDateStr);
  start.setUTCHours(0, 0, 0, 0);
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // 1-indexed
}

function getEmailsForRun(day: number, recipients: string[]): Array<{ to: string; template: typeof TEMPLATES[0] }> {
  const cappedDay = Math.min(day, DAILY_TARGETS.length);
  const totalForDay = DAILY_TARGETS[cappedDay - 1];
  // Each cron runs twice/day; split evenly (first run gets ceil, second gets floor)
  const hour = new Date().getUTCHours();
  const isFirstRun = hour < 12;
  const countThisRun = isFirstRun ? Math.ceil(totalForDay / 2) : Math.floor(totalForDay / 2);

  const result: Array<{ to: string; template: typeof TEMPLATES[0] }> = [];

  // Seed a deterministic offset per day+run so we don't repeat same combos
  const offset = (day * 17 + (isFirstRun ? 0 : 7)) % recipients.length;

  for (let i = 0; i < countThisRun; i++) {
    const recipientIndex = (offset + i) % recipients.length;
    const templateIndex = (day * 3 + i * 7 + (isFirstRun ? 0 : 11)) % TEMPLATES.length;
    result.push({
      to: recipients[recipientIndex],
      template: TEMPLATES[templateIndex],
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Hardcoded config — no extra env vars needed
// ---------------------------------------------------------------------------

const FROM_EMAIL = 'ahnaf@vh-beyondthehorizons.org';
const FROM_NAME = 'Ahnaf';
const WARMUP_START_DATE = '2026-06-10';
const SEED_RECIPIENTS = [
  'ahnaf816@gmail.com',
  'ahnafahad16@gmail.com',
  'hasanxsarower@gmail.com',
  'vhbbaadmission@gmail.com',
  'smhossainaudri1@gmail.com',
  'sidratulmuntaha1208@gmail.com',
  'sidratul.lynkupvc@gmail.com',
  'zayan10010@gmail.com',
  'blehblahsiuuu@gmail.com',
  'vongolaxeno003@gmail.com',
];

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Auth check
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const day = getWarmupDay(WARMUP_START_DATE);

  if (day > DAILY_TARGETS.length) {
    return NextResponse.json({ message: `Warmup complete (day ${day} > ${DAILY_TARGETS.length})`, sent: 0 });
  }

  const emailsToSend = getEmailsForRun(day, SEED_RECIPIENTS);

  const results: Array<{ to: string; subject: string; status: string; error?: string }> = [];

  for (const { to, template } of emailsToSend) {
    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      results.push({ to, subject: template.subject, status: 'sent' });
      // Small delay to avoid rate-limit bursts
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ to, subject: template.subject, status: 'failed', error: msg });
      console.error(`[email-warmup] Failed to send to ${to}:`, msg);
    }
  }

  const sentCount = results.filter((r) => r.status === 'sent').length;
  console.log(`[email-warmup] Day ${day} — sent ${sentCount}/${emailsToSend.length}`);

  return NextResponse.json({
    day,
    targetDailyTotal: DAILY_TARGETS[Math.min(day, DAILY_TARGETS.length) - 1],
    sentThisRun: sentCount,
    results,
  });
}
