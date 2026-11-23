/**
 * LexiCore public-launch analytics for /admin/super/lexicore.
 * Window: launch (19 Nov 2026, Dhaka) to PAID_UNTIL (5 Dec 2026).
 * "Outsider" = not a VH student: role student, not vocab phase 1, no active IBA/FBS course access
 * (the free-plan population, including people who later paid by bKash).
 * "New" outsider = their LexiCore progress row (or account, if no row) was created after launch.
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { COURSE_PRODUCTS, FREE_CARDS_PER_DAY, FREE_QUIZZES_PER_DAY, PAID_UNTIL, dhakaDay } from '@/lib/vocab/plan';

export const LAUNCH = new Date('2026-11-19T00:00:00+06:00');
const S = Math.floor(LAUNCH.getTime() / 1000);
const E = Math.floor(PAID_UNTIL.getTime() / 1000);
const DHAKA_MS = 6 * 3600_000;
const PAGE_CAP_MS = 30 * 60_000; // a tab left open counts as 30 min at most

const OUT = sql.raw(`SELECT u.id FROM users u LEFT JOIN vocab_user_progress p ON p.user_id = u.id
  WHERE u.role = 'student' AND COALESCE(p.phase, 2) <> 1
  AND NOT EXISTS (SELECT 1 FROM user_access a WHERE a.user_id = u.id AND a.active = 1
    AND a.product IN (${COURSE_PRODUCTS.map(p => `'${p}'`).join(',')}))`);
const LINK = sql.raw(`(entry_path = '/lexicore' OR entry_path LIKE '/lexicore/%')`);

/** Path → the feature it belongs to. */
export function featureOf(path: string): string {
  const p = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (p === '/lexicore') return 'Landing page';
  if (p.startsWith('/lexicore/upgrade')) return 'Upgrade page';
  if (/\/quiz$/.test(p)) return 'Quizzes';
  if (p.startsWith('/vocab/study/letter')) return 'Flashcards A–Z';
  if (p === '/vocab/study/review' || p.startsWith('/vocab/review')) return 'Review';
  if (p.startsWith('/vocab/study')) return 'Flashcards by theme';
  if (p.startsWith('/vocab/practice')) return 'Practice';
  if (p.startsWith('/vocab/games/')) return `Game: ${p.split('/')[3].replace(/-/g, ' ')}`;
  if (p.startsWith('/vocab/games')) return 'Games menu';
  if (p.startsWith('/vocab/onboarding')) return 'Onboarding';
  const seg = p.split('/')[2];
  const named: Record<string, string> = { home: 'Home', profile: 'Profile', leaderboard: 'Leaderboard', help: 'Help' };
  return named[seg] ?? 'Other';
}

/** Referrer/UTM → traffic source. */
export function sourceOf(referrer: string | null, utm: string | null): string {
  const r = `${referrer ?? ''} ${utm ?? ''}`.toLowerCase();
  if (/facebook|fb\.|^ ?fb/.test(r)) return 'Facebook';
  if (r.includes('instagram')) return 'Instagram';
  if (r.includes('messenger')) return 'Messenger';
  if (/whatsapp|wa\.me/.test(r)) return 'WhatsApp';
  if (r.includes('google')) return 'Google';
  if (r.includes('vh-beyondthehorizons')) return 'Our own site';
  return r.trim() ? 'Other' : 'Direct / app link';
}

const day = (sec: number) => dhakaDay(new Date(sec * 1000));
const hour = (sec: number) => new Date(sec * 1000 + DHAKA_MS).getUTCHours();
const weekday = (sec: number) => new Date(sec * 1000 + DHAKA_MS).getUTCDay();
const inc = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

type Row = Record<string, unknown>;
const all = <T extends Row>(q: ReturnType<typeof sql>) => db.all<T>(q);

export async function getLexicoreAnalytics() {
  // ponytail: raw outsider events aggregated in JS; fine at thousands of rows, move to SQL GROUP BYs past ~50k.
  const [link, linkPrior, linkUsers, people, events, studentsActive, srs, quizzes, usage, claims, devices] = await Promise.all([
    all<{ anon_id: string; user_id: number | null; referrer: string | null; utm_source: string | null; device: string | null; user_agent: string | null; started_at: number }>(
      sql`SELECT anon_id, user_id, referrer, utm_source, device, user_agent, started_at FROM analytics_sessions
          WHERE started_at >= ${S} AND started_at < ${E} AND ${LINK}`),
    all<{ anon_id: string }>(
      sql`SELECT DISTINCT anon_id FROM analytics_sessions WHERE started_at < ${S}
          AND anon_id IN (SELECT anon_id FROM analytics_sessions WHERE started_at >= ${S} AND started_at < ${E} AND ${LINK})`),
    all<{ anon_id: string; user_id: number }>(
      sql`SELECT DISTINCT anon_id, user_id FROM analytics_sessions WHERE user_id IS NOT NULL
          AND anon_id IN (SELECT anon_id FROM analytics_sessions WHERE started_at >= ${S} AND started_at < ${E} AND ${LINK})`),
    all<{ id: number; name: string | null; email: string; joined: number; lx_first: number | null; onboarded: number | null }>(
      sql`SELECT u.id, u.name, u.email, u.created_at AS joined, p.created_at AS lx_first, p.onboarding_complete AS onboarded
          FROM users u LEFT JOIN vocab_user_progress p ON p.user_id = u.id WHERE u.id IN (${OUT})`),
    all<{ user_id: number; session_id: string; type: string; path: string; duration_ms: number | null; created_at: number }>(
      sql`SELECT user_id, session_id, type, path, duration_ms, created_at FROM analytics_events
          WHERE created_at >= ${S} AND created_at < ${E} AND type IN ('pageview', 'page_exit')
          AND (path LIKE '/vocab%' OR path = '/lexicore' OR path LIKE '/lexicore/%') AND user_id IN (${OUT})`),
    all<{ n: number }>(
      sql`SELECT count(DISTINCT user_id) AS n FROM analytics_events
          WHERE created_at >= ${S} AND created_at < ${E} AND type = 'pageview' AND path LIKE '/vocab%'
          AND user_id IN (SELECT id FROM users WHERE role = 'student') AND user_id NOT IN (${OUT})`),
    all<{ user_id: number; event_type: string; rating: string; n: number }>(
      sql`SELECT user_id, event_type, rating, count(*) AS n FROM vocab_srs_events
          WHERE created_at >= ${S} AND created_at < ${E} AND user_id IN (${OUT}) GROUP BY 1, 2, 3`),
    all<{ user_id: number; n: number; done: number; score_sum: number }>(
      sql`SELECT user_id, count(*) AS n, sum(status = 'complete') AS done, sum(CASE WHEN status = 'complete' THEN score ELSE 0 END) AS score_sum
          FROM vocab_quiz_sessions WHERE started_at >= ${S} AND started_at < ${E} AND user_id IN (${OUT}) GROUP BY 1`),
    all<{ user_id: number; day: string; cards: number; quizzes: number }>(
      sql`SELECT user_id, day, cards, quizzes FROM lexicore_daily_usage WHERE day >= ${dhakaDay(LAUNCH)} AND user_id IN (${OUT})`),
    all<{ user_id: number; status: string; amount: number; promo_code: string | null; created_at: number }>(
      sql`SELECT user_id, status, amount, promo_code, created_at FROM lexicore_claims WHERE created_at >= ${S} AND created_at < ${E}`),
    all<{ device: string | null; n: number }>(
      sql`SELECT device, count(DISTINCT user_id) AS n FROM analytics_sessions
          WHERE started_at >= ${S} AND started_at < ${E} AND user_id IN (${OUT})
          AND id IN (SELECT session_id FROM analytics_events WHERE created_at >= ${S} AND created_at < ${E} AND path LIKE '/vocab%')
          GROUP BY 1`),
  ]);

  const outsiderIds = new Set(people.map(p => p.id));
  const now = Math.min(Date.now() / 1000, E);

  // ── Link clicks ────────────────────────────────────────────────────────────
  const prior = new Set(linkPrior.map(r => r.anon_id));
  const browsers = new Set(link.map(r => r.anon_id));
  const linkSignedIn = new Set(linkUsers.map(r => r.user_id));
  const sources = new Map<string, number>();
  const linkByDay = new Map<string, number>();
  for (const s of link) { inc(sources, sourceOf(s.referrer, s.utm_source)); inc(linkByDay, day(s.started_at)); }
  const inApp = link.filter(s => /FBAN|FBAV|FB_IAB|Instagram|FBIOS/.test(s.user_agent ?? '')).length;

  // ── Per person ─────────────────────────────────────────────────────────────
  const claimOf = new Map<number, (typeof claims)[number]>();
  for (const c of claims) if (!claimOf.has(c.user_id) || c.created_at > claimOf.get(c.user_id)!.created_at) claimOf.set(c.user_id, c);

  type P = {
    id: number; name: string; email: string; isNew: boolean; onboarded: boolean;
    first: number; last: number; days: Set<string>; sessions: Set<string>; ms: number; views: number;
    featureMs: Map<string, number>; cards: number; cardsGot: number; quizAnswers: number; quizCorrect: number;
    quizzes: number; quizzesDone: number; scoreSum: number; limitDays: number; nearDays: number;
  };
  const byId = new Map<number, P>();
  for (const p of people) {
    const firstLx = p.lx_first ?? p.joined;
    byId.set(p.id, {
      id: p.id, name: p.name ?? p.email, email: p.email, isNew: firstLx >= S, onboarded: !!p.onboarded,
      first: firstLx >= S ? firstLx : Infinity, last: 0, days: new Set(), sessions: new Set(), ms: 0, views: 0,
      featureMs: new Map(), cards: 0, cardsGot: 0, quizAnswers: 0, quizCorrect: 0,
      quizzes: 0, quizzesDone: 0, scoreSum: 0, limitDays: 0, nearDays: 0,
    });
  }

  const hours = Array(24).fill(0) as number[];
  const weekdays = Array(7).fill(0) as number[];
  const features = new Map<string, { views: number; ms: number; users: Set<number> }>();
  const pages = new Map<string, { views: number; users: Set<number> }>();
  const sessionMs = new Map<string, number>();
  const feat = (f: string) => features.get(f) ?? features.set(f, { views: 0, ms: 0, users: new Set() }).get(f)!;

  for (const e of events) {
    const p = byId.get(e.user_id);
    if (!p) continue;
    p.first = Math.min(p.first, e.created_at);
    p.last = Math.max(p.last, e.created_at);
    p.sessions.add(e.session_id);
    const f = featureOf(e.path);
    if (e.type === 'pageview') {
      p.views++; p.days.add(day(e.created_at));
      hours[hour(e.created_at)]++; weekdays[weekday(e.created_at)]++;
      const ft = feat(f); ft.views++; ft.users.add(p.id);
      const key = e.path.replace(/\/\d+(?=\/|$)/g, '/[id]');
      const pg = pages.get(key) ?? pages.set(key, { views: 0, users: new Set() }).get(key)!;
      pg.views++; pg.users.add(p.id);
    } else {
      const ms = Math.min(Math.max(e.duration_ms ?? 0, 0), PAGE_CAP_MS);
      p.ms += ms; inc(p.featureMs, f, ms); feat(f).ms += ms; inc(sessionMs, e.session_id, ms);
    }
  }
  for (const r of srs) {
    const p = byId.get(r.user_id); if (!p) continue;
    if (r.event_type === 'flashcard') { p.cards += r.n; if (r.rating === 'got_it') p.cardsGot += r.n; }
    else { p.quizAnswers += r.n; if (r.rating === 'correct') p.quizCorrect += r.n; }
  }
  for (const q of quizzes) {
    const p = byId.get(q.user_id); if (!p) continue;
    p.quizzes = q.n; p.quizzesDone = q.done ?? 0; p.scoreSum = q.score_sum ?? 0;
  }
  for (const u of usage) {
    const p = byId.get(u.user_id); if (!p) continue;
    // recordUse also counts paid users, so only days before their claim are limit hits.
    const claim = claimOf.get(u.user_id);
    if (claim && claim.status !== 'rejected' && u.day >= day(claim.created_at)) continue;
    if (u.cards >= FREE_CARDS_PER_DAY || u.quizzes >= FREE_QUIZZES_PER_DAY) p.limitDays++;
    else if (u.cards >= FREE_CARDS_PER_DAY * 0.75) p.nearDays++;
  }

  // Everyone who touched LexiCore in the window, or started it then without using it.
  const active = [...byId.values()].filter(p => p.views > 0 || p.isNew);
  const fresh = active.filter(p => p.isNew);
  const returnedOf = (ps: P[]) => ps.filter(p => p.days.size >= 2).length;
  const oldEnough = (ps: P[]) => ps.filter(p => p.first < now - 86400).length; // could have come back by now

  const rows = active.map(p => {
    const claim = claimOf.get(p.id);
    const top = [...p.featureMs].filter(([f]) => !['Home', 'Profile', 'Landing page'].includes(f)).sort((a, b) => b[1] - a[1])[0];
    return {
      id: p.id, name: p.name, email: p.email, isNew: p.isNew, onboarded: p.onboarded,
      firstSeen: Number.isFinite(p.first) ? p.first * 1000 : null, lastSeen: p.last ? p.last * 1000 : null,
      days: p.days.size, sessions: p.sessions.size, minutes: Math.round(p.ms / 60_000), views: p.views,
      cards: p.cards, cardAccuracy: p.cards ? Math.round((p.cardsGot / p.cards) * 100) : null,
      quizzes: p.quizzes, quizAvg: p.quizzesDone ? Math.round(p.scoreSum / p.quizzesDone) : null,
      topFeature: top?.[0] ?? null, limitDays: p.limitDays, nearDays: p.nearDays,
      plan: claim ? (claim.status === 'rejected' ? 'Rejected' : claim.status === 'held' ? 'Held' : `Paid ৳${claim.amount}`) : 'Free',
    };
  }).sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

  // ── Daily trend ────────────────────────────────────────────────────────────
  const days: { day: string; clicks: number; newPeople: number; activePeople: number }[] = [];
  for (let t = S; t < now; t += 86400) {
    const d = day(t);
    days.push({
      day: d,
      clicks: linkByDay.get(d) ?? 0,
      newPeople: fresh.filter(p => Number.isFinite(p.first) && day(p.first) === d).length,
      activePeople: active.filter(p => p.days.has(d)).length,
    });
  }

  const sum = (ps: P[], f: (p: P) => number) => ps.reduce((n, p) => n + f(p), 0);
  const paid = claims.filter(c => c.status === 'active' || c.status === 'approved');
  const codes = new Map<string, number>();
  for (const c of paid) inc(codes, c.promo_code ?? 'No code');

  return {
    window: { from: LAUNCH.toISOString(), to: PAID_UNTIL.toISOString(), dayNumber: days.length, totalDays: Math.ceil((E - S) / 86400) },
    link: {
      visits: link.length, browsers: browsers.size,
      firstTime: [...browsers].filter(a => !prior.has(a)).length,
      signedIn: linkSignedIn.size,
      signedInOutsiders: [...linkSignedIn].filter(id => outsiderIds.has(id)).length,
      inAppShare: link.length ? Math.round((inApp / link.length) * 100) : 0,
      sources: [...sources].sort((a, b) => b[1] - a[1]),
      devices: [...link.reduce((m, s) => inc(m, s.device ?? 'unknown'), new Map<string, number>())],
    },
    people: {
      active: active.length, fresh: fresh.length, returning: active.length - fresh.length, studentsActive: studentsActive[0]?.n ?? 0,
      freshOnboarded: fresh.filter(p => p.onboarded).length,
      freshUsedCards: fresh.filter(p => p.cards > 0).length,
      freshTookQuiz: fresh.filter(p => p.quizzes > 0).length,
      freshReturned: returnedOf(fresh), freshCouldReturn: oldEnough(fresh),
      activeReturned: returnedOf(active), activeCouldReturn: oldEnough(active),
      freshHitLimit: fresh.filter(p => p.limitDays > 0).length,
      activeHitLimit: active.filter(p => p.limitDays > 0).length,
      activeNearLimit: active.filter(p => p.limitDays === 0 && p.nearDays > 0).length,
      devices: devices.map(d => [d.device ?? 'unknown', d.n] as [string, number]),
    },
    usage: {
      cards: sum(active, p => p.cards), quizzes: sum(active, p => p.quizzes), quizzesDone: sum(active, p => p.quizzesDone),
      minutes: Math.round(sum(active, p => p.ms) / 60_000),
      medianSessionMin: Math.round(median([...sessionMs.values()].filter(ms => ms > 0)) / 6_000) / 10,
      medianMinPerActiveDay: Math.round(median(active.filter(p => p.days.size).map(p => p.ms / 60_000 / p.days.size)) * 10) / 10,
      cardAccuracy: sum(active, p => p.cards) ? Math.round((sum(active, p => p.cardsGot) / sum(active, p => p.cards)) * 100) : null,
      quizAccuracy: sum(active, p => p.quizAnswers) ? Math.round((sum(active, p => p.quizCorrect) / sum(active, p => p.quizAnswers)) * 100) : null,
      hours, weekdays,
      features: [...features].map(([name, f]) => ({ name, views: f.views, minutes: Math.round(f.ms / 60_000), users: f.users.size }))
        .sort((a, b) => b.users - a.users || b.minutes - a.minutes),
      pages: [...pages].map(([path, p]) => ({ path, views: p.views, users: p.users.size })).sort((a, b) => b.views - a.views).slice(0, 15),
    },
    money: {
      claims: claims.length, paid: paid.length, revenue: paid.reduce((n, c) => n + c.amount, 0),
      held: claims.filter(c => c.status === 'held').length, rejected: claims.filter(c => c.status === 'rejected').length,
      codes: [...codes],
    },
    days,
    rows,
  };
}

export type LexicoreAnalytics = Awaited<ReturnType<typeof getLexicoreAnalytics>>;

/* ─── Drop-off funnel: one row per browser that opened the LexiCore link ─── */

/** Funnel steps in order. `lx_step` events (WelcomeFlow / OnboardingFlow) map onto these. */
export const FUNNEL = [
  { key: 'landed',    label: 'Opened the link' },
  { key: 'card',      label: 'Tapped "Show me"' },
  { key: 'flipped',   label: 'Flipped the demo card' },
  { key: 'game',      label: 'Tapped "This is my card" (game starts)' },
  { key: 'played',    label: 'Answered a game word' },
  { key: 'read',      label: 'Finished the game (saw their result)' },
  { key: 'auth',      label: 'Tapped "Keep going" (sign-in screen)' },
  { key: 'google',    label: 'Tapped "Continue with Google"' },
  { key: 'signed',    label: 'Came back signed in' },
  { key: 'ob_quiz',   label: 'Onboarding: studied their weak words' },
  { key: 'ob_tracks', label: 'Onboarding: picked what to study' },
  { key: 'ob_pace',   label: 'Onboarding: picked a pace' },
  { key: 'done',      label: 'Finished onboarding' },
  { key: 'used',      label: 'Used the app after onboarding' },
] as const;
const STEP_RANK: Record<string, number> = {
  thesis: 0, card: 1, card_flipped: 2, card_style: 2, diagnostic: 3, game_first_answer: 4,
  game_done: 5, read: 5, auth: 6, google_click: 7, ob_study: 8, ob_result: 9, ob_quiz: 9,
  ob_tracks: 10, ob_pace: 11, ob_complete: 12,
};
const STEP_SHORT: Record<string, string> = {
  thesis: 'intro', card: 'show me', card_flipped: 'flip', card_style: 'style', diagnostic: 'game',
  game_first_answer: '1st answer', game_done: 'game done', read: 'result', auth: 'sign-in screen',
  google_click: 'GOOGLE', open_browser: 'OPEN IN BROWSER', copy_link: 'copy link', resumed: 'resumed in browser', ob_study: 'ob study', ob_quiz: 'ob quiz', ob_result: 'ob result',
  ob_tracks: 'ob tracks', ob_pace: 'ob pace', ob_complete: 'DONE', ob_error: 'ob ERROR',
  ob_no_draft: 'NO DRAFT, sent back', pool_failed: 'GAME LOAD FAILED',
};

/** User agent → device bucket. In-app = opened inside Facebook / Instagram / Messenger. */
export function deviceOf(ua: string | null): string {
  const u = ua ?? '';
  const os = /Android/i.test(u) ? 'Android' : /iPhone|iPad|iPod/i.test(u) ? 'iPhone' : 'Computer';
  if (os === 'Computer') return 'Computer';
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger/i.test(u) ? `${os} · inside FB/IG app` : `${os} · browser`;
}

export async function getLexicoreFunnel() {
  const LINK_ANON = sql`SELECT anon_id FROM analytics_sessions WHERE started_at >= ${S} AND started_at < ${E} AND ${LINK}`;
  const [sessions, events, outsiders] = await Promise.all([
    all<{ anon_id: string; user_id: number | null; referrer: string | null; utm_source: string | null; user_agent: string | null; started_at: number; entry_path: string | null }>(
      sql`SELECT anon_id, user_id, referrer, utm_source, user_agent, started_at, entry_path FROM analytics_sessions
          WHERE started_at >= ${S} AND started_at < ${E} AND anon_id IN (${LINK_ANON}) ORDER BY started_at`),
    all<{ anon_id: string; user_id: number | null; type: string; name: string | null; path: string | null; props: string | null; duration_ms: number | null; created_at: number }>(
      sql`SELECT anon_id, user_id, type, name, path, props, duration_ms, created_at FROM analytics_events
          WHERE created_at >= ${S} AND created_at < ${E} AND anon_id IN (${LINK_ANON})
          AND (type IN ('pageview', 'page_exit') OR name IN ('lx_step', 'onboarding_started'))
          ORDER BY created_at, id`),
    all<{ id: number }>(sql`${OUT}`),
  ]);
  const outsiderIds = new Set(outsiders.map(o => o.id));

  type B = {
    first: number; device: string; source: string; userId: number | null;
    steps: { step: string; at: number; props: Record<string, unknown> }[];
    paths: Set<string>; landingMs: number; furthest: number; tracked: boolean; leftAt: string | null; leftMs: number | null; from?: string;
  };
  const browsers = new Map<string, B>();
  for (const s of sessions) {
    let b = browsers.get(s.anon_id);
    if (!b) {
      b = { first: s.started_at, device: deviceOf(s.user_agent), source: sourceOf(s.referrer, s.utm_source),
            userId: null, steps: [], paths: new Set(), landingMs: 0, furthest: 0, tracked: false, leftAt: null, leftMs: null };
      browsers.set(s.anon_id, b);
    }
    if (s.user_id) b.userId = s.user_id;
  }
  for (const e of events) {
    const b = browsers.get(e.anon_id);
    if (!b) continue;
    if (e.user_id) b.userId = e.user_id;
    if (e.type === 'pageview' && e.path) b.paths.add(e.path.split('?')[0]);
    if (e.type === 'page_exit' && e.path === '/lexicore') b.landingMs += Math.min(e.duration_ms ?? 0, PAGE_CAP_MS);
    if (e.name === 'onboarding_started') b.furthest = Math.max(b.furthest, 8);
    if (e.name !== 'lx_step') continue;
    let props: Record<string, unknown> = {};
    try { props = JSON.parse(e.props ?? '{}'); } catch { /* bad JSON, ignore */ }
    const step = String(props.step ?? '');
    b.tracked = true;
    if (step === 'left') { b.leftAt = String(props.at ?? ''); b.leftMs = Number(props.ms ?? 0); continue; }
    if (step === 'resumed' && typeof props.from === 'string') b.from = props.from;
    b.steps.push({ step, at: e.created_at, props });
    if (step in STEP_RANK) b.furthest = Math.max(b.furthest, STEP_RANK[step]);
  }

  // A browser opened from the Facebook app's "Open in browser" link is the same
  // person: fold it into the in-app browser it came from.
  for (const [anon, b] of browsers) {
    const src = b.from ? browsers.get(b.from) : undefined;
    if (!src || src === b) continue;
    src.steps.push(...b.steps); src.steps.sort((x, y) => x.at - y.at);
    for (const p of b.paths) src.paths.add(p);
    src.userId ??= b.userId;
    src.furthest = Math.max(src.furthest, b.furthest);
    if (b.leftAt) { src.leftAt = b.leftAt; src.leftMs = b.leftMs; }
    browsers.delete(anon);
  }

  // VH students / staff who opened the link are not the public audience: left out.
  const everyone = [...browsers.values()];
  const rows = everyone.filter(b => !b.userId || outsiderIds.has(b.userId));
  for (const b of rows) {
    // Signals that predate step tracking: signed in, onboarded, used the app.
    if (b.userId || [...b.paths].some(p => p.startsWith('/vocab/onboarding'))) b.furthest = Math.max(b.furthest, 8);
    if ([...b.paths].some(p => p.startsWith('/vocab') && !p.startsWith('/vocab/onboarding'))) b.furthest = 13;
  }

  const reached = (list: B[]) => FUNNEL.map((_, i) => list.filter(b => b.furthest >= i).length);
  const tracked = rows.filter(b => b.tracked);

  // Seconds spent on the step they quit at (tracked browsers only).
  const stuck = FUNNEL.map((_, i) => {
    const here = tracked.filter(b => b.furthest === i);
    const secs = here.map(b => b.leftMs != null ? b.leftMs / 1000 : (b.steps.at(-1)?.at ?? b.first) - (b.steps[0]?.at ?? b.first));
    return { left: here.length, medianSecs: Math.round(median(secs)) };
  });

  const journeys = rows
    .sort((a, b) => b.first - a.first)
    .map(b => {
      const t0 = b.steps[0]?.at ?? b.first;
      const parts: string[] = [];
      let prev = '';
      for (const s of b.steps) {
        if (s.step === prev && s.step !== 'diagnostic') continue; // collapse repeats (style taps, re-flips)
        prev = s.step;
        const extra = s.step === 'game_done' ? ` (${Number(s.props.answered) - Number(s.props.wrong)}/${s.props.answered} right)` : '';
        parts.push(`${STEP_SHORT[s.step] ?? s.step}${extra} ${s.at - t0}s`);
      }
      if (b.leftAt) parts.push(`left at ${b.leftAt} after ${Math.round((b.leftMs ?? 0) / 1000)}s`);
      return {
        when: b.first, device: b.device, source: b.source, signedIn: !!b.userId,
        furthest: FUNNEL[b.furthest].label, landingSecs: Math.round(b.landingMs / 1000),
        path: b.tracked ? parts.join(' → ') : '(before step tracking)',
      };
    });

  const devices = [...new Set(rows.map(b => b.device))].sort();
  return {
    total: everyone.length, excluded: everyone.length - rows.length, outsiders: rows.length, trackedCount: tracked.length,
    allReached: reached(rows), trackedReached: reached(tracked), stuck,
    byDevice: devices.map(d => {
      const list = rows.filter(b => b.device === d);
      const n = (i: number) => list.filter(b => b.furthest >= i).length;
      return { device: d, n: list.length, signed: n(8), done: n(12) };
    }),
    oddities: {
      noDraft: tracked.filter(b => b.steps.some(s => s.step === 'ob_no_draft')).length,
      poolFailed: tracked.filter(b => b.steps.some(s => s.step === 'pool_failed')).length,
      obError: tracked.filter(b => b.steps.some(s => s.step === 'ob_error')).length,
      googleNoReturn: tracked.filter(b => b.furthest === 7).length,
      openedBrowser: tracked.filter(b => b.steps.some(s => s.step === 'open_browser')).length,
      resumed: tracked.filter(b => b.steps.some(s => s.step === 'resumed')).length,
    },
    journeys,
  };
}
export type LexicoreFunnel = Awaited<ReturnType<typeof getLexicoreFunnel>>;
