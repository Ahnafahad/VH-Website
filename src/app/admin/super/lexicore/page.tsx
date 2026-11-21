import { getLexicoreAnalytics } from '@/lib/vocab/lexicore-analytics';
import {
  BG, BORDER, MUTED, SLATE, SURFACE, SURFACE_ALT, RED, OK, OK_BG, WARN, WARN_BG, INFO,
  R_LG, R_PILL, SHADOW_SM, FONT_HEADING, T_XS, T_SM, T_BASE, T_LG, T_XL,
} from '@/components/admin/lms/tokens';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'LexiCore analytics — VH Super Admin' };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');
const dt = (ms: number | null) => ms == null ? '–'
  : new Date(ms).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dayLabel = (d: string) => new Date(`${d}T00:00:00+06:00`).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short' });
const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const card: React.CSSProperties = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 16, boxShadow: SHADOW_SM };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: T_XS, color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 10px', fontSize: T_SM, color: SLATE, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' };

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontFamily: FONT_HEADING, fontSize: T_LG, color: SLATE, margin: '0 0 4px' }}>{title}</h2>
      {note && <p style={{ fontSize: T_SM, color: MUTED, margin: '0 0 12px' }}>{note}</p>}
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: T_XS, color: MUTED, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: SLATE, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: T_XS, color: MUTED, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Grid({ min = 160, children }: { min?: number; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>{children}</div>;
}

/** Horizontal bars: [label, value, extra text]. */
function Bars({ rows, color = RED }: { rows: [string, number, string?][]; color?: string }) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  if (!rows.length) return <p style={{ fontSize: T_SM, color: MUTED, margin: 0 }}>No data yet.</p>;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map(([label, n, extra]) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 160px) 1fr auto', gap: 10, alignItems: 'center', fontSize: T_SM }}>
          <span style={{ color: SLATE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <div style={{ background: SURFACE_ALT, borderRadius: R_PILL, height: 10 }}>
            <div style={{ width: `${(n / max) * 100}%`, background: color, borderRadius: R_PILL, height: 10, minWidth: n ? 3 : 0 }} />
          </div>
          <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>{extra ?? n}</span>
        </div>
      ))}
    </div>
  );
}

/** Vertical columns, e.g. 24 hours. */
function Columns({ values, labels, every = 1 }: { values: number[]; labels: string[]; every?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
      {values.map((v, i) => (
        <div key={i} title={`${labels[i]}: ${v}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ width: '100%', height: `${(v / max) * 100}%`, minHeight: v ? 2 : 0, background: RED, borderRadius: '3px 3px 0 0' }} />
          <span style={{ fontSize: 9, color: MUTED, marginTop: 4, visibility: i % every ? 'hidden' : 'visible' }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr>{head.map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Pill({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'plain' }) {
  const [bg, fg] = tone === 'ok' ? [OK_BG, OK] : tone === 'warn' ? [WARN_BG, WARN] : [SURFACE_ALT, MUTED];
  return <span style={{ background: bg, color: fg, borderRadius: R_PILL, padding: '2px 8px', fontSize: T_XS, fontWeight: 600 }}>{text}</span>;
}

export default async function LexicoreAnalyticsPage() {
  const a = await getLexicoreAnalytics();
  const { link, people: p, usage: u, money } = a;
  const funnel: [string, number, string?][] = [
    ['Clicked the link', link.browsers, `${link.browsers}`],
    ['First-time visitors', link.firstTime, `${link.firstTime}`],
    ['New outsiders signed in', p.fresh, `${p.fresh}`],
    ['Finished onboarding', p.freshOnboarded, `${p.freshOnboarded}`],
    ['Used flashcards', p.freshUsedCards, `${p.freshUsedCards}`],
    ['Took a quiz', p.freshTookQuiz, `${p.freshTookQuiz}`],
    ['Came back another day', p.freshReturned, `${p.freshReturned}`],
    ['Hit the free limit', p.freshHitLimit, `${p.freshHitLimit}`],
    ['Paid', money.paid, `${money.paid}`],
  ];

  return (
    <div style={{ background: BG, minHeight: '100%', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontFamily: FONT_HEADING, fontSize: T_XL, color: SLATE, margin: 0 }}>LexiCore analytics</h1>
        <p style={{ fontSize: T_BASE, color: MUTED, margin: '6px 0 0' }}>
          Public launch, 19 Nov to 5 Dec 2026 (day {Math.min(a.window.dayNumber, a.window.totalDays)} of {a.window.totalDays}).
          Outsiders = anyone who is not a VH student or staff. Times are Dhaka time. Refresh for the latest numbers.
        </p>

        <Section title="Traction">
          <Grid>
            <Tile label="Link clicks" value={link.visits} sub={`${link.browsers} different browsers`} />
            <Tile label="First-time visitors" value={link.firstTime} sub="never on the site before" />
            <Tile label="New outsiders" value={p.fresh} sub="started LexiCore since launch" />
            <Tile label="Outsiders using it" value={p.active} sub={`${p.returning} had an account before launch`} />
            <Tile label="Came back another day" value={pct(p.freshReturned, p.freshCouldReturn)} sub={`${p.freshReturned} of ${p.freshCouldReturn} new outsiders`} />
            <Tile label="Hit the free limit" value={p.activeHitLimit} sub={`${p.activeNearLimit} more got close (15+ cards)`} />
            <Tile label="Paid" value={money.paid} sub={`৳${money.revenue}${money.held ? `, ${money.held} held` : ''}${money.rejected ? `, ${money.rejected} rejected` : ''}`} />
            <Tile label="VH students also active" value={p.studentsActive} sub="for comparison" />
          </Grid>
        </Section>

        <Section title="From click to paying" note="New outsiders only. Each step counts people, not visits. The first two rows are browsers, so one person on two phones counts twice.">
          <div style={card}><Bars rows={funnel} /></div>
        </Section>

        <Section title="Where the clicks came from" note={`${link.signedIn} of the clicking browsers signed in (${link.signedInOutsiders} outsiders). ${link.inAppShare}% opened in the Facebook/Instagram in-app browser.`}>
          <Grid min={280}>
            <div style={card}><div style={{ ...th, border: 0, padding: '0 0 10px' }}>Source</div><Bars rows={link.sources} /></div>
            <div style={card}><div style={{ ...th, border: 0, padding: '0 0 10px' }}>Device (clicks)</div><Bars rows={link.devices} color={INFO} /></div>
            <div style={card}><div style={{ ...th, border: 0, padding: '0 0 10px' }}>Device (outsiders using it)</div><Bars rows={p.devices} color={INFO} /></div>
          </Grid>
        </Section>

        <Section title="Day by day">
          <Table head={['Day', 'Link clicks', 'New outsiders', 'Outsiders active']}>
            {a.days.map(d => (
              <tr key={d.day}>
                <td style={td}>{dayLabel(d.day)}</td><td style={td}>{d.clicks}</td><td style={td}>{d.newPeople}</td><td style={td}>{d.activePeople}</td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section title="How much they use it" note="All outsiders active since launch.">
          <Grid>
            <Tile label="Flashcards rated" value={u.cards} sub={u.cardAccuracy != null ? `${u.cardAccuracy}% marked "got it"` : undefined} />
            <Tile label="Quizzes started" value={u.quizzes} sub={`${u.quizzesDone} finished${u.quizAccuracy != null ? `, ${u.quizAccuracy}% answers right` : ''}`} />
            <Tile label="Total time" value={`${u.minutes} min`} sub="visible time on LexiCore pages" />
            <Tile label="Typical visit" value={`${u.medianSessionMin} min`} sub="median visit length" />
            <Tile label="Typical day" value={`${u.medianMinPerActiveDay} min`} sub="median per person per active day" />
          </Grid>
        </Section>

        <Section title="When they use it" note="Page views by outsiders, Dhaka time.">
          <Grid min={300}>
            <div style={card}><div style={{ ...th, border: 0, padding: '0 0 10px' }}>Hour of day</div><Columns values={u.hours} labels={u.hours.map((_, h) => hourLabel(h))} every={3} /></div>
            <div style={card}><div style={{ ...th, border: 0, padding: '0 0 10px' }}>Day of week</div><Columns values={u.weekdays} labels={WEEKDAYS} /></div>
          </Grid>
        </Section>

        <Section title="Favourite features" note="Sorted by how many people used each one. Minutes are visible time on those pages.">
          <Table head={['Feature', 'People', 'Views', 'Minutes']}>
            {u.features.map(f => (
              <tr key={f.name}><td style={td}>{f.name}</td><td style={td}>{f.users}</td><td style={td}>{f.views}</td><td style={td}>{f.minutes}</td></tr>
            ))}
          </Table>
        </Section>

        <Section title="Most viewed pages">
          <div style={card}><Bars rows={u.pages.map(pg => [pg.path, pg.views, `${pg.views} views, ${pg.users} people`])} /></div>
        </Section>

        {money.codes.length > 0 && (
          <Section title="Discount codes">
            <div style={card}><Bars rows={money.codes} color={OK} /></div>
          </Section>
        )}

        <Section title="Every outsider" note={`${a.rows.length} people, most recent first. "Limit" = days they used all free flashcards or quizzes before paying.`}>
          <Table head={['Person', '', 'First seen', 'Last seen', 'Days', 'Visits', 'Min', 'Cards', 'Quizzes', 'Top feature', 'Limit', 'Plan']}>
            {a.rows.map(r => (
              <tr key={r.id}>
                <td style={td}><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: T_XS, color: MUTED }}>{r.email}</div></td>
                <td style={td}>{r.isNew ? <Pill text="New" tone="ok" /> : <Pill text="Older" tone="plain" />}{!r.onboarded && <> <Pill text="Not onboarded" tone="warn" /></>}</td>
                <td style={td}>{dt(r.firstSeen)}</td>
                <td style={td}>{dt(r.lastSeen)}</td>
                <td style={td}>{r.days}</td>
                <td style={td}>{r.sessions}</td>
                <td style={td}>{r.minutes}</td>
                <td style={td}>{r.cards}{r.cardAccuracy != null && <span style={{ color: MUTED }}> ({r.cardAccuracy}%)</span>}</td>
                <td style={td}>{r.quizzes}{r.quizAvg != null && <span style={{ color: MUTED }}> (avg {r.quizAvg}%)</span>}</td>
                <td style={td}>{r.topFeature ?? '–'}</td>
                <td style={td}>{r.limitDays ? <Pill text={`${r.limitDays} day${r.limitDays > 1 ? 's' : ''}`} tone="warn" /> : r.nearDays ? 'close' : '–'}</td>
                <td style={td}>{r.plan.startsWith('Paid') ? <Pill text={r.plan} tone="ok" /> : r.plan}</td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>
    </div>
  );
}
