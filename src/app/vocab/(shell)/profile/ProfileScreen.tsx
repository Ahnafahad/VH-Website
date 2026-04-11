'use client';

/**
 * ProfileScreen — T30 + T31
 *
 * Two-tab layout: Profile | Settings
 * Tab indicator: Framer Motion layoutId="settings-tab-indicator", spring 400/30
 * URL-driven: initialTab prop from searchParams.tab
 *
 * Profile tab (T30):
 *   1. Header        — hexagonal initials seal + inline name edit
 *   2. Stats         — horizontal ledger strips (3 items, no cards)
 *   3. Word Progress — codex bar + sharp level pills
 *   4. Distinctions  — museum specimen badge grid + detail bottom sheet
 *   5. Lexicon       — virtualized word list (search + filter)
 *
 * Settings tab (T31):
 *   1. Study Deadline  — serif date display + bottom sheet date picker
 *   2. Appearance      — dark/light theme toggle with sun/moon morph
 *   3. Notifications   — push permission toggle
 *   4. Email Summary   — weekly summary toggle
 *   5. Danger Zone     — sign out with confirm bottom sheet
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useVirtualizer }  from '@tanstack/react-virtual';
import { useRouter }       from 'next/navigation';
import { signOut }         from 'next-auth/react';
import {
  Pencil, Check, X as XIcon, Search, LogOut,
  Star, Flame, Shield, Target, BookOpen, Crosshair, Zap, Layers,
  TrendingUp, Calendar, RefreshCw, Compass, Database, Brain,
  Trophy, Award, CheckCircle2, Crown, Cpu, Sparkles,
  Infinity as InfinityIcon,
  Bell, BellOff, Mail, MailOpen, Sun, Moon, CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import AnimatedNumber from '@/components/vocab/AnimatedNumber';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { ProfileData, BadgeRow, WordRow } from './page';

// ─── Badge icons ──────────────────────────────────────────────────────────────

const BADGE_ICONS: Record<string, LucideIcon> = {
  first_step:          Star,     quiz_starter:        BookOpen,
  on_a_roll:           Flame,    perfectionist:       Target,
  week_warrior:        Shield,   sharp_shooter:       Crosshair,
  unit_slayer:         Zap,      analogy_apprentice:  Layers,
  halfway_there:       TrendingUp, streak_keeper:     Calendar,
  review_regular:      RefreshCw, speed_demon:        Zap,
  leaderboard_climber: TrendingUp, vocab_explorer:    Compass,
  the_800_club:        Database,  analogy_master:     Brain,
  unit_conqueror:      Trophy,    review_legend:      Award,
  completionist:       CheckCircle2, leaderboard_legend: Crown,
  question_machine:    Cpu,       flawless_run:       Sparkles,
  word_sovereign:      Crown,     immortal:           InfinityIcon,
};

// ─── Colour helpers ───────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  new:      '#64748b',
  learning: '#f97316',
  familiar: '#eab308',
  strong:   '#3b82f6',
  mastered: '#22c55e',
};

const CATEGORY_ACCENT: Record<string, string> = {
  short_term: '#E63946',
  mid_term:   '#E63946',
  long_term:  '#F4A828',
  ultimate:   '#F4A828',
};

function badgeAccent(category: BadgeRow['category']): string {
  return CATEGORY_ACCENT[category] ?? '#E63946';
}

// ─── Animation variants ───────────────────────────────────────────────────────

const pageStagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const sectionFade: Variants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

const sheetV: Variants = {
  hidden: { y: '100%' },
  show:   { y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 40, mass: 1 } },
  exit:   { y: '100%', transition: { type: 'spring' as const, stiffness: 380, damping: 42 } },
};

const settingStagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
};

const settingItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function fmtEarned(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** Returns the number of days between today and a target ISO date. */
function daysUntil(iso: string): number {
  const now     = new Date();
  now.setHours(0, 0, 0, 0);
  const target  = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Hexagonal SVG clip-path avatar with rotating accent ring */
function HexAvatar({ initials: init }: { initials: string }) {
  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      {/* Rotating ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        style={{
          position:     'absolute',
          inset:        -3,
          background:   'conic-gradient(from 0deg, #E63946, #F4A828 50%, transparent 55%, transparent 65%, #E6394660, #E63946)',
          clipPath:     'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
        }}
      />
      {/* Inner hex */}
      <div
        style={{
          position:       'absolute',
          inset:          3,
          background:     '#E63946',
          clipPath:       'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        <span style={{
          fontFamily: "'Sora', sans-serif",
          fontSize:   22,
          fontWeight: 700,
          color:      '#ffffff',
          letterSpacing: '-0.02em',
        }}>
          {init}
        </span>
      </div>
    </div>
  );
}

/** Separator — used between sections */
function Rule() {
  return (
    <div style={{
      height:     1,
      background: 'rgba(255,255,255,0.05)',
      margin:     '2px 0',
    }} />
  );
}

/** Gold decorative rule for settings sections */
function GoldRule() {
  return (
    <div style={{
      height:     1,
      background: 'linear-gradient(90deg, transparent, rgba(244,168,40,0.18), transparent)',
      margin:     '0',
    }} />
  );
}

// ─── Settings toggle ──────────────────────────────────────────────────────────

interface ToggleProps {
  on:       boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accent?:  string;
}

function LuxToggle({ on, onChange, disabled, accent = '#E63946' }: ToggleProps) {
  return (
    <motion.button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      whileTap={{ scale: 0.94 }}
      style={{
        position:      'relative',
        width:         46,
        height:        26,
        borderRadius:  13,
        background:    on ? `${accent}33` : 'rgba(255,255,255,0.07)',
        border:        on ? `1.5px solid ${accent}66` : '1.5px solid rgba(255,255,255,0.12)',
        cursor:        disabled ? 'not-allowed' : 'pointer',
        flexShrink:    0,
        outline:       'none',
        padding:       0,
        opacity:       disabled ? 0.45 : 1,
        transition:    'background 0.25s, border-color 0.25s',
      }}
    >
      <motion.div
        layout
        transition={{ type: 'spring' as const, stiffness: 420, damping: 32 }}
        style={{
          position:     'absolute',
          top:          3,
          left:         on ? 22 : 3,
          width:        18,
          height:       18,
          borderRadius: '50%',
          background:   on ? accent : 'rgba(255,255,255,0.4)',
          boxShadow:    on ? `0 0 8px ${accent}60` : 'none',
        }}
      />
    </motion.button>
  );
}

// ─── Settings section row ──────────────────────────────────────────────────────

function SettingRow({
  icon: Icon,
  label,
  sublabel,
  children,
  onTap,
  noPad,
}: {
  icon:      LucideIcon;
  label:     string;
  sublabel?: string;
  children?: React.ReactNode;
  onTap?:    () => void;
  noPad?:    boolean;
}) {
  return (
    <motion.div
      variants={settingItem}
      whileTap={onTap ? { scale: 0.98 } : undefined}
      onClick={onTap}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           14,
        padding:       noPad ? '14px 0' : '16px 0',
        cursor:        onTap ? 'pointer' : 'default',
        borderBottom:  '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div style={{
        width:          36,
        height:         36,
        flexShrink:     0,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(255,255,255,0.04)',
        borderRadius:   0,
        borderLeft:     '2px solid rgba(255,255,255,0.1)',
      }}>
        <Icon size={16} style={{ color: 'var(--color-lx-text-secondary)' }} strokeWidth={1.5} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Sora', sans-serif",
          fontSize:   13,
          fontWeight: 500,
          color:      '#F0EEE9',
          lineHeight: 1.3,
        }}>
          {label}
        </div>
        {sublabel && (
          <div style={{
            fontFamily: "'Sora', sans-serif",
            fontSize:   10,
            color:      'var(--color-lx-text-muted)',
            marginTop:  2,
            lineHeight: 1.4,
          }}>
            {sublabel}
          </div>
        )}
      </div>

      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileScreen({
  data,
  initialTab = 'profile',
}: {
  data:         ProfileData;
  initialTab?:  'profile' | 'settings';
}) {
  const router = useRouter();

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>(initialTab);

  const switchTab = useCallback((tab: 'profile' | 'settings') => {
    setActiveTab(tab);
    // Update URL without full navigation
    const url = tab === 'settings' ? '/vocab/profile?tab=settings' : '/vocab/profile';
    router.replace(url, { scroll: false });
  }, [router]);

  // ── Name edit state ──────────────────────────────────────────────────────────
  const [name,       setName]       = useState(data.name);
  const [editMode,   setEditMode]   = useState(false);
  const [editVal,    setEditVal]    = useState(data.name);
  const [editSaving, setEditSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editMode) nameInputRef.current?.focus();
  }, [editMode]);

  const startEdit  = () => { setEditVal(name); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); };

  const saveEdit = async () => {
    const trimmed = editVal.trim();
    if (!trimmed || trimmed === name) { cancelEdit(); return; }
    setEditSaving(true);
    try {
      const res = await fetch('/api/vocab/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: trimmed }),
      });
      if (res.ok) { setName(trimmed); setEditMode(false); }
    } finally {
      setEditSaving(false);
    }
  };

  // ── Badge sheet state ────────────────────────────────────────────────────────
  const [selectedBadge, setSelectedBadge] = useState<BadgeRow | null>(null);

  // ── Word list state ──────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const filteredWords = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.words.filter(w => {
      if (levelFilter !== 'all' && w.masteryLevel !== levelFilter) return false;
      if (q && !w.word.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.words, search, levelFilter]);

  const listRef     = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count:            filteredWords.length,
    getScrollElement: () => listRef.current,
    estimateSize:     () => 56,
    overscan:         6,
  });

  const masteredPct = data.levelStats.total > 0
    ? (data.levelStats.mastered / data.levelStats.total) * 100
    : 0;

  // ── Sign out ─────────────────────────────────────────────────────────────────
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  const FILTERS = ['all', 'new', 'learning', 'familiar', 'strong', 'mastered'] as const;

  // ─────────────────────────────────────────────────────────────────────────────
  // SETTINGS STATE
  // ─────────────────────────────────────────────────────────────────────────────

  // Deadline
  const [deadline,        setDeadline]       = useState<string | null>(data.deadline);
  const [dailyTarget,     setDailyTarget]    = useState<number>(data.dailyTarget);
  const [deadlineSheet,   setDeadlineSheet]  = useState(false);
  const [pickerDate,      setPickerDate]     = useState<string>(() => {
    if (data.deadline) {
      // yyyy-mm-dd format for <input type="date">
      return new Date(data.deadline).toISOString().split('T')[0]!;
    }
    // Default: 60 days from today
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().split('T')[0]!;
  });
  const [deadlineSaving, setDeadlineSaving] = useState(false);

  const saveDeadline = async () => {
    if (!pickerDate) return;
    setDeadlineSaving(true);
    try {
      const isoString = new Date(pickerDate + 'T00:00:00.000Z').toISOString();
      const res = await fetch('/api/vocab/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          deadline:               isoString,
          recalculateDailyTarget: true,
        }),
      });
      if (res.ok) {
        setDeadline(isoString);
        // Recalculate daily target client-side to animate
        const dLeft = Math.max(1, daysUntil(isoString));
        const remaining = Math.max(0, data.levelStats.total - data.levelStats.mastered);
        setDailyTarget(Math.max(1, Math.ceil(remaining / dLeft)));
        setDeadlineSheet(false);
      }
    } finally {
      setDeadlineSaving(false);
    }
  };

  const clearDeadline = async () => {
    setDeadlineSaving(true);
    try {
      const res = await fetch('/api/vocab/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deadline: null }),
      });
      if (res.ok) {
        setDeadline(null);
        setDailyTarget(data.dailyTarget);
        setDeadlineSheet(false);
      }
    } finally {
      setDeadlineSaving(false);
    }
  };

  // Appearance (theme)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('lx-theme');
    if (stored === 'light') return false;
    return true; // default dark
  });

  const toggleTheme = useCallback((dark: boolean) => {
    setIsDark(dark);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lx-theme', dark ? 'dark' : 'light');
      if (dark) {
        document.documentElement.classList.remove('lx-light');
      } else {
        document.documentElement.classList.add('lx-light');
      }
    }
  }, []);

  // Notifications — wired to usePushNotifications for real Web Push support
  const {
    isSupported:  notifSupported,
    isSubscribed: notificationsEnabled,
    permission:   notifPermission,
    isLoading:    notifLoading,
    subscribe:    subscribePush,
    unsubscribe:  unsubscribePush,
  } = usePushNotifications(data.notificationsEnabled);

  const toggleNotifications = useCallback(async (next: boolean) => {
    if (next) {
      await subscribePush();
    } else {
      await unsubscribePush();
    }
  }, [subscribePush, unsubscribePush]);

  // Email summary
  const [emailSummaryEnabled, setEmailSummaryEnabled] = useState(data.emailSummaryEnabled);

  const toggleEmail = useCallback(async (next: boolean) => {
    setEmailSummaryEnabled(next);
    await fetch('/api/vocab/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ emailSummaryEnabled: next }),
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ══ TAB BAR ══════════════════════════════════════════════════════════ */}
      <div style={{
        position:      'sticky',
        top:           0,
        zIndex:        30,
        background:    'rgba(15,15,15,0.96)',
        backdropFilter:'blur(12px)',
        borderBottom:  '1px solid rgba(255,255,255,0.06)',
        paddingTop:    8,
      }}>
        <div style={{
          display:    'flex',
          maxWidth:   760,
          margin:     '0 auto',
          padding:    '0 20px',
        }}>
          {(['profile', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              style={{
                position:      'relative',
                flex:          1,
                background:    'transparent',
                border:        'none',
                padding:       '10px 0 11px',
                cursor:        'pointer',
                outline:       'none',
              }}
            >
              <span style={{
                fontFamily:    "'Sora', sans-serif",
                fontSize:      11,
                fontWeight:    activeTab === tab ? 600 : 400,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         activeTab === tab ? '#D62B38' : 'var(--color-lx-text-muted)',
                transition:    'color 0.2s',
              }}>
                {tab}
              </span>

              {/* Animated underline */}
              {activeTab === tab && (
                <motion.div
                  layoutId="settings-tab-indicator"
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
                  style={{
                    position:  'absolute',
                    bottom:    0,
                    left:      '20%',
                    right:     '20%',
                    height:    2,
                    background:'#D62B38',
                    boxShadow: '0 0 8px #D62B3860',
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══ TAB CONTENT ══════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'profile' ? (
          /* ════════════════════════════════════════════════════════════════
             PROFILE TAB
             ════════════════════════════════════════════════════════════════ */
          <motion.div
            key="profile-tab"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ type: 'spring' as const, stiffness: 320, damping: 32 }}
          >
            <motion.div
              variants={pageStagger}
              initial="hidden"
              animate="show"
              style={{ padding: '32px 20px 24px', display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' }}
            >

              {/* ══ 1. HEADER ═══════════════════════════════════════════════ */}
              <motion.div variants={sectionFade} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 32 }}>
                <motion.div whileTap={{ scale: 0.96 }}>
                  <HexAvatar initials={initials(name)} />
                </motion.div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {editMode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          ref={nameInputRef}
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          style={{
                            fontFamily:   "'Cormorant Garamond', Georgia, serif",
                            fontSize:     26,
                            fontStyle:    'italic',
                            fontWeight:   600,
                            color:        '#F0EEE9',
                            background:   'transparent',
                            border:       'none',
                            borderBottom: '1.5px solid #E63946',
                            outline:      'none',
                            width:        '100%',
                            padding:      '0 0 2px',
                          }}
                        />
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ type: 'spring' as const, stiffness: 320, damping: 28 }}
                          style={{
                            position:        'absolute',
                            bottom:          0,
                            left:            0,
                            width:           '100%',
                            height:          1.5,
                            background:      '#E63946',
                            transformOrigin: 'left center',
                            pointerEvents:   'none',
                          }}
                        />
                      </div>
                      <button onClick={saveEdit} disabled={editSaving} aria-label="Save name"
                        style={{ ...iconBtn, color: '#22c55e' }}>
                        <Check size={15} />
                      </button>
                      <button onClick={cancelEdit} aria-label="Cancel" style={{ ...iconBtn, color: '#64748b' }}>
                        <XIcon size={15} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h1 style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize:   26,
                        fontStyle:  'italic',
                        fontWeight: 600,
                        color:      '#F0EEE9',
                        margin:     0,
                        lineHeight: 1.1,
                      }}>
                        {name}
                      </h1>
                      <button onClick={startEdit} aria-label="Edit name" style={{ ...iconBtn, color: 'var(--color-lx-text-muted)' }}>
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}

                  <p style={{
                    fontFamily:    "'Sora', sans-serif",
                    fontSize:      10,
                    fontWeight:    500,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color:         'var(--color-lx-text-muted)',
                    margin:        0,
                  }}>
                    · Member since {fmtDate(data.memberSince)}
                  </p>
                </div>
              </motion.div>

              {/* ══ 2. STATS — Ledger Strips ════════════════════════════════ */}
              <motion.div variants={sectionFade} style={{ marginBottom: 32 }}>
                <SectionLabel>Statistics</SectionLabel>
                <div style={{
                  display:      'flex',
                  borderTop:    '1px solid rgba(255,255,255,0.06)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {[
                    { label: 'Total Points', value: data.totalPoints,   suffix: '' },
                    { label: 'Streak',       value: data.streakDays,    suffix: 'd', flame: true },
                    { label: 'Best Streak',  value: data.longestStreak, suffix: 'd' },
                  ].map((stat, i) => (
                    <div
                      key={stat.label}
                      style={{
                        flex:         1,
                        padding:      '14px 12px',
                        borderRight:  i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        display:      'flex',
                        flexDirection:'column',
                        gap:          4,
                      }}
                    >
                      <span style={{
                        fontFamily:    "'Sora', sans-serif",
                        fontSize:      9,
                        fontWeight:    600,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color:         'var(--color-lx-text-muted)',
                      }}>
                        {stat.label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        {stat.flame && stat.value > 0 && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#F4A828" style={{ marginBottom: 2 }}>
                            <path d="M12 2C6 10 9 13 9 16c0 1.7 1.3 3 3 3s3-1.3 3-3c0-1.8-1.5-3.5-1.5-6.5 0 0 2 2 2 4.5 1.1-.8 2-2.3 2-4 0-3.5-3-6-5.5-8z"/>
                          </svg>
                        )}
                        <span style={{
                          fontFamily: "'Cormorant Garamond', Georgia, serif",
                          fontSize:   38,
                          fontWeight: 600,
                          lineHeight: 1,
                          color:      '#F0EEE9',
                        }}>
                          <AnimatedNumber value={stat.value} />
                        </span>
                        {stat.suffix && (
                          <span style={{
                            fontFamily: "'Sora', sans-serif",
                            fontSize:   12,
                            color:      'var(--color-lx-text-muted)',
                          }}>{stat.suffix}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ══ 3. WORD PROGRESS — The Codex Bar ════════════════════════ */}
              <motion.div variants={sectionFade} style={{ marginBottom: 32 }}>
                <SectionLabel>Word Progress</SectionLabel>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize:   46,
                    fontWeight: 600,
                    color:      '#E63946',
                    lineHeight: 1,
                  }}>
                    {data.levelStats.mastered.toLocaleString()}
                  </span>
                  <span style={{
                    fontFamily:   "'Sora', sans-serif",
                    fontSize:     13,
                    color:        'var(--color-lx-text-muted)',
                    marginBottom: 4,
                  }}>
                    / {data.levelStats.total.toLocaleString()} mastered
                  </span>
                </div>

                <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', marginBottom: 16 }}>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: masteredPct / 100 }}
                    transition={{ type: 'spring' as const, stiffness: 90, damping: 22, delay: 0.3 }}
                    style={{
                      height:          '100%',
                      background:      'linear-gradient(90deg, #E63946, #F4A828)',
                      transformOrigin: 'left center',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.entries({
                    new:      data.levelStats.new,
                    learning: data.levelStats.learning,
                    familiar: data.levelStats.familiar,
                    strong:   data.levelStats.strong,
                    mastered: data.levelStats.mastered,
                  }) as [string, number][]).map(([level, cnt]) => (
                    <div
                      key={level}
                      style={{
                        display:    'flex',
                        alignItems: 'center',
                        gap:        5,
                        padding:    '4px 8px 4px 6px',
                        background: 'rgba(255,255,255,0.04)',
                        borderLeft: `3px solid ${LEVEL_COLORS[level]}`,
                        borderRadius: 0,
                      }}
                    >
                      <span style={{
                        fontFamily:    "'Sora', sans-serif",
                        fontSize:      10,
                        textTransform: 'capitalize',
                        color:         'var(--color-lx-text-secondary)',
                      }}>
                        {level}
                      </span>
                      <span style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize:   14,
                        fontStyle:  'italic',
                        color:      '#F0EEE9',
                      }}>
                        {cnt}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ══ 4. DISTINCTIONS — Museum Specimen Badge Grid ════════════ */}
              <motion.div variants={sectionFade} style={{ marginBottom: 32 }}>
                <SectionLabel center>— Distinctions —</SectionLabel>

                <div style={{
                  display:             'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap:                 1,
                  background:          'rgba(255,255,255,0.05)',
                }}>
                  {data.badges.map((badge, i) => {
                    const Icon   = BADGE_ICONS[badge.id] ?? Star;
                    const accent = badgeAccent(badge.category);
                    return (
                      <motion.button
                        key={badge.id}
                        onClick={() => setSelectedBadge(badge)}
                        whileTap={{ scale: 0.94 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        initial={{ opacity: 0, y: 8 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.025 }}
                        aria-label={badge.name}
                        style={{
                          position:      'relative',
                          background:    'var(--color-lx-surface)',
                          border:        'none',
                          padding:       '12px 6px 10px',
                          cursor:        'pointer',
                          display:       'flex',
                          flexDirection: 'column',
                          alignItems:    'center',
                          gap:           6,
                          overflow:      'hidden',
                          ...(badge.earned ? { boxShadow: `inset 0 0 0 1px ${accent}55` } : {}),
                        }}
                      >
                        <div style={{
                          filter:  badge.earned ? 'none' : 'grayscale(1) brightness(0.35)',
                          opacity: badge.earned ? 1 : 0.9,
                        }}>
                          <Icon
                            size={24}
                            color={badge.earned ? accent : '#ffffff'}
                            strokeWidth={1.5}
                            style={badge.earned ? { filter: `drop-shadow(0 0 4px ${accent}80)` } : {}}
                          />
                        </div>
                        <span style={{
                          fontFamily:       "'Sora', sans-serif",
                          fontSize:         8,
                          lineHeight:       1.3,
                          textAlign:        'center',
                          color:            badge.earned ? 'var(--color-lx-text-secondary)' : 'var(--color-lx-text-muted)',
                          display:          '-webkit-box',
                          WebkitLineClamp:  2,
                          WebkitBoxOrient:  'vertical',
                          overflow:         'hidden',
                          maxWidth:         '100%',
                        }}>
                          {badge.name}
                        </span>

                        {!badge.earned && (
                          <div style={{
                            position: 'absolute',
                            bottom:   0, left: 0, right: 0,
                            height:   2,
                            background: 'rgba(255,255,255,0.06)',
                          }}>
                            {badge.progress > 0 && (
                              <div style={{
                                height:     '100%',
                                width:      `${Math.min(100, badge.progress)}%`,
                                background: '#E63946',
                              }} />
                            )}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* ══ 5. LEXICON — Virtualized Word List ══════════════════════ */}
              <motion.div variants={sectionFade} style={{ marginBottom: 32 }}>
                <SectionLabel>The Lexicon</SectionLabel>

                <div style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           8,
                  borderBottom:  '1px solid var(--form-border)',
                  paddingBottom: 8,
                  marginBottom:  12,
                }}>
                  <Search size={14} style={{ color: 'var(--color-lx-text-secondary)', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search words..."
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize:   13,
                      fontStyle:  'italic',
                      color:      'var(--form-input-text)',
                      background: 'transparent',
                      border:     'none',
                      outline:    'none',
                      flex:       1,
                    } as React.CSSProperties}
                    onFocus={e => { e.currentTarget.parentElement!.style.borderBottomColor = 'var(--form-focus)'; }}
                    onBlur={e  => { e.currentTarget.parentElement!.style.borderBottomColor = 'var(--form-border)'; }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} style={{ ...iconBtn, color: 'var(--color-lx-text-muted)' }} aria-label="Clear search">
                      <XIcon size={13} />
                    </button>
                  )}
                </div>

                <div style={{
                  display:        'flex',
                  gap:            6,
                  overflowX:      'auto',
                  paddingBottom:  12,
                  scrollbarWidth: 'none',
                }}>
                  {FILTERS.map(f => (
                    <button
                      key={f}
                      onClick={() => setLevelFilter(f)}
                      style={{
                        display:    'flex',
                        alignItems: 'center',
                        gap:        5,
                        padding:    '4px 10px',
                        background: levelFilter === f ? 'rgba(228,57,70,0.18)' : 'rgba(255,255,255,0.04)',
                        border:     levelFilter === f ? '1px solid #E63946' : '1px solid transparent',
                        borderRadius: 2,
                        cursor:     'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f !== 'all' && (
                        <div style={{ width: 6, height: 6, background: LEVEL_COLORS[f] ?? '#fff', flexShrink: 0 }} />
                      )}
                      <span style={{
                        fontFamily:    "'Sora', sans-serif",
                        fontSize:      10,
                        textTransform: 'capitalize',
                        color:         levelFilter === f ? '#F0EEE9' : 'var(--color-lx-text-muted)',
                        fontWeight:    levelFilter === f ? 600 : 400,
                      }}>
                        {f}
                      </span>
                    </button>
                  ))}
                </div>

                {filteredWords.length === 0 ? (
                  <div style={{ position: 'relative', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{
                      position:      'absolute',
                      fontSize:      120,
                      fontFamily:    "'Cormorant Garamond', Georgia, serif",
                      fontStyle:     'italic',
                      color:         'rgba(228,57,70,0.04)',
                      userSelect:    'none',
                      pointerEvents: 'none',
                      top:           '50%',
                      left:          '50%',
                      transform:     'translate(-50%, -50%)',
                    }}>
                      &amp;
                    </span>
                    <span style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize:   20,
                      fontStyle:  'italic',
                      color:      'var(--color-lx-text-muted)',
                      position:   'relative',
                    }}>
                      No words found
                    </span>
                  </div>
                ) : (
                  <div
                    ref={listRef}
                    style={{
                      height:         450,
                      overflowY:      'auto',
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255,255,255,0.08) transparent',
                    }}
                  >
                    <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                      {virtualizer.getVirtualItems().map(vItem => {
                        const w = filteredWords[vItem.index] as WordRow;
                        return (
                          <div
                            key={vItem.key}
                            style={{
                              position:       'absolute',
                              top:            0,
                              left:           0,
                              width:          '100%',
                              height:         vItem.size,
                              transform:      `translateY(${vItem.start}px)`,
                              display:        'flex',
                              alignItems:     'center',
                              justifyContent: 'space-between',
                              borderBottom:   '1px solid rgba(255,255,255,0.04)',
                              padding:        '0 4px',
                            }}
                          >
                            <div>
                              <div style={{
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontSize:   17,
                                fontStyle:  'italic',
                                color:      '#F0EEE9',
                                lineHeight: 1.2,
                              }}>
                                {w.word}
                              </div>
                              <div style={{
                                fontFamily: "'Sora', sans-serif",
                                fontSize:   10,
                                color:      'var(--color-lx-text-muted)',
                                fontStyle:  'italic',
                              }}>
                                {w.partOfSpeech}
                              </div>
                            </div>
                            <div style={{
                              width:        4,
                              height:       24,
                              background:   LEVEL_COLORS[w.masteryLevel] ?? LEVEL_COLORS.new,
                              flexShrink:   0,
                              borderRadius: 1,
                            }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>

            </motion.div>
          </motion.div>

        ) : (
          /* ════════════════════════════════════════════════════════════════
             SETTINGS TAB
             ════════════════════════════════════════════════════════════════ */
          <motion.div
            key="settings-tab"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ type: 'spring' as const, stiffness: 320, damping: 32 }}
          >
            <motion.div
              variants={settingStagger}
              initial="hidden"
              animate="show"
              style={{ padding: '28px 20px 80px', display: 'flex', flexDirection: 'column', maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', width: '100%' }}
            >

              {/* ── Page header ─────────────────────────────────────────── */}
              <motion.div variants={settingItem} style={{ marginBottom: 28 }}>
                <h2 style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize:   32,
                  fontStyle:  'italic',
                  fontWeight: 600,
                  color:      '#F0EEE9',
                  margin:     '0 0 4px',
                  lineHeight: 1.1,
                }}>
                  Preferences
                </h2>
                <p style={{
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      10,
                  fontWeight:    500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color:         'var(--color-lx-text-muted)',
                  margin:        0,
                }}>
                  Calibrate your study environment
                </p>
              </motion.div>

              {/* ══ SECTION 1: Study Deadline ══════════════════════════════ */}
              <motion.div variants={settingItem} style={{ marginBottom: 24 }}>
                <SectionLabel>Study Deadline</SectionLabel>
                <GoldRule />

                {/* Large serif date display */}
                <div style={{
                  padding:       '20px 0 4px',
                  borderBottom:  '1px solid rgba(255,255,255,0.05)',
                  marginBottom:  4,
                }}>
                  {deadline ? (
                    <>
                      <div style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize:   36,
                        fontWeight: 600,
                        fontStyle:  'italic',
                        color:      '#F0EEE9',
                        lineHeight: 1.05,
                        marginBottom: 6,
                      }}>
                        {fmtDeadline(deadline)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontFamily: "'Sora', sans-serif",
                            fontSize:   10,
                            color:      'var(--color-lx-text-muted)',
                            letterSpacing: '0.06em',
                          }}>
                            {daysUntil(deadline) > 0
                              ? `${daysUntil(deadline)} days remaining`
                              : daysUntil(deadline) === 0
                                ? 'Due today'
                                : `${Math.abs(daysUntil(deadline))} days past`}
                          </span>
                        </div>
                        {/* Animated daily target */}
                        <div style={{
                          display:     'flex',
                          alignItems:  'center',
                          gap:         5,
                          padding:     '3px 8px 3px 6px',
                          background:  'rgba(244,168,40,0.08)',
                          borderLeft:  '2px solid #F4A828',
                        }}>
                          <span style={{
                            fontFamily: "'Sora', sans-serif",
                            fontSize:   9,
                            color:      '#F4A828',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                          }}>
                            Daily
                          </span>
                          <span style={{
                            fontFamily: "'Cormorant Garamond', Georgia, serif",
                            fontSize:   18,
                            fontWeight: 600,
                            color:      '#F4A828',
                            lineHeight: 1,
                          }}>
                            <AnimatedNumber value={dailyTarget} />
                          </span>
                          <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 9, color: '#F4A82899' }}>
                            words
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        10,
                      padding:    '8px 0',
                    }}>
                      <span style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize:   22,
                        fontStyle:  'italic',
                        color:      'var(--color-lx-text-muted)',
                      }}>
                        No deadline set
                      </span>
                    </div>
                  )}
                </div>

                {/* Edit button row */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 10 }}>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setDeadlineSheet(true)}
                    style={{
                      display:       'flex',
                      alignItems:    'center',
                      gap:           6,
                      padding:       '8px 14px',
                      background:    'rgba(214,43,56,0.1)',
                      border:        '1px solid rgba(214,43,56,0.25)',
                      borderRadius:  0,
                      cursor:        'pointer',
                      fontFamily:    "'Sora', sans-serif",
                      fontSize:      11,
                      fontWeight:    600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color:         '#D62B38',
                    }}
                  >
                    <CalendarDays size={13} />
                    {deadline ? 'Edit Deadline' : 'Set Deadline'}
                  </motion.button>

                  {deadline && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={clearDeadline}
                      style={{
                        display:       'flex',
                        alignItems:    'center',
                        gap:           6,
                        padding:       '8px 14px',
                        background:    'transparent',
                        border:        '1px solid rgba(255,255,255,0.08)',
                        borderRadius:  0,
                        cursor:        'pointer',
                        fontFamily:    "'Sora', sans-serif",
                        fontSize:      11,
                        fontWeight:    500,
                        color:         'var(--color-lx-text-muted)',
                      }}
                    >
                      <XIcon size={12} />
                      Clear
                    </motion.button>
                  )}
                </div>
              </motion.div>

              {/* ══ SECTION 2: Appearance ══════════════════════════════════ */}
              <motion.div variants={settingItem} style={{ marginBottom: 24 }}>
                <SectionLabel>Appearance</SectionLabel>
                <GoldRule />

                <SettingRow
                  icon={isDark ? Moon : Sun}
                  label="Dark Mode"
                  sublabel={isDark ? 'The vault is sealed in shadow' : 'The archive opens to light'}
                >
                  {/* Custom day/night toggle */}
                  <motion.button
                    role="switch"
                    aria-checked={isDark}
                    onClick={() => toggleTheme(!isDark)}
                    whileTap={{ scale: 0.94 }}
                    style={{
                      position:     'relative',
                      width:        52,
                      height:       28,
                      borderRadius: 14,
                      background:   isDark
                        ? 'linear-gradient(135deg, #1a1a2e, #0f0f23)'
                        : 'linear-gradient(135deg, #f4a828, #e8cb7a)',
                      border:       isDark
                        ? '1.5px solid rgba(200,160,255,0.2)'
                        : '1.5px solid rgba(244,168,40,0.5)',
                      cursor:       'pointer',
                      flexShrink:   0,
                      outline:      'none',
                      padding:      0,
                      overflow:     'hidden',
                    }}
                  >
                    {/* Stars for dark mode */}
                    <AnimatePresence>
                      {isDark && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
                            padding: '4px 6px',
                          }}
                        >
                          {[
                            { w: 2, h: 2, top: 4, left: 6 },
                            { w: 1.5, h: 1.5, top: 9, left: 14 },
                            { w: 2, h: 2, top: 6, left: 20 },
                          ].map((s, i) => (
                            <div key={i} style={{
                              position:  'absolute',
                              width:     s.w,
                              height:    s.h,
                              borderRadius: '50%',
                              background:'rgba(255,255,255,0.7)',
                              top:       s.top,
                              left:      s.left,
                            }} />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Knob: moon or sun icon */}
                    <motion.div
                      layout
                      transition={{ type: 'spring' as const, stiffness: 420, damping: 32 }}
                      style={{
                        position:     'absolute',
                        top:          4,
                        left:         isDark ? 24 : 4,
                        width:        18,
                        height:       18,
                        borderRadius: '50%',
                        background:   isDark ? '#e8e0ff' : '#fff8e8',
                        boxShadow:    isDark
                          ? '0 0 6px rgba(200,160,255,0.5)'
                          : '0 0 8px rgba(244,168,40,0.6)',
                        display:       'flex',
                        alignItems:    'center',
                        justifyContent:'center',
                        overflow:      'hidden',
                      }}
                    >
                      <AnimatePresence mode="wait">
                        {isDark ? (
                          <motion.div key="moon"
                            initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                            animate={{ opacity: 1, rotate: 0, scale: 1 }}
                            exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                            transition={{ duration: 0.18 }}
                          >
                            <Moon size={10} color="#5b4d8f" strokeWidth={2} />
                          </motion.div>
                        ) : (
                          <motion.div key="sun"
                            initial={{ opacity: 0, rotate: 30, scale: 0.7 }}
                            animate={{ opacity: 1, rotate: 0, scale: 1 }}
                            exit={{ opacity: 0, rotate: -30, scale: 0.7 }}
                            transition={{ duration: 0.18 }}
                          >
                            <Sun size={10} color="#f4a828" strokeWidth={2} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.button>
                </SettingRow>
              </motion.div>

              {/* ══ SECTION 3: Notifications ═══════════════════════════════ */}
              <motion.div variants={settingItem} style={{ marginBottom: 24 }}>
                <SectionLabel>Notifications</SectionLabel>
                <GoldRule />

                <SettingRow
                  icon={notificationsEnabled ? Bell : BellOff}
                  label="Push Notifications"
                  sublabel={
                    !notifSupported || notifPermission === 'unsupported'
                      ? 'Not supported on this device'
                      : notifPermission === 'denied'
                        ? 'Permission denied — enable in browser settings'
                        : notifLoading
                          ? 'Updating…'
                          : 'Daily study reminders and streak alerts'
                  }
                >
                  <LuxToggle
                    on={notificationsEnabled && notifSupported && notifPermission !== 'unsupported' && notifPermission !== 'denied'}
                    onChange={toggleNotifications}
                    disabled={!notifSupported || notifPermission === 'unsupported' || notifPermission === 'denied' || notifLoading}
                    accent="#D62B38"
                  />
                </SettingRow>

                {notifPermission === 'denied' && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize:   10,
                      color:      '#F4A828',
                      margin:     '0 0 8px 50px',
                      lineHeight: 1.5,
                    }}
                  >
                    To enable, open your browser&apos;s site settings and allow notifications for this domain.
                  </motion.p>
                )}
              </motion.div>

              {/* ══ SECTION 4: Email Summary ═══════════════════════════════ */}
              <motion.div variants={settingItem} style={{ marginBottom: 24 }}>
                <SectionLabel>Email</SectionLabel>
                <GoldRule />

                <SettingRow
                  icon={emailSummaryEnabled ? Mail : MailOpen}
                  label="Weekly Summary"
                  sublabel="A curated digest of your week — progress, streaks, badges"
                >
                  <LuxToggle
                    on={emailSummaryEnabled}
                    onChange={toggleEmail}
                    accent="#C9A84C"
                  />
                </SettingRow>
              </motion.div>

              {/* ══ SECTION 5: Danger Zone ═════════════════════════════════ */}
              <motion.div variants={settingItem} style={{ marginTop: 16 }}>
                <SectionLabel>Danger Zone</SectionLabel>
                <GoldRule />

                <div style={{
                  marginTop:   12,
                  padding:     '1px',
                  background:  'linear-gradient(135deg, rgba(214,43,56,0.15), rgba(214,43,56,0.05))',
                  borderRadius: 0,
                }}>
                  <div style={{
                    background: 'var(--color-lx-surface)',
                    padding:    '16px',
                  }}>
                    <p style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize:   14,
                      fontStyle:  'italic',
                      color:      'var(--color-lx-text-muted)',
                      margin:     '0 0 14px',
                      lineHeight: 1.5,
                    }}>
                      Signing out will not affect your progress. All study data is safely stored.
                    </p>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSignOutConfirm(true)}
                      style={{
                        display:       'flex',
                        alignItems:    'center',
                        gap:           8,
                        padding:       '10px 16px',
                        background:    'rgba(214,43,56,0.08)',
                        border:        '1px solid rgba(214,43,56,0.3)',
                        borderRadius:  0,
                        cursor:        'pointer',
                        fontFamily:    "'Sora', sans-serif",
                        fontSize:      12,
                        fontWeight:    600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color:         '#D62B38',
                      }}
                    >
                      <LogOut size={14} />
                      Sign Out of LexiCore
                    </motion.button>
                  </div>
                </div>
              </motion.div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ BADGE DETAIL BOTTOM SHEET ════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedBadge && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedBadge(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(7,7,9,0.75)', zIndex: 100 }}
            />
            <motion.div
              variants={sheetV}
              initial="hidden"
              animate="show"
              exit="exit"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.12}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 400) setSelectedBadge(null);
              }}
              style={{
                position:    'fixed',
                bottom:      0, left: 0, right: 0,
                zIndex:      101,
                background:  'var(--color-lx-surface)',
                borderRadius:'16px 16px 0 0',
                padding:     '0 24px 40px',
                touchAction: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 20px' }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
              </div>

              {(() => {
                const b      = selectedBadge;
                const Icon   = BADGE_ICONS[b.id] ?? Star;
                const accent = badgeAccent(b.category);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{
                      width:          72,
                      height:         72,
                      borderRadius:   '50%',
                      background:     b.earned ? `${accent}12` : 'rgba(255,255,255,0.04)',
                      border:         b.earned ? `1px solid ${accent}40` : '1px solid rgba(255,255,255,0.08)',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      marginBottom:   16,
                      filter:         b.earned ? 'none' : 'grayscale(1) brightness(0.4)',
                    }}>
                      <Icon size={32} color={accent} strokeWidth={1.4} style={b.earned ? { filter: `drop-shadow(0 0 6px ${accent}80)` } : {}} />
                    </div>
                    <h2 style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize:   26, fontStyle: 'italic', fontWeight: 600,
                      color:      '#F0EEE9', margin: '0 0 10px',
                    }}>
                      {b.name}
                    </h2>
                    <div style={{
                      width:        '60%', height: 1,
                      background:   'linear-gradient(90deg, transparent, rgba(244,168,40,0.3), transparent)',
                      marginBottom: 12,
                    }} />
                    <p style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize:   13, color: 'var(--color-lx-text-muted)',
                      lineHeight: 1.65, margin: '0 0 16px',
                    }}>
                      {b.description}
                    </p>
                    {b.earned && b.earnedAt ? (
                      <span style={{
                        fontFamily: "'Sora', sans-serif",
                        fontSize:   11, color: `${accent}aa`, letterSpacing: '0.05em',
                      }}>
                        Earned {fmtEarned(b.earnedAt)}
                      </span>
                    ) : !b.earned && (
                      <div style={{ width: '60%' }}>
                        <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 11, color: 'var(--color-lx-text-muted)', marginBottom: 6 }}>
                          {b.progress} progress
                        </p>
                        <div style={{ height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }}>
                          <div style={{
                            height: '100%', width: `${Math.min(100, b.progress)}%`,
                            background: 'linear-gradient(90deg, #E63946, #F4A828)', borderRadius: 1,
                            minWidth: b.progress > 0 ? 4 : 0,
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ SIGN-OUT CONFIRM SHEET ════════════════════════════════════════════ */}
      <AnimatePresence>
        {signOutConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSignOutConfirm(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(7,7,9,0.75)', zIndex: 100 }}
            />
            <motion.div
              variants={sheetV}
              initial="hidden" animate="show" exit="exit"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.12}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 400) setSignOutConfirm(false);
              }}
              style={{
                position:    'fixed',
                bottom:      0, left: 0, right: 0,
                zIndex:      101,
                background:  'var(--color-lx-surface)',
                borderRadius:'16px 16px 0 0',
                padding:     '14px 24px 40px',
                touchAction: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 20 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
              </div>

              {/* Crimson LogOut icon */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{
                  width:          52, height: 52,
                  borderRadius:   '50%',
                  background:     'rgba(214,43,56,0.1)',
                  border:         '1px solid rgba(214,43,56,0.25)',
                  display:        'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LogOut size={22} color="#D62B38" strokeWidth={1.5} />
                </div>
              </div>

              <p style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize:   24, fontStyle: 'italic',
                color:      '#F0EEE9', textAlign: 'center', margin: '0 0 6px',
              }}>
                Sign out?
              </p>
              <p style={{
                fontFamily: "'Sora', sans-serif",
                fontSize:   13, color: 'var(--color-lx-text-muted)',
                textAlign:  'center', margin: '0 0 28px', lineHeight: 1.5,
              }}>
                Your progress is saved in the vault.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setSignOutConfirm(false)}
                  style={{ ...sheetBtn, background: 'rgba(255,255,255,0.06)', color: '#F0EEE9', flex: 1 }}
                >
                  Stay
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  style={{ ...sheetBtn, background: 'rgba(214,43,56,0.12)', color: '#D62B38', border: '1px solid rgba(214,43,56,0.3)', flex: 1 }}
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ DEADLINE PICKER BOTTOM SHEET ═════════════════════════════════════ */}
      <AnimatePresence>
        {deadlineSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDeadlineSheet(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(7,7,9,0.75)', zIndex: 100 }}
            />
            <motion.div
              variants={sheetV}
              initial="hidden" animate="show" exit="exit"
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 400) setDeadlineSheet(false);
              }}
              style={{
                position:    'fixed',
                bottom:      0, left: 0, right: 0,
                zIndex:      101,
                background:  'var(--color-lx-surface)',
                borderRadius:'16px 16px 0 0',
                padding:     '14px 24px 48px',
                touchAction: 'none',
              }}
            >
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 24 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
              </div>

              {/* Title */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize:   26, fontStyle: 'italic', fontWeight: 600,
                  color:      '#F0EEE9', margin: '0 0 4px',
                }}>
                  Set Study Deadline
                </h3>
                <p style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize:   13, color: 'var(--form-helper)',
                  margin:     0, lineHeight: 1.5,
                }}>
                  We&apos;ll calculate your daily word target based on this date.
                </p>
              </div>

              {/* Gold rule */}
              <div style={{
                height:       1,
                background:   'linear-gradient(90deg, transparent, rgba(244,168,40,0.3), transparent)',
                marginBottom: 24,
              }} />

              {/* Date input */}
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display:       'block',
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      11,
                  fontWeight:    600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color:         'var(--form-label)',
                  marginBottom:  8,
                }}>
                  Deadline Date
                </label>
                <input
                  type="date"
                  value={pickerDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setPickerDate(e.target.value)}
                  style={{
                    width:        '100%',
                    fontFamily:   "'Sora', sans-serif",
                    fontSize:     15,
                    color:        'var(--form-input-text)',
                    background:   'var(--form-field-bg)',
                    border:       '1px solid var(--form-border)',
                    borderRadius: 10,
                    padding:      '12px 14px',
                    outline:      'none',
                    colorScheme:  'dark',
                    boxSizing:    'border-box',
                  } as React.CSSProperties}
                />

                {/* Preview computed daily target */}
                {pickerDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      marginTop:   10,
                      padding:     '10px 14px',
                      background:  'rgba(244,168,40,0.06)',
                      borderLeft:  '2px solid #F4A828',
                      display:     'flex',
                      alignItems:  'center',
                      gap:         10,
                    }}
                  >
                    <span style={{
                      fontFamily: "'Sora', sans-serif",
                      fontSize:   11, color: '#F4A828',
                    }}>
                      Estimated daily target:
                    </span>
                    <span style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize:   22, fontWeight: 600, color: '#F4A828',
                    }}>
                      {(() => {
                        const dLeft = Math.max(1, daysUntil(pickerDate + 'T00:00:00.000Z'));
                        const rem   = Math.max(0, data.levelStats.total - data.levelStats.mastered);
                        return Math.max(1, Math.ceil(rem / dLeft));
                      })()}
                    </span>
                    <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 10, color: '#F4A82888' }}>
                      words/day
                    </span>
                  </motion.div>
                )}
              </div>

              {/* CTA buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setDeadlineSheet(false)}
                  style={{ ...sheetBtn, background: 'rgba(255,255,255,0.06)', color: '#F0EEE9', flex: 1 }}
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={saveDeadline}
                  disabled={!pickerDate || deadlineSaving}
                  style={{
                    ...sheetBtn,
                    background: !pickerDate ? 'rgba(214,43,56,0.06)' : 'rgba(214,43,56,0.14)',
                    color:      '#D62B38',
                    border:     '1px solid rgba(214,43,56,0.3)',
                    flex:       1,
                    opacity:    deadlineSaving ? 0.6 : 1,
                  }}
                >
                  {deadlineSaving ? 'Saving…' : 'Confirm Deadline'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Shared inline style objects ──────────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  background:     'transparent',
  border:         'none',
  cursor:         'pointer',
  padding:        4,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  transition:     'color 0.15s',
  flexShrink:     0,
};

const sheetBtn: React.CSSProperties = {
  fontFamily:    "'Sora', sans-serif",
  fontSize:      13,
  fontWeight:    600,
  border:        'none',
  borderRadius:  2,
  padding:       '12px 0',
  cursor:        'pointer',
  letterSpacing: '0.04em',
};

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p style={{
      fontFamily:    "'Sora', sans-serif",
      fontSize:      9,
      fontWeight:    600,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color:         'var(--color-lx-text-muted)',
      margin:        '0 0 12px',
      textAlign:     center ? 'center' : 'left',
    }}>
      {children}
    </p>
  );
}
