'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Flame,
  Award,
  Users,
  BookOpen,
  TrendingUp,
  Package,
  Hash,
  Activity,
  MessageSquare,
} from 'lucide-react';
import type { UserAdminRow, AdminGlobalStats, UserMastery } from './page';

// ─── Local types ──────────────────────────────────────────────────────────────

type SortKey =
  | 'name'
  | 'joinedAt'
  | 'totalPoints'
  | 'streakDays'
  | 'mastery'
  | 'passRate'
  | 'lastStudy'
  | 'badges';
type SortDir      = 'asc' | 'desc';
type FilterRole   = 'all' | 'student' | 'admin' | 'super_admin';
type FilterVocab  = 'all' | 'active' | 'inactive';
type FilterProduct = 'all' | 'iba' | 'fbs' | 'fbs_detailed' | 'none';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit',
  });
}

// ─── Stat card ────────────────────────────────────────────────────────────────

const ACCENT_STYLES = {
  crimson: { text: '#c62a2f', bg: 'rgba(198,42,47,0.08)',  border: 'rgba(198,42,47,0.18)' },
  gold:    { text: '#c9a84c', bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.18)' },
  blue:    { text: '#4a9eff', bg: 'rgba(74,158,255,0.08)', border: 'rgba(74,158,255,0.18)' },
  green:   { text: '#4caf7d', bg: 'rgba(76,175,125,0.08)', border: 'rgba(76,175,125,0.18)' },
  purple:  { text: '#9b6dff', bg: 'rgba(155,109,255,0.08)',border: 'rgba(155,109,255,0.18)' },
} as const;
type Accent = keyof typeof ACCENT_STYLES;

function StatCard({
  icon: Icon, label, value, sub, accent = 'crimson',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: Accent;
}) {
  const s = ACCENT_STYLES[accent];
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color: s.text }} />
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {label}
        </span>
      </div>
      <div
        className="text-2xl font-bold"
        style={{ fontFamily: "'Cormorant Garamond', serif", color: s.text }}
      >
        {value}
      </div>
      {sub && <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{sub}</div>}
    </div>
  );
}

// ─── Mastery bar ──────────────────────────────────────────────────────────────

const MASTERY_COLORS: Record<keyof Omit<UserMastery, 'total'>, string> = {
  mastered: '#22c55e',
  strong:   '#3b82f6',
  familiar: '#eab308',
  learning: '#f97316',
  new:      '#374151',
};

function MasteryBar({ mastery }: { mastery: UserMastery }) {
  if (mastery.total === 0) {
    return <span className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>;
  }
  const segments = (
    ['mastered', 'strong', 'familiar', 'learning', 'new'] as (keyof Omit<UserMastery, 'total'>)[]
  ).filter(k => mastery[k] > 0);

  return (
    <div className="flex flex-col gap-1 w-full min-w-[90px]">
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {segments.map(k => (
          <div
            key={k}
            style={{
              width: `${(mastery[k] / mastery.total) * 100}%`,
              backgroundColor: MASTERY_COLORS[k],
            }}
            title={`${k}: ${mastery[k]}`}
          />
        ))}
      </div>
      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
        {mastery.mastered}/{mastery.total}
      </div>
    </div>
  );
}

// ─── Small badges ─────────────────────────────────────────────────────────────

function ProductBadge({ product }: { product: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    iba:          { bg: 'rgba(201,168,76,0.12)', color: '#c9a84c', border: 'rgba(201,168,76,0.28)' },
    fbs:          { bg: 'rgba(74,158,255,0.12)', color: '#4a9eff', border: 'rgba(74,158,255,0.28)' },
    fbs_detailed: { bg: 'rgba(155,109,255,0.12)', color: '#9b6dff', border: 'rgba(155,109,255,0.28)' },
  };
  const s = map[product] ?? { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.12)' };
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {product}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    super_admin: { bg: 'rgba(198,42,47,0.15)', color: '#c62a2f', border: 'rgba(198,42,47,0.35)' },
    admin:       { bg: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: 'rgba(201,168,76,0.35)' },
    student:     { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.1)' },
  };
  const s = map[role] ?? map.student;
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {role}
    </span>
  );
}

function WtpLabel({ choice }: { choice: string | null }) {
  if (!choice) return <span style={{ color: 'rgba(255,255,255,0.18)' }} className="text-xs">—</span>;
  const map: Record<string, { label: string; color: string }> = {
    tutor:    { label: 'Tutor',    color: '#4caf7d' },
    printing: { label: 'Print',    color: '#c9a84c' },
    notebook: { label: 'Notebook', color: '#4a9eff' },
    nothing:  { label: 'Nothing',  color: 'rgba(255,255,255,0.3)' },
  };
  const { label, color } = map[choice] ?? { label: choice, color: 'rgba(255,255,255,0.4)' };
  return <span className="text-xs font-medium" style={{ color }}>{label}</span>;
}

// ─── Expanded row detail ──────────────────────────────────────────────────────

function ExpandedRow({ row }: { row: UserAdminRow }) {
  const masteryLevels = (
    ['mastered', 'strong', 'familiar', 'learning', 'new'] as (keyof Omit<UserMastery, 'total'>)[]
  );

  return (
    <div
      className="px-6 pb-5 pt-3 grid grid-cols-2 md:grid-cols-4 gap-5 text-xs"
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.015)' }}
    >
      {/* Word mastery */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
          Word Mastery
        </div>
        {masteryLevels.map(lvl => (
          <div key={lvl} className="flex items-center justify-between">
            <span className="capitalize" style={{ color: MASTERY_COLORS[lvl] }}>{lvl}</span>
            <span className="tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {row.mastery[lvl]}
            </span>
          </div>
        ))}
        <div
          className="flex items-center justify-between pt-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.28)' }}>Total</span>
          <span className="tabular-nums" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {row.mastery.total}
          </span>
        </div>
      </div>

      {/* Quiz stats */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
          Quiz Stats
        </div>
        {([
          ['Sessions',   String(row.quiz.totalSessions)],
          ['Completed',  String(row.quiz.completedSessions)],
          ['Correct',    `${row.quiz.totalCorrect}/${row.quiz.totalQuestions}`],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span style={{ color: 'rgba(255,255,255,0.28)' }}>{k}</span>
            <span className="tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>{v}</span>
          </div>
        ))}
        <div className="flex justify-between">
          <span style={{ color: 'rgba(255,255,255,0.28)' }}>Pass Rate</span>
          <span
            className="tabular-nums font-medium"
            style={{
              color: row.quiz.passRate >= 70 ? '#4caf7d'
                   : row.quiz.passRate >= 50 ? '#c9a84c'
                   : row.quiz.totalSessions === 0 ? 'rgba(255,255,255,0.25)'
                   : '#c62a2f',
            }}
          >
            {row.quiz.totalSessions === 0 ? '—' : `${row.quiz.passRate}%`}
          </span>
        </div>
      </div>

      {/* Vocab progress */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
          Progress
        </div>
        {([
          ['Phase',          String(row.phase)],
          ['Total Pts',      row.totalPoints.toLocaleString()],
          ['Weekly Pts',     String(row.weeklyPoints)],
          ['Daily Target',   String(row.dailyTarget)],
          ['Longest Streak', `${row.longestStreak}d`],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span style={{ color: 'rgba(255,255,255,0.28)' }}>{k}</span>
            <span className="tabular-nums" style={{ color: k === 'Total Pts' ? '#c9a84c' : 'rgba(255,255,255,0.55)' }}>
              {v}
            </span>
          </div>
        ))}
      </div>

      {/* Metadata */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
          Metadata
        </div>
        {([
          ['Joined',    fmtDate(row.joinedAt)],
          ['Deadline',  fmtDate(row.deadline)],
          ['Badges',    `${row.badgesEarned}/${row.badgesTotal}`],
          ['Onboarded', row.onboardingDone ? 'Yes' : 'No'],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span style={{ color: 'rgba(255,255,255,0.28)' }}>{k}</span>
            <span
              className="tabular-nums"
              style={{
                color: k === 'Onboarded'
                  ? (row.onboardingDone ? '#4caf7d' : 'rgba(255,255,255,0.28)')
                  : 'rgba(255,255,255,0.55)',
              }}
            >
              {v}
            </span>
          </div>
        ))}
        {row.wtpChoice && (
          <div className="flex justify-between">
            <span style={{ color: 'rgba(255,255,255,0.28)' }}>WTP</span>
            <WtpLabel choice={row.wtpChoice} />
          </div>
        )}
        {row.wtpAt && (
          <div className="flex justify-between">
            <span style={{ color: 'rgba(255,255,255,0.28)' }}>WTP At</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{fmtDate(row.wtpAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AdminLexiStatsProps {
  rows:        UserAdminRow[];
  globalStats: AdminGlobalStats;
}

export default function AdminLexiStats({ rows, globalStats }: AdminLexiStatsProps) {
  const [search,        setSearch]        = useState('');
  const [filterRole,    setFilterRole]    = useState<FilterRole>('all');
  const [filterVocab,   setFilterVocab]   = useState<FilterVocab>('all');
  const [filterProduct, setFilterProduct] = useState<FilterProduct>('all');
  const [sortKey,       setSortKey]       = useState<SortKey>('joinedAt');
  const [sortDir,       setSortDir]       = useState<SortDir>('desc');
  const [expandedId,    setExpandedId]    = useState<number | null>(null);
  const [showFilters,   setShowFilters]   = useState(false);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return key;
      }
      setSortDir('desc');
      return key;
    });
  }, []);

  const filtered = useMemo(() => {
    let r = rows;

    if (search) {
      const q = search.toLowerCase();
      r = r.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (filterRole !== 'all')         r = r.filter(u => u.role === filterRole);
    if (filterVocab === 'active')     r = r.filter(u => u.hasVocab);
    if (filterVocab === 'inactive')   r = r.filter(u => !u.hasVocab);
    if (filterProduct === 'none')     r = r.filter(u => u.products.length === 0);
    else if (filterProduct !== 'all') r = r.filter(u => u.products.includes(filterProduct));

    return [...r].sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'name':
          diff = a.name.localeCompare(b.name);
          return sortDir === 'asc' ? diff : -diff;
        case 'joinedAt':
          diff = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
          break;
        case 'totalPoints':
          diff = a.totalPoints - b.totalPoints;
          break;
        case 'streakDays':
          diff = a.streakDays - b.streakDays;
          break;
        case 'mastery':
          diff = a.mastery.mastered - b.mastery.mastered;
          break;
        case 'passRate':
          diff = a.quiz.passRate - b.quiz.passRate;
          break;
        case 'badges':
          diff = a.badgesEarned - b.badgesEarned;
          break;
        case 'lastStudy':
          diff = (a.lastStudyDate ? new Date(a.lastStudyDate).getTime() : 0)
               - (b.lastStudyDate ? new Date(b.lastStudyDate).getTime() : 0);
          break;
      }
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [rows, search, filterRole, filterVocab, filterProduct, sortKey, sortDir]);

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className="flex items-center gap-0.5 transition-colors"
        style={{ color: active ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)' }}
      >
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
        {active
          ? sortDir === 'asc'
            ? <ChevronUp size={10} />
            : <ChevronDown size={10} />
          : <div style={{ width: 10 }} />
        }
      </button>
    );
  }

  const STAT_CARDS = [
    { icon: Users,          label: 'Total Users',   value: globalStats.totalUsers,      accent: 'crimson' as Accent },
    { icon: BookOpen,       label: 'Vocab Users',   value: globalStats.vocabUsers,       accent: 'blue'    as Accent },
    { icon: Activity,       label: 'Active Today',  value: globalStats.activeToday,      accent: 'green'   as Accent, sub: 'last 24h' },
    { icon: TrendingUp,     label: 'This Week',     value: globalStats.activeThisWeek,   accent: 'green'   as Accent, sub: 'last 7d' },
    { icon: Flame,          label: 'On Streak',     value: globalStats.usersWithStreak,  accent: 'crimson' as Accent },
    { icon: Package,        label: 'Paid Users',    value: globalStats.paidUsers,        accent: 'gold'    as Accent },
    { icon: Award,          label: 'Badge Defs',    value: globalStats.totalBadgeDefs,   accent: 'purple'  as Accent },
    { icon: Hash,           label: 'Total Words',   value: globalStats.totalWords,       accent: 'blue'    as Accent },
    { icon: MessageSquare,  label: 'WTP Responses', value: globalStats.wtpResponses,     accent: 'gold'    as Accent },
  ];

  const FILTER_PILLS = {
    role: (
      <div className="flex gap-1 flex-wrap">
        {(['all', 'student', 'admin', 'super_admin'] as FilterRole[]).map(r => (
          <button
            key={r}
            onClick={() => setFilterRole(r)}
            className="text-[11px] px-2.5 py-1 rounded transition-colors"
            style={filterRole === r
              ? { background: 'rgba(198,42,47,0.15)', color: '#c62a2f', border: '1px solid rgba(198,42,47,0.4)' }
              : { background: 'transparent', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            {r === 'all' ? 'All roles' : r}
          </button>
        ))}
      </div>
    ),
    vocab: (
      <div className="flex gap-1 flex-wrap">
        {(['all', 'active', 'inactive'] as FilterVocab[]).map(v => (
          <button
            key={v}
            onClick={() => setFilterVocab(v)}
            className="text-[11px] px-2.5 py-1 rounded transition-colors"
            style={filterVocab === v
              ? { background: 'rgba(74,158,255,0.15)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.4)' }
              : { background: 'transparent', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            {v === 'all' ? 'All vocab' : v === 'active' ? 'Has vocab' : 'No vocab'}
          </button>
        ))}
      </div>
    ),
    product: (
      <div className="flex gap-1 flex-wrap">
        {(['all', 'iba', 'fbs', 'fbs_detailed', 'none'] as FilterProduct[]).map(p => (
          <button
            key={p}
            onClick={() => setFilterProduct(p)}
            className="text-[11px] px-2.5 py-1 rounded transition-colors"
            style={filterProduct === p
              ? { background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.4)' }
              : { background: 'transparent', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            {p === 'all' ? 'All products' : p === 'none' ? 'Free only' : p}
          </button>
        ))}
      </div>
    ),
  };

  return (
    <div className="min-h-screen" style={{ background: '#080808', color: '#fff', fontFamily: 'Sora, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="px-6 py-5 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Command Center
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            LexiCore · {rows.length} users · restricted access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#4caf7d' }}
          />
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
            ahnaf816@gmail.com
          </span>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6" style={{ maxWidth: 1440, margin: '0 auto' }}>

        {/* ── Global stats ── */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {STAT_CARDS.map(c => (
            <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} accent={c.accent} sub={c.sub} />
          ))}
        </div>

        {/* ── Search + filters ── */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'rgba(255,255,255,0.28)' }}
              />
              <input
                type="text"
                placeholder="Search name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg focus:outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(198,42,47,0.45)'; }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
            </div>
            <button
              onClick={() => setShowFilters(f => !f)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={showFilters
                ? { background: 'rgba(198,42,47,0.1)', border: '1px solid rgba(198,42,47,0.4)', color: '#c62a2f' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              <Filter size={13} />
              Filters
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 38 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-3 pb-1 pt-1">
                  {FILTER_PILLS.role}
                  {FILTER_PILLS.vocab}
                  {FILTER_PILLS.product}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Showing {filtered.length} of {rows.length} users
          </div>
        </div>

        {/* ── Table ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Header row */}
          <div
            className="grid items-center gap-3 px-4 py-3"
            style={{
              gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr 1fr 1fr 1fr auto',
              background: 'rgba(255,255,255,0.03)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <SortBtn k="name"        label="User" />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Role / Products
            </span>
            <SortBtn k="totalPoints" label="Points" />
            <SortBtn k="streakDays"  label="Streak" />
            <SortBtn k="mastery"     label="Mastery" />
            <SortBtn k="passRate"    label="Quiz" />
            <SortBtn k="badges"      label="Badges" />
            <SortBtn k="lastStudy"   label="Last Active" />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.28)' }}>
              WTP
            </span>
          </div>

          {/* Body */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
              No users match the current filters.
            </div>
          ) : (
            <div>
              {filtered.map((u, i) => {
                const isExpanded = expandedId === u.id;
                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.012, 0.25) }}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      opacity: u.hasVocab ? 1 : 0.45,
                    }}
                    className="last:border-b-0"
                  >
                    {/* Main row */}
                    <div
                      className="grid items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                      style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr 1fr 1fr 1fr auto' }}
                      onClick={() => setExpandedId(isExpanded ? null : u.id)}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* User */}
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">{u.name}</span>
                        <span className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {u.email}
                        </span>
                      </div>

                      {/* Role / Products */}
                      <div className="flex flex-col gap-1">
                        <RoleBadge role={u.role} />
                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                          {u.products.length === 0
                            ? <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>free</span>
                            : u.products.map(p => <ProductBadge key={p} product={p} />)
                          }
                        </div>
                      </div>

                      {/* Points */}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium tabular-nums" style={{ color: '#c9a84c' }}>
                          {u.totalPoints.toLocaleString()}
                        </span>
                        {u.weeklyPoints > 0 && (
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                            +{u.weeklyPoints} wk
                          </span>
                        )}
                      </div>

                      {/* Streak */}
                      <div className="flex items-center gap-1">
                        {u.streakDays > 0 && <Flame size={12} style={{ color: '#c62a2f', flexShrink: 0 }} />}
                        <span
                          className="text-sm tabular-nums"
                          style={{ color: u.streakDays > 0 ? '#c62a2f' : 'rgba(255,255,255,0.18)' }}
                        >
                          {u.streakDays > 0 ? `${u.streakDays}d` : '—'}
                        </span>
                      </div>

                      {/* Mastery */}
                      <MasteryBar mastery={u.mastery} />

                      {/* Quiz */}
                      <div
                        className="text-sm font-medium tabular-nums"
                        style={{
                          color: u.quiz.totalSessions === 0
                            ? 'rgba(255,255,255,0.18)'
                            : u.quiz.passRate >= 70 ? '#4caf7d'
                            : u.quiz.passRate >= 50 ? '#c9a84c'
                            : '#c62a2f',
                        }}
                      >
                        {u.quiz.totalSessions === 0 ? '—' : `${u.quiz.passRate}%`}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1">
                        {u.badgesEarned > 0 && <Award size={12} style={{ color: '#9b6dff', flexShrink: 0 }} />}
                        <span
                          className="text-sm tabular-nums"
                          style={{ color: u.badgesEarned > 0 ? '#9b6dff' : 'rgba(255,255,255,0.18)' }}
                        >
                          {u.badgesEarned > 0 ? `${u.badgesEarned}/${u.badgesTotal}` : '0'}
                        </span>
                      </div>

                      {/* Last active */}
                      <div className="text-[11px] whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {timeAgo(u.lastStudyDate)}
                      </div>

                      {/* WTP + expand chevron */}
                      <div className="flex items-center gap-1.5">
                        <WtpLabel choice={u.wtpChoice} />
                        <ChevronRight
                          size={13}
                          style={{
                            color: 'rgba(255,255,255,0.2)',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: 'spring' as const, stiffness: 380, damping: 40 }}
                          className="overflow-hidden"
                        >
                          <ExpandedRow row={u} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
