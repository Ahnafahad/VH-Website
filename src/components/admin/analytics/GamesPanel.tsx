'use client';

/**
 * Statistics > Games. Direction A scoreboard (one row per game, ranked by plays), the Last Word deep dive, and
 * the LexiCore settings card. Single hue (INFO) for every chart, values written at the end of each mark, so no
 * axis or legend is needed. Every figure says where it comes from through the Data column.
 */

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronRight } from 'lucide-react';
import {
  BORDER, BORDER_FIELD, INFO, INFO_BG, INK_SOFT, MUTED, OK, OK_BG, R_LG, R_SM, RED, RED_DARK, SHADOW_SM,
  SPIN_CSS, SURFACE, SURFACE_ALT, T_2XL, T_BASE, T_LG, T_MD, T_SM, T_XS, WARN, WARN_BG,
} from '../lms/lms-shared';
import { isAdminRole } from '@/lib/auth/roles';
import LexicoreSettingsCard from './LexicoreSettingsCard';
import type { DataQuality, GamePeriod, GameStat, MasterySplit, SetStat } from '@/lib/analytics/games';

// ─── Types (shape of GET /api/admin/analytics?section=games) ──────────────────

export interface GamesData {
  period: GamePeriod;
  games: GameStat[];
  lastWord: {
    available: boolean;
    summary: { sessions: number; decisions: number; players: number; bestRate: number | null; decisionsPerSession: number | null };
    sets: SetStat[];
    mastery: MasterySplit;
    sessionsPerWeek: number[];
    reviewsDue: { count: number; players: number };
  };
}

interface Props {
  data: GamesData;
  onPeriodChange: (p: GamePeriod) => void;
}

const PERIODS: GamePeriod[] = [7, 30, 90];
const mono: React.CSSProperties = { fontFamily: 'var(--font-math-mono), ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' };
const fmt = (n: number) => n.toLocaleString();

const QUALITY: Record<DataQuality, { label: string; fg: string; bg: string; hint: string }> = {
  exact:     { label: 'Exact',     fg: OK,    bg: OK_BG,   hint: 'Counted from the game’s own table' },
  estimated: { label: 'Estimated', fg: INFO,  bg: INFO_BG, hint: 'Counted from feature-tracker events' },
  none:      { label: 'No record', fg: WARN,  bg: WARN_BG, hint: 'This game does not write a play record' },
};

function Stamp({ q }: { q: DataQuality }) {
  const s = QUALITY[q];
  return (
    <span
      title={s.hint}
      style={{
        display: 'inline-block', fontSize: T_XS, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
        color: s.fg, background: s.bg, border: `1px solid ${s.fg}`, borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

/** Weekly counts, own scale per row, last value written at the end. */
function Spark({ values, width = 96, height = 24, label }: { values: number[]; width?: number; height?: number; label: string }) {
  const max = Math.max(1, ...values);
  const pad = 3;
  const step = (width - pad * 2 - 22) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [pad + i * step, height - pad - (v / max) * (height - pad * 2)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} role="img" aria-label={`${label}: ${values.join(', ')}`} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={INFO} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={INFO} />
      <text x={last[0] + 7} y={last[1] + 4} fontSize={T_XS} fill={INK_SOFT} style={mono}>{values[values.length - 1]}</text>
    </svg>
  );
}

/** Larger weekly chart with a value above every bar. */
function WeekBars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  return (
    <div role="img" aria-label={`${label}, oldest week first: ${values.join(', ')}`} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 84 }}>
      {values.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 2, height: '100%' }}>
          <span style={{ fontSize: T_XS, color: INK_SOFT, ...mono }}>{v}</span>
          <span style={{ width: '100%', height: `${Math.max(2, (v / max) * 56)}px`, background: INFO, borderRadius: 2, opacity: i === values.length - 1 ? 1 : 0.7 }} />
          <span style={{ fontSize: T_XS, color: MUTED }}>{i === values.length - 1 ? 'now' : `-${values.length - 1 - i}w`}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────

const GRID = 'minmax(150px,1.3fr) 90px 90px 90px 130px 110px';

function Scoreboard({ games, openId, onToggle, onDeepDive }: {
  games: GameStat[]; openId: string | null; onToggle: (id: string) => void; onDeepDive: () => void;
}) {
  const head: React.CSSProperties = { fontSize: T_XS, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED };
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: R_LG, background: SURFACE, boxShadow: SHADOW_SM }}>
      <div style={{ minWidth: 720 }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '8px 14px 8px 36px', borderBottom: `1px solid ${BORDER_FIELD}` }}>
          <span style={head}>Game</span>
          <span style={{ ...head, textAlign: 'right' }}>Plays</span>
          <span style={{ ...head, textAlign: 'right' }}>Players</span>
          <span style={{ ...head, textAlign: 'right' }}>Per player</span>
          <span style={head}>Trend (7 weeks)</span>
          <span style={head}>Data</span>
        </div>
        {games.map(g => {
          const open = openId === g.id;
          return (
            <div key={g.id} style={{ borderTop: `1px solid ${BORDER}`, background: open ? SURFACE_ALT : SURFACE }}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`game-detail-${g.id}`}
                onClick={() => onToggle(g.id)}
                className="games-row"
                style={{
                  display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center', width: '100%', minHeight: 56,
                  padding: '10px 14px 10px 10px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: INK_SOFT,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChevronRight size={16} aria-hidden style={{ color: MUTED, flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .16s' }} />
                  <span style={{ fontFamily: 'var(--font-heading), Georgia, serif', fontSize: T_LG, fontWeight: 600 }}>{g.label}</span>
                </span>
                <span style={{ textAlign: 'right', fontSize: T_MD, ...mono }}>{g.quality === 'none' ? '–' : fmt(g.plays)}</span>
                <span style={{ textAlign: 'right', fontSize: T_MD, ...mono }}>{g.quality === 'none' ? '–' : fmt(g.players)}</span>
                <span style={{ textAlign: 'right', fontSize: T_MD, ...mono }}>{g.perPlayer ?? '–'}</span>
                <span>{g.quality === 'none' ? <span style={{ fontSize: T_SM, color: MUTED }}>no data</span> : <Spark values={g.weekly} label={`${g.label} weekly plays`} />}</span>
                <span><Stamp q={g.quality} /></span>
              </button>
              {open && (
                <div id={`game-detail-${g.id}`} style={{ padding: '4px 14px 16px 36px', display: 'flex', flexWrap: 'wrap', gap: '8px 24px', alignItems: 'center', fontSize: T_SM, color: MUTED }}>
                  {g.quality === 'none' ? (
                    <span>This game does not write a play record yet, so there is nothing to count.</span>
                  ) : (
                    <>
                      <span>{g.finishRate !== null ? <>Finished: <b style={{ color: INK_SOFT, ...mono }}>{g.finishRate}%</b></> : 'Finish rate: not recorded'}</span>
                      <span>Played on 2+ days: <b style={{ color: INK_SOFT, ...mono }}>{g.repeatPlayers !== null ? `${g.repeatPlayers}%` : '–'}</b> of players</span>
                      <span>Busiest day: <b style={{ color: INK_SOFT }}>{g.busiestDay ?? '–'}</b></span>
                    </>
                  )}
                  <span style={{ flexBasis: '100%' }}>Source: {g.source}</span>
                  {g.id === 'last-word' && (
                    <button type="button" onClick={onDeepDive} className="lms-btn lms-btn-ghost" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 36, padding: '6px 12px', border: `1px solid ${BORDER_FIELD}`, borderRadius: R_SM, background: SURFACE, color: INK_SOFT, fontSize: T_BASE, cursor: 'pointer' }}>
                      Open deep dive <ChevronRight size={14} aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Last Word deep dive ──────────────────────────────────────────────────────

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--font-heading), Georgia, serif', fontSize: T_2XL, fontWeight: 600, color: INK_SOFT, lineHeight: 1.1, ...mono }}>{value}</div>
      <div style={{ fontSize: T_SM, color: MUTED }}>{label}</div>
      {note && <div style={{ fontSize: T_XS, color: MUTED }}>{note}</div>}
    </div>
  );
}

function LastWordDeepDive({ lw, period }: { lw: GamesData['lastWord']; period: GamePeriod }) {
  const s = lw.summary;
  const maxSessions = Math.max(1, ...lw.sets.map(x => x.sessions));
  const m = lw.mastery;
  const empty = s.sessions === 0;
  return (
    <section id="last-word-deep-dive" aria-labelledby="lw-title" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, boxShadow: SHADOW_SM, padding: '16px 20px', scrollMarginTop: 16 }}>
      <h2 id="lw-title" style={{ margin: 0, fontSize: T_LG, fontWeight: 600, color: INK_SOFT }}>Last Word, in numbers</h2>
      <p style={{ margin: '2px 0 14px', fontSize: T_SM, color: MUTED }}>Usage only, last {period} days unless marked. Content review is not part of this page.</p>

      {!lw.available && <p role="alert" style={{ color: RED_DARK, fontSize: T_BASE }}>Could not read the Last Word tables just now.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 16 }}>
        <Stat value={fmt(s.sessions)} label="Sessions" />
        <Stat value={fmt(s.decisions)} label="Decisions made" />
        <Stat value={s.bestRate !== null ? `${s.bestRate}%` : '–'} label="Best answer chosen" />
        <Stat value={fmt(s.players)} label="Players" />
        <Stat value={s.decisionsPerSession !== null ? String(s.decisionsPerSession) : '–'} label="Decisions per session" />
        <Stat value="n/a" label="Finish rate" note="Not recorded: sessions save after every round" />
      </div>

      {empty ? (
        <p style={{ margin: '20px 0 0', padding: 16, background: SURFACE_ALT, borderRadius: R_SM, color: MUTED, fontSize: T_BASE }}>No Last Word sessions in this period.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 28, marginTop: 24 }}>
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: T_MD, fontWeight: 600, color: INK_SOFT }}>Plays by set</h3>
            {lw.sets.length === 0 && <p style={{ color: MUTED, fontSize: T_SM }}>No decisions in this period.</p>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {lw.sets.map(x => (
                <li key={x.setId}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,150px) 1fr 44px', gap: 10, alignItems: 'center', fontSize: T_SM, color: INK_SOFT }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.setId}>{x.setId}</span>
                    <span style={{ height: 12, background: SURFACE_ALT, borderRadius: 3, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${(x.sessions / maxSessions) * 100}%`, background: x.low ? RED : INFO, borderRadius: 3 }} />
                    </span>
                    <span style={{ textAlign: 'right', ...mono }}>{fmt(x.sessions)}</span>
                  </div>
                  <div style={{ marginLeft: 'calc(min(150px, 30%) + 10px)', fontSize: T_XS, color: x.low ? RED_DARK : MUTED }}>
                    {x.bestRate}% best answer{x.low ? ' · under 60%' : ''} · {fmt(x.decisions)} decisions
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: T_MD, fontWeight: 600, color: INK_SOFT }}>Player progress (all time)</h3>
            {m.total === 0 ? (
              <p style={{ color: MUTED, fontSize: T_SM }}>No mastery records yet.</p>
            ) : (
              <>
                <div role="img" aria-label={`Player-edge records: ${m.pct.mastered}% mastered, ${m.pct.learning}% learning, ${m.pct.notStarted}% not started`} style={{ display: 'flex', height: 24, borderRadius: R_SM, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                  {([
                    ['mastered', m.pct.mastered, INFO, SURFACE],
                    ['learning', m.pct.learning, `${INFO}80`, INK_SOFT],
                    ['not started', m.pct.notStarted, INFO_BG, INK_SOFT],
                  ] as const).map(([name, p, bg, fg]) => (
                    <span key={name} style={{ width: `${p}%`, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: T_XS, overflow: 'hidden', ...mono }}>{p >= 8 ? `${p}%` : ''}</span>
                  ))}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: T_SM, color: MUTED }}>
                  Mastered or fluent {m.pct.mastered}% · learning {m.pct.learning}% · not started {m.pct.notStarted}% of {fmt(m.total)} player-distinction records.
                </p>
              </>
            )}

            <h3 style={{ margin: '20px 0 8px', fontSize: T_MD, fontWeight: 600, color: INK_SOFT }}>Sessions per week</h3>
            <WeekBars values={lw.sessionsPerWeek} label="Last Word sessions per week" />
            <p style={{ margin: '12px 0 0', fontSize: T_BASE, color: MUTED }}>
              Reviews due now: <b style={{ color: INK_SOFT, ...mono }}>{fmt(lw.reviewsDue.count)}</b> across <b style={{ color: INK_SOFT, ...mono }}>{fmt(lw.reviewsDue.players)}</b> players.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function GamesPanel({ data, onPeriodChange }: Props) {
  const { data: session } = useSession();
  const [openId, setOpenId] = useState<string | null>(null);
  const canSeeSettings = isAdminRole(session?.user?.role);
  const noteQuality = data.games.some(g => g.quality === 'estimated') ? 'Estimated rows come from the feature tracker and can miss plays.' : '';

  function openDeepDive() {
    const el = document.getElementById('last-word-deep-dive');
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{SPIN_CSS}</style>
      <style>{`
        .games-row:hover { background: ${SURFACE_ALT} !important; }
        .games-row:focus-visible, .games-period:focus-visible { outline: 2px solid ${RED}; outline-offset: -2px; }
        @media (prefers-reduced-motion: reduce) { .games-row svg { transition: none !important; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div role="group" aria-label="Period" style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button
              key={p}
              type="button"
              className="games-period"
              aria-pressed={data.period === p}
              onClick={() => onPeriodChange(p)}
              style={{
                minHeight: 44, padding: '6px 14px', borderRadius: R_SM, fontSize: T_BASE, cursor: 'pointer',
                border: `1px solid ${data.period === p ? RED : BORDER_FIELD}`,
                background: data.period === p ? SURFACE : 'transparent',
                color: data.period === p ? RED_DARK : MUTED, fontWeight: data.period === p ? 600 : 400,
              }}
            >
              Last {p} days
            </button>
          ))}
        </div>
        <span style={{ fontSize: T_SM, color: MUTED }}>
          Plays count sessions started, not page views. Players are distinct people. {noteQuality}
        </span>
      </div>

      <Scoreboard
        games={data.games}
        openId={openId}
        onToggle={id => setOpenId(cur => (cur === id ? null : id))}
        onDeepDive={openDeepDive}
      />

      <LastWordDeepDive lw={data.lastWord} period={data.period} />

      {canSeeSettings && <LexicoreSettingsCard />}
    </div>
  );
}
