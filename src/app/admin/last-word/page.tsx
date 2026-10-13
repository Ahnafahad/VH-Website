import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/auth/roles';
import { users } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { lastWordDecisions, lastWordEdgeMastery } from '@/lib/db/schema';
import { BG, BORDER, MUTED, OK, OK_BG, R_LG, R_PILL, RED, SLATE, SURFACE, T_BASE, T_SM, T_XS, WARN, WARN_BG } from '@/components/admin/lms/tokens';
import { PLAYER_STATUSES, readContent } from '@/features/last-word/content/load';
import { flagItems, positionBias, type DecisionRow } from '@/features/last-word/content/quality';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Last Word content · Admin' };

/**
 * Editorial view (§26 stage 8, §45, §46): every set's review status and validator findings, a staff
 * preview link, and live item-quality flags. Read-only by design: content is versioned files, so a
 * status change is a reviewed commit (`npm run last-word:set-status`), not a database write.
 */
export default async function LastWordEditorialPage() {
  // Own guard as well as the admin layout's: layouts do not re-run on every navigation.
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');
  if (!isStaffRole(session.user.role)) redirect('/vocab');
  const report = readContent();
  const live = new Set(report.sets.filter(s => PLAYER_STATUSES.includes(s.set.status)).map(s => s.set.set_id));
  const analytics = await loadAnalytics(live);
  const chainText = new Map(report.sets.flatMap(({ set }) => set.chains.flatMap(c => c.beats.map(b => [`${c.id} ${b.id}`, { set: set.set_id, text: b.text }] as const))));

  return (
    <div style={{ padding: 'clamp(16px, 3vw, 32px)', background: BG, minHeight: '100%', color: SLATE, fontSize: T_BASE }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Last Word content</h1>
      <p style={{ color: MUTED, maxWidth: 760, lineHeight: 1.6 }}>
        Players see <b>approved</b> and <b>published</b> sets only. Chains with errors are withheld automatically. To change a status, run{' '}
        <code>npm run last-word:set-status -- &lt;set_id&gt; approved</code>, commit and deploy. Full workflow: <code>content/last-word/README.md</code>.
      </p>

      {report.failures.length > 0 && (
        <section style={card(WARN_BG)}>
          <h2 style={h2}>Files that cannot load</h2>
          {report.failures.map(f => <p key={f.file}><b>{f.file}</b>: {f.errors.slice(0, 3).join('; ')}</p>)}
        </section>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {report.sets.map(({ file, set, problems, playableChains }) => {
          const errors = problems.filter(p => p.level === 'error');
          const warnings = problems.length - errors.length;
          const live = PLAYER_STATUSES.includes(set.status);
          return (
            <section key={file} style={card(SURFACE)}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <h2 style={{ ...h2, margin: 0 }}>{set.title}</h2>
                <span style={pill(live ? OK_BG : WARN_BG, live ? OK : WARN)}>{set.status}{live ? ' · live' : ' · hidden'}</span>
                <span style={{ color: MUTED, fontSize: T_SM }}>{set.set_id} · {set.source?.format ?? 'hand-authored'}{set.source?.qa ? ` · critic ${set.source.qa.pass} pass / ${set.source.qa.revised} revised / ${set.source.qa.rejected} rejected` : ''}</span>
                <Link href={`/vocab/games/last-word?preview=${set.set_id}`} style={{ marginLeft: 'auto', color: RED, fontWeight: 600 }}>Preview in game →</Link>
              </div>
              <p style={{ margin: '8px 0', color: MUTED }}>
                {set.words.map(w => w.word).join(' / ')} · {set.edges.length} distinction{set.edges.length > 1 ? 's' : ''} · {playableChains}/{set.chains.length} chains playable · {warnings} editorial warning{warnings === 1 ? '' : 's'}
              </p>
              {errors.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, color: RED }}>
                  {errors.map((p, i) => <li key={i}>{p.chainId ? <b>{p.chainId}: </b> : null}{p.message} (withheld)</li>)}
                </ul>
              )}
              {warnings > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: 'pointer', color: MUTED }}>Editorial warnings</summary>
                  <ul style={{ fontSize: T_SM, color: MUTED }}>
                    {problems.filter(p => p.level === 'warning').map((p, i) => <li key={i}>{p.chainId ? <b>{p.chainId}: </b> : null}{p.message}</li>)}
                  </ul>
                </details>
              )}
            </section>
          );
        })}
      </div>

      <section style={{ ...card(SURFACE), marginTop: 20 }}>
        <h2 style={h2}>Items to re-review (live data)</h2>
        {analytics.error ? (
          <p style={{ color: MUTED }}>{analytics.error}</p>
        ) : analytics.flags.length === 0 ? (
          <p style={{ color: MUTED }}>No item is flagged. Items need at least 12 decisions before they are judged ({analytics.total} decisions recorded).</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {analytics.flags.map(f => (
              <li key={`${f.scenarioId} ${f.beatId}`} style={{ marginBottom: 8 }}>
                <b>{chainText.get(`${f.scenarioId} ${f.beatId}`)?.set ?? '?'} · {f.scenarioId}</b> ({f.n} decisions): {f.reasons.join('; ')}
                <div style={{ color: MUTED, fontSize: T_SM }}>{chainText.get(`${f.scenarioId} ${f.beatId}`)?.text ?? 'Beat no longer in content.'}</div>
              </li>
            ))}
          </ul>
        )}
        {analytics.bias.length > 0 && (
          <p style={{ color: MUTED, fontSize: T_SM }}>
            Accuracy by position of the best word: {analytics.bias.map(b => `slot ${b.slot} ${Math.round(b.accuracy * 100)}% (${b.shown})`).join(' · ')}. A large gap suggests position bias.
          </p>
        )}
      </section>
    </div>
  );
}

/** Learner evidence only: staff playtests and not-yet-live sets would otherwise skew the flags. */
async function loadAnalytics(live: Set<string>) {
  try {
    const all = await db.select({
      userId: lastWordDecisions.userId, setId: lastWordDecisions.setId, edgeId: lastWordDecisions.edgeId, scenarioId: lastWordDecisions.scenarioId, beatId: lastWordDecisions.beatId,
      selectedWord: lastWordDecisions.selectedWord, bestWord: lastWordDecisions.bestWord, correctness: lastWordDecisions.correctness,
      semanticFit: lastWordDecisions.semanticFit, reactionTimeMs: lastWordDecisions.reactionTimeMs, presentedWords: lastWordDecisions.presentedWords,
    }).from(lastWordDecisions).limit(50_000); // ponytail: in-memory aggregation; move to SQL GROUP BY past ~50k decisions.
    const staff = new Set((await db.select({ id: users.id, role: users.role }).from(users)).filter(u => isStaffRole(u.role)).map(u => u.id));
    const rows = all.filter(r => live.has(r.setId) && !staff.has(r.userId));
    const mastery = await db.select({ userId: lastWordEdgeMastery.userId, edgeId: lastWordEdgeMastery.edgeId, data: lastWordEdgeMastery.data }).from(lastWordEdgeMastery);
    const strong = new Set(mastery.filter(m => /"status":"(Fluent|Mastered)"/.test(m.data)).map(m => `${m.userId} ${m.edgeId}`));
    const decisions: DecisionRow[] = rows.map(r => ({ ...r, learnerStrong: strong.has(`${r.userId} ${r.edgeId}`) }));
    return { flags: flagItems(decisions), bias: positionBias(rows.map(r => ({ ...r, presentedWords: JSON.parse(r.presentedWords) as string[] }))), total: rows.length, error: null };
  } catch {
    return { flags: [], bias: [], total: 0, error: 'Live analytics are unavailable: the Last Word tables are not in this database yet (see docs/last-word/RUNBOOK.md, migration 0005).' };
  }
}

const card = (background: string) => ({ background, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 16 });
const h2 = { fontSize: 16, margin: '0 0 8px' };
const pill = (background: string, color: string) => ({ background, color, borderRadius: R_PILL, padding: '2px 10px', fontSize: T_XS, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.06em' });
