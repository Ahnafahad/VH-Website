'use client';

/**
 * LeaderboardClient — interactive shell for /admin/leaderboard
 *
 * Renders:
 *   1. Weekly Leaderboard table (current week)
 *   2. All-Time Leaderboard table with inline reset button
 *   3. Hall of Fame session cards
 *   4. Danger Zone with Reset modal (requires session label, then confirm step)
 *
 * Design: light mode, Linear/Vercel editorial. Crimson #D62B38 for destructive
 * actions. Gold/silver/bronze left-border accent on top-3 rows.
 * Framer Motion for page entrance + modal. No emojis — lucide-react only.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Trophy,
  Crown,
  Star,
  Medal,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
  Calendar,
  TrendingUp,
  Flame,
} from 'lucide-react';
import type { LeaderboardEntry, HofSession } from '@/app/admin/leaderboard/page';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  weeklyLeaderboard:  LeaderboardEntry[];
  allTimeLeaderboard: LeaderboardEntry[];
  hallOfFame:         HofSession[];
}

interface ToastState {
  type:    'success' | 'error';
  message: string;
}

// ─── Rank accent config ───────────────────────────────────────────────────────

const RANK_ACCENT: Record<number, {
  border: string;
  bg:     string;
  color:  string;
  icon:   React.ElementType;
}> = {
  1: { border: '#C9A84C', bg: 'rgba(201,168,76,0.07)',  color: '#92400E', icon: Crown  },
  2: { border: '#8A9BA8', bg: 'rgba(138,155,168,0.07)', color: '#475569', icon: Medal  },
  3: { border: '#A0673A', bg: 'rgba(160,103,58,0.07)',  color: '#7C3D12', icon: Flame  },
};

// ─── Motion variants ──────────────────────────────────────────────────────────

const pageVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 280,
      damping: 28,
      staggerChildren: 0.08,
      delayChildren:   0.04,
    },
  },
};

const sectionVariants: Variants = {
  hidden:  { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 340, damping: 30 },
  },
};

const rowListVariants: Variants = {
  visible: {
    transition: { staggerChildren: 0.025 },
  },
};

const rowVariants: Variants = {
  hidden:  { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 400, damping: 32 },
  },
};

const hofCardListVariants: Variants = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const hofCardVariants: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 26 },
  },
};

const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.16 } },
  exit:    { opacity: 0, transition: { duration: 0.12 } },
};

const modalVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.96, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 420, damping: 32, delay: 0.04 },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 5,
    transition: { duration: 0.11 },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatPts(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Deterministic muted colour from a name string. */
function avatarBg(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 42%, 52%)`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar({ name, accent }: { name: string; accent?: { border: string } }) {
  return (
    <div
      aria-hidden
      style={{
        width:           30,
        height:          30,
        borderRadius:    '50%',
        background:      accent ? accent.border : avatarBg(name),
        color:           '#FFF',
        fontSize:        10,
        fontWeight:      700,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
        letterSpacing:   '0.04em',
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── LeaderboardTable ─────────────────────────────────────────────────────────

function LeaderboardTable({
  entries,
  emptyText,
  showEmail = true,
}: {
  entries:   LeaderboardEntry[];
  emptyText: string;
  showEmail?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div style={S.emptyState}>
        <Trophy size={26} style={{ color: '#CBD5E1' }} />
        <p style={S.emptyText}>{emptyText}</p>
      </div>
    );
  }

  return (
    <motion.div variants={rowListVariants} initial="hidden" animate="visible">
      {/* Table header */}
      <div style={S.tableHead}>
        <span style={{ ...S.thCell, width: 52 }}>Rank</span>
        <span style={{ ...S.thCell, flex: 1   }}>User</span>
        {showEmail && (
          <span style={{ ...S.thCell, width: 200, display: 'flex' as const }}>Email</span>
        )}
        <span style={{ ...S.thCell, width: 100, textAlign: 'right' as const }}>Points</span>
      </div>

      {/* Rows */}
      {entries.map((entry) => {
        const acc = RANK_ACCENT[entry.rank];
        const RankIcon = acc?.icon;
        return (
          <motion.div
            key={entry.userId}
            variants={rowVariants}
            style={{
              ...S.tableRow,
              borderLeft:      acc ? `3px solid ${acc.border}` : '3px solid transparent',
              backgroundColor: acc ? acc.bg : 'transparent',
            }}
          >
            {/* Rank */}
            <div style={{ ...S.tdCell, width: 52 }}>
              {acc ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: acc.border }}>
                  {RankIcon && <RankIcon size={13} />}
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{entry.rank}</span>
                </span>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 500, color: '#9CA3AF' }}>
                  {entry.rank}
                </span>
              )}
            </div>

            {/* Name + avatar */}
            <div style={{ ...S.tdCell, flex: 1, gap: 10 }}>
              <UserAvatar name={entry.displayName} accent={acc} />
              <span style={S.userName}>{entry.displayName}</span>
            </div>

            {/* Email (if shown) */}
            {showEmail && (
              <div style={{ ...S.tdCell, width: 200 }}>
                <span style={S.userEmail} title={entry.email}>{entry.email}</span>
              </div>
            )}

            {/* Points */}
            <div style={{ ...S.tdCell, width: 100, justifyContent: 'flex-end' }}>
              <span style={{
                ...S.pointsVal,
                color: acc ? acc.border : '#111827',
              }}>
                {formatPts(entry.points)}
              </span>
              <span style={S.pointsUnit}>pts</span>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ─── Hall of Fame cards ───────────────────────────────────────────────────────

function HofCards({ sessions }: { sessions: HofSession[] }) {
  if (sessions.length === 0) {
    return (
      <div style={{ ...S.emptyState, padding: '32px 20px' }}>
        <Star size={26} style={{ color: '#CBD5E1' }} />
        <p style={S.emptyText}>
          No Hall of Fame sessions yet. Reset the all-time leaderboard to create one.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={hofCardListVariants}
      initial="hidden"
      animate="visible"
      style={S.hofGrid}
    >
      {sessions.map((session, i) => {
        const HofCardIcon = [Crown, Medal, Flame];
        return (
          <motion.div
            key={`${session.sessionLabel}-${i}`}
            variants={hofCardVariants}
            style={S.hofCard}
          >
            {/* Card header */}
            <div style={S.hofCardHead}>
              <div style={S.hofTrophyBadge}>
                <Trophy size={13} color="#C9A84C" />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={S.hofLabel}>{session.sessionLabel}</p>
                <div style={S.hofDateRow}>
                  <Calendar size={10} style={{ color: '#94A3B8', flexShrink: 0 }} />
                  <span style={S.hofDateText}>{formatDate(session.weekEndDate)}</span>
                </div>
              </div>
            </div>

            {/* Entries */}
            <div style={S.hofEntries}>
              {session.entries.map((entry) => {
                const entryAcc = RANK_ACCENT[entry.rank];
                const EntryIcon = HofCardIcon[entry.rank - 1];
                return (
                  <div key={entry.rank} style={S.hofEntry}>
                    <div style={{
                      width:          22,
                      height:         22,
                      borderRadius:   '50%',
                      background:     entryAcc ? entryAcc.border : '#CBD5E1',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      flexShrink:     0,
                    }}>
                      {EntryIcon && (
                        <EntryIcon size={11} color="#FFFFFF" />
                      )}
                    </div>
                    <span style={S.hofEntryName} title={entry.displayName}>
                      {entry.displayName}
                    </span>
                    <span style={{
                      ...S.hofEntryPts,
                      color: entryAcc ? entryAcc.border : '#64748B',
                    }}>
                      {formatPts(entry.points)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ─── Reset Modal ──────────────────────────────────────────────────────────────

interface ResetModalProps {
  open:      boolean;
  onClose:   () => void;
  onConfirm: (label: string) => Promise<void>;
  loading:   boolean;
}

function ResetModal({ open, onClose, onConfirm, loading }: ResetModalProps) {
  const [step,  setStep]  = useState<'input' | 'confirm'>('input');
  const [label, setLabel] = useState('');
  const [err,   setErr]   = useState('');
  const inputRef          = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('input');
      setLabel('');
      setErr('');
      setTimeout(() => inputRef.current?.focus(), 90);
    }
  }, [open]);

  // Escape key handling
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, loading, onClose]);

  function handleNext() {
    if (!label.trim()) { setErr('Session label is required.'); return; }
    setErr('');
    setStep('confirm');
  }

  async function handleConfirm() {
    await onConfirm(label.trim());
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="lb-modal-bd"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => !loading && onClose()}
            style={S.backdrop}
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            key="lb-modal-pn"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lb-reset-title"
            style={S.modalPanel}
          >
            {/* Close */}
            <button
              onClick={() => !loading && onClose()}
              disabled={loading}
              aria-label="Close"
              style={S.modalCloseBtn}
            >
              <X size={15} />
            </button>

            {/* Warning icon */}
            <div style={S.modalIconWrap}>
              <AlertTriangle size={20} color="#D62B38" />
            </div>

            <h2 id="lb-reset-title" style={S.modalTitle}>
              Reset All-Time Leaderboard
            </h2>

            {/* ── Step 1: enter label ────────────────────────────────────── */}
            {step === 'input' && (
              <>
                <p style={S.modalDesc}>
                  The current top 3 will be archived to the Hall of Fame before
                  all total points are set to zero. This cannot be undone.
                </p>

                <div style={{ marginTop: 18 }}>
                  <label htmlFor="lb-session-label" style={S.inputLabel}>
                    Session label <span style={{ color: '#D62B38' }}>*</span>
                  </label>
                  <input
                    ref={inputRef}
                    id="lb-session-label"
                    type="text"
                    value={label}
                    onChange={e => { setLabel(e.target.value); setErr(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleNext(); }}
                    placeholder="e.g. Phase 1 — April 2026"
                    maxLength={120}
                    disabled={loading}
                    style={{
                      ...S.modalInput,
                      borderColor: err ? '#D62B38' : label.trim() ? '#6EE7B7' : '#E2E8F0',
                    }}
                    aria-required="true"
                    aria-describedby="lb-label-hint"
                  />
                  {err
                    ? <p style={S.fieldError}>{err}</p>
                    : <p id="lb-label-hint" style={S.fieldHint}>Appears in the Hall of Fame card.</p>
                  }
                </div>

                <div style={S.modalActions}>
                  <button style={S.btnGhost} onClick={onClose} disabled={loading}>
                    Cancel
                  </button>
                  <button
                    style={{
                      ...S.btnDark,
                      opacity: label.trim() ? 1 : 0.45,
                      cursor:  label.trim() ? 'pointer' : 'not-allowed',
                    }}
                    onClick={handleNext}
                    disabled={!label.trim()}
                    aria-disabled={!label.trim()}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: confirm ────────────────────────────────────────── */}
            {step === 'confirm' && (
              <>
                {/* Warning stripe */}
                <div style={S.warningStripe}>
                  <AlertTriangle size={13} color="#92400E" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, fontSize: 12.5, color: '#92400E', lineHeight: 1.5 }}>
                    You are about to permanently zero all{' '}
                    <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                      totalPoints
                    </code>{' '}
                    in the database. The current top 3 will be saved under{' '}
                    <strong>&ldquo;{label}&rdquo;</strong>.
                  </p>
                </div>

                <div style={S.confirmPreview}>
                  <span style={S.confirmPreviewLabel}>Session label:</span>
                  <span style={S.confirmPreviewValue}>{label}</span>
                </div>

                <div style={S.modalActions}>
                  <button
                    style={S.btnGhost}
                    onClick={() => { setStep('input'); setErr(''); }}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button
                    style={{
                      ...S.btnDanger,
                      opacity: loading ? 0.7 : 1,
                      cursor:  loading ? 'wait' : 'pointer',
                    }}
                    onClick={handleConfirm}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2
                          size={13}
                          style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
                        />
                        Resetting…
                      </>
                    ) : (
                      <>
                        <RotateCcw size={13} />
                        Confirm Reset
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionCard({
  title,
  desc,
  iconBg,
  icon: Icon,
  iconColor,
  count,
  countLabel,
  action,
  children,
}: {
  title:       string;
  desc:        string;
  iconBg:      string;
  icon:        React.ElementType;
  iconColor:   string;
  count:       number;
  countLabel:  string;
  action?:     React.ReactNode;
  children:    React.ReactNode;
}) {
  return (
    <motion.section variants={sectionVariants} style={S.card}>
      {/* Header */}
      <div style={S.cardHead}>
        <div style={{ ...S.iconBadge, background: iconBg }}>
          <Icon size={15} color={iconColor} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={S.cardTitle}>{title}</h2>
          <p style={S.cardDesc}>{desc}</p>
        </div>
        <div style={S.countPill}>
          {count} {countLabel}
        </div>
        {action}
      </div>

      {/* Body */}
      {children}
    </motion.section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeaderboardClient({
  weeklyLeaderboard,
  allTimeLeaderboard,
  hallOfFame: initialHof,
}: Props) {
  const [hofSessions,  setHofSessions]  = useState<HofSession[]>(initialHof);
  const [allTime,      setAllTime]      = useState<LeaderboardEntry[]>(allTimeLeaderboard);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [toast,        setToast]        = useState<ToastState | null>(null);

  // ── Toast ────────────────────────────────────────────────────────────────
  const showToast = useCallback((type: ToastState['type'], message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(async (sessionLabel: string) => {
    setResetLoading(true);
    try {
      const res  = await fetch('/api/admin/leaderboard/reset', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionLabel }),
      });
      const data = await res.json() as {
        success?: boolean;
        error?: string;
        savedEntries?: number;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Reset failed. Please try again.');
      }

      // Optimistic update: create new HoF session from current top 3
      const top3 = allTime.slice(0, 3);
      const newSession: HofSession = {
        sessionLabel,
        weekEndDate: new Date().toISOString(),
        createdAt:   new Date().toISOString(),
        entries: top3.map((e, i) => ({
          rank:        i + 1,
          displayName: e.displayName,
          points:      e.points,
        })),
      };

      setHofSessions(prev => [newSession, ...prev]);
      setAllTime(prev => prev.map(e => ({ ...e, points: 0 })));
      setModalOpen(false);

      showToast(
        'success',
        `Reset complete — ${data.savedEntries ?? top3.length} ${
          (data.savedEntries ?? top3.length) === 1 ? 'entry' : 'entries'
        } saved to Hall of Fame.`,
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unexpected error.');
    } finally {
      setResetLoading(false);
    }
  }, [allTime, showToast]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      style={S.root}
    >

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="lb-toast"
            initial={{ opacity: 0, y: -10, x: '-50%' }}
            animate={{ opacity: 1, y: 0,   x: '-50%' }}
            exit={{    opacity: 0, y: -6,   x: '-50%' }}
            transition={{ type: 'spring' as const, stiffness: 440, damping: 30 }}
            role="status"
            aria-live="polite"
            style={{
              ...S.toast,
              ...(toast.type === 'success' ? S.toastSuccess : S.toastError),
            }}
          >
            {toast.type === 'success'
              ? <CheckCircle  size={14} style={{ flexShrink: 0 }} />
              : <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            }
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <motion.div variants={sectionVariants} style={S.pageHeader}>
        <h1 style={S.pageTitle}>Leaderboard</h1>
        <p style={S.pageSubtitle}>
          Weekly standings, all-time rankings, and Hall of Fame archives
        </p>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          1. Weekly Leaderboard
      ═══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Weekly Leaderboard"
        desc="Points earned this week. Resets automatically on Monday."
        iconBg="#EFF6FF"
        icon={TrendingUp}
        iconColor="#2563EB"
        count={weeklyLeaderboard.length}
        countLabel="users"
      >
        <LeaderboardTable
          entries={weeklyLeaderboard}
          emptyText="No weekly activity this period."
        />
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════════════════════
          2. All-Time Leaderboard
      ═══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="All-Time Leaderboard"
        desc="Cumulative total points since the last reset."
        iconBg="#FEF3C7"
        icon={Trophy}
        iconColor="#D97706"
        count={allTime.length}
        countLabel="users"
        action={
          <button
            onClick={() => setModalOpen(true)}
            style={S.resetOutlineBtn}
            aria-label="Reset all-time leaderboard"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        }
      >
        <LeaderboardTable
          entries={allTime}
          emptyText="No users have earned points yet."
        />
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════════════════════
          3. Hall of Fame
      ═══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Hall of Fame"
        desc="Top-3 archives from past all-time resets."
        iconBg="rgba(201,168,76,0.10)"
        icon={Star}
        iconColor="#C9A84C"
        count={hofSessions.length}
        countLabel={hofSessions.length === 1 ? 'session' : 'sessions'}
      >
        <HofCards sessions={hofSessions} />
      </SectionCard>

      {/* ═══════════════════════════════════════════════════════════════════════
          4. Danger Zone
      ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section variants={sectionVariants} style={S.dangerZone}>
        <div style={S.dangerHead}>
          <div style={{ ...S.iconBadge, background: '#FEF2F2' }}>
            <AlertTriangle size={15} color="#D62B38" />
          </div>
          <div>
            <h2 style={{ ...S.cardTitle }}>Danger Zone</h2>
            <p style={S.cardDesc}>Irreversible actions — proceed with caution.</p>
          </div>
        </div>

        <div style={S.dangerRow}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={S.dangerRowTitle}>Reset All-Time Leaderboard</p>
            <p style={S.dangerRowDesc}>
              Saves the current top 3 to Hall of Fame and zeros all total points.
              Requires a session label before confirming.
            </p>
          </div>
          <button
            style={S.dangerBtn}
            onClick={() => setModalOpen(true)}
          >
            <RotateCcw size={13} />
            Reset Leaderboard
          </button>
        </div>
      </motion.section>

      {/* ── Modal ──────────────────────────────────────────────────────────────── */}
      <ResetModal
        open={modalOpen}
        onClose={() => !resetLoading && setModalOpen(false)}
        onConfirm={handleReset}
        loading={resetLoading}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           18,
    maxWidth:      '100%',
    fontFamily:    'system-ui, -apple-system, sans-serif',
    color:         '#0F172A',
    colorScheme:   'light',
  },

  pageHeader: {
    marginBottom: 6,
  } as React.CSSProperties,

  pageTitle: {
    margin:        0,
    fontSize:      22,
    fontWeight:    700,
    color:         '#0F172A',
    letterSpacing: '-0.025em',
    lineHeight:    1.2,
  } as React.CSSProperties,

  pageSubtitle: {
    margin:     '4px 0 0',
    fontSize:   13,
    color:      '#64748B',
    fontWeight: 400,
  } as React.CSSProperties,

  // ── Section card ─────────────────────────────────────────────────────────────
  card: {
    background:   '#FFFFFF',
    border:       '1px solid #E2E8F0',
    borderRadius: 12,
    overflow:     'hidden' as const,
  } as React.CSSProperties,

  cardHead: {
    display:      'flex',
    alignItems:   'center',
    gap:          12,
    padding:      '15px 18px',
    borderBottom: '1px solid #F1F5F9',
    flexWrap:     'wrap' as const,
  } as React.CSSProperties,

  iconBadge: {
    width:          34,
    height:         34,
    borderRadius:   8,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  } as React.CSSProperties,

  cardTitle: {
    margin:        0,
    fontSize:      14,
    fontWeight:    600,
    color:         '#0F172A',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  cardDesc: {
    margin:    '1px 0 0',
    fontSize:  12,
    color:     '#94A3B8',
    fontWeight: 400,
  } as React.CSSProperties,

  countPill: {
    marginLeft:    'auto',
    padding:       '3px 9px',
    borderRadius:  20,
    background:    '#F3F4F6',
    fontSize:      11,
    fontWeight:    600,
    color:         '#6B7280',
    letterSpacing: '0.02em',
    whiteSpace:    'nowrap' as const,
  } as React.CSSProperties,

  resetOutlineBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          5,
    padding:      '6px 12px',
    background:   'transparent',
    border:       '1.5px solid #D62B38',
    borderRadius: 7,
    fontSize:     12,
    fontWeight:   600,
    color:        '#D62B38',
    cursor:       'pointer',
    whiteSpace:   'nowrap' as const,
    letterSpacing: '-0.005em',
  } as React.CSSProperties,

  // ── Table ─────────────────────────────────────────────────────────────────────
  tableHead: {
    display:      'flex',
    alignItems:   'center',
    padding:      '8px 18px',
    borderBottom: '1px solid #F1F5F9',
    background:   '#F8FAFC',
    gap:          10,
  } as React.CSSProperties,

  thCell: {
    fontSize:      10.5,
    fontWeight:    700,
    color:         '#94A3B8',
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    display:       'flex',
    alignItems:    'center',
  } as React.CSSProperties,

  tableRow: {
    display:      'flex',
    alignItems:   'center',
    padding:      '9px 18px',
    gap:          10,
    borderBottom: '1px solid #F8FAFC',
    transition:   'background 0.1s',
  } as React.CSSProperties,

  tdCell: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
    minWidth:   0,
  } as React.CSSProperties,

  userName: {
    fontSize:     13,
    fontWeight:   500,
    color:        '#111827',
    letterSpacing: '-0.01em',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap' as const,
  } as React.CSSProperties,

  userEmail: {
    fontSize:     11,
    color:        '#9CA3AF',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap' as const,
  } as React.CSSProperties,

  pointsVal: {
    fontSize:           14,
    fontWeight:         700,
    letterSpacing:      '-0.02em',
    fontVariantNumeric: 'tabular-nums' as const,
    fontFamily:         'ui-monospace, "SF Mono", Menlo, monospace',
  } as React.CSSProperties,

  pointsUnit: {
    fontSize:     10,
    fontWeight:   600,
    color:        '#94A3B8',
    letterSpacing: '0.04em',
    marginLeft:   2,
  } as React.CSSProperties,

  emptyState: {
    display:        'flex',
    flexDirection:  'column' as const,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    padding:        '40px 20px',
  } as React.CSSProperties,

  emptyText: {
    margin:     0,
    fontSize:   13,
    color:      '#94A3B8',
    textAlign:  'center' as const,
    maxWidth:   300,
    lineHeight: 1.5,
  } as React.CSSProperties,

  // ── Hall of Fame ──────────────────────────────────────────────────────────────
  hofGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
    gap:                 14,
    padding:             '14px 18px',
  } as React.CSSProperties,

  hofCard: {
    border:       '1px solid #E2E8F0',
    borderRadius: 10,
    overflow:     'hidden' as const,
    background:   '#FAFAFA',
  } as React.CSSProperties,

  hofCardHead: {
    display:      'flex',
    alignItems:   'flex-start',
    gap:          10,
    padding:      '12px 14px',
    borderBottom: '1px solid #E2E8F0',
    background:   '#FFFFFF',
  } as React.CSSProperties,

  hofTrophyBadge: {
    width:          26,
    height:         26,
    borderRadius:   6,
    background:     'rgba(201,168,76,0.12)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    marginTop:      1,
  } as React.CSSProperties,

  hofLabel: {
    margin:        0,
    fontSize:      12.5,
    fontWeight:    600,
    color:         '#111827',
    letterSpacing: '-0.01em',
    overflow:      'hidden',
    textOverflow:  'ellipsis',
    whiteSpace:    'nowrap' as const,
  } as React.CSSProperties,

  hofDateRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        3,
    marginTop:  3,
  } as React.CSSProperties,

  hofDateText: {
    fontSize:  10.5,
    color:     '#94A3B8',
  } as React.CSSProperties,

  hofEntries: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           6,
    padding:       '10px 14px',
  } as React.CSSProperties,

  hofEntry: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
  } as React.CSSProperties,

  hofEntryName: {
    flex:         1,
    fontSize:     12,
    fontWeight:   500,
    color:        '#374151',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap' as const,
  } as React.CSSProperties,

  hofEntryPts: {
    fontSize:           12,
    fontWeight:         700,
    letterSpacing:      '-0.015em',
    fontVariantNumeric: 'tabular-nums' as const,
    fontFamily:         'ui-monospace, "SF Mono", Menlo, monospace',
    flexShrink:         0,
  } as React.CSSProperties,

  // ── Danger Zone ───────────────────────────────────────────────────────────────
  dangerZone: {
    background:   '#FFFFFF',
    border:       '1px solid #FECACA',
    borderRadius: 12,
    overflow:     'hidden' as const,
  } as React.CSSProperties,

  dangerHead: {
    display:      'flex',
    alignItems:   'center',
    gap:          12,
    padding:      '15px 18px',
    borderBottom: '1px solid #FEE2E2',
    background:   '#FFF5F5',
  } as React.CSSProperties,

  dangerRow: {
    display:        'flex',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            16,
    padding:        '16px 18px',
  } as React.CSSProperties,

  dangerRowTitle: {
    margin:     0,
    fontSize:   13.5,
    fontWeight: 600,
    color:      '#0F172A',
  } as React.CSSProperties,

  dangerRowDesc: {
    margin:     '4px 0 0',
    fontSize:   12.5,
    color:      '#64748B',
    lineHeight: 1.55,
    maxWidth:   480,
  } as React.CSSProperties,

  dangerBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '8px 16px',
    background:   'transparent',
    border:       '1.5px solid #D62B38',
    borderRadius: 7,
    fontSize:     13,
    fontWeight:   600,
    color:        '#D62B38',
    cursor:       'pointer',
    whiteSpace:   'nowrap' as const,
    flexShrink:   0,
  } as React.CSSProperties,

  // ── Toast ─────────────────────────────────────────────────────────────────────
  toast: {
    position:      'fixed' as const,
    top:           20,
    left:          '50%',
    zIndex:        9999,
    display:       'flex',
    alignItems:    'center',
    gap:           8,
    padding:       '10px 16px',
    borderRadius:  8,
    fontSize:      13,
    fontWeight:    500,
    boxShadow:     '0 4px 20px rgba(0,0,0,0.10)',
    maxWidth:      460,
    lineHeight:    1.4,
    pointerEvents: 'none' as const,
    whiteSpace:    'nowrap' as const,
  } as React.CSSProperties,

  toastSuccess: {
    background: '#F0FDF4',
    border:     '1px solid #BBF7D0',
    color:      '#166534',
  } as React.CSSProperties,

  toastError: {
    background: '#FEF2F2',
    border:     '1px solid #FECACA',
    color:      '#991B1B',
  } as React.CSSProperties,

  // ── Modal ─────────────────────────────────────────────────────────────────────
  backdrop: {
    position:   'fixed' as const,
    inset:      0,
    zIndex:     1000,
    background: 'rgba(15, 23, 42, 0.42)',
    backdropFilter: 'blur(3px)',
  } as React.CSSProperties,

  modalPanel: {
    position:     'fixed' as const,
    top:          '50%',
    left:         '50%',
    transform:    'translate(-50%, -50%)',
    zIndex:       1001,
    width:        '100%',
    maxWidth:     450,
    background:   '#FFFFFF',
    border:       '1px solid #E2E8F0',
    borderRadius: 14,
    padding:      '26px 26px 22px',
    boxShadow:    '0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)',
  } as React.CSSProperties,

  modalCloseBtn: {
    position:       'absolute' as const,
    top:            12,
    right:          12,
    background:     'transparent',
    border:         '1px solid #E2E8F0',
    borderRadius:   6,
    padding:        5,
    cursor:         'pointer',
    color:          '#6B7280',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    lineHeight:     0,
  } as React.CSSProperties,

  modalIconWrap: {
    width:          42,
    height:         42,
    borderRadius:   10,
    background:     'rgba(214,43,56,0.08)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   14,
  } as React.CSSProperties,

  modalTitle: {
    margin:        0,
    fontSize:      16,
    fontWeight:    700,
    color:         '#0F172A',
    letterSpacing: '-0.02em',
    marginBottom:  6,
  } as React.CSSProperties,

  modalDesc: {
    margin:     0,
    fontSize:   13,
    color:      '#64748B',
    lineHeight: 1.6,
  } as React.CSSProperties,

  inputLabel: {
    display:       'block',
    fontSize:      12,
    fontWeight:    600,
    color:         '#374151',
    marginBottom:  5,
    letterSpacing: '-0.005em',
  } as React.CSSProperties,

  modalInput: {
    display:      'block',
    width:        '100%',
    padding:      '9px 12px',
    border:       '1.5px solid #E2E8F0',
    borderRadius: 7,
    fontSize:     13,
    color:        '#0F172A',
    background:   '#FAFAFA',
    outline:      'none',
    boxSizing:    'border-box' as const,
    fontFamily:   'system-ui, -apple-system, sans-serif',
    transition:   'border-color 0.15s',
  } as React.CSSProperties,

  fieldError: {
    margin:     '5px 0 0',
    fontSize:   11.5,
    color:      '#D62B38',
    fontWeight: 500,
  } as React.CSSProperties,

  fieldHint: {
    margin:    '4px 0 0',
    fontSize:  11,
    color:     '#9CA3AF',
    lineHeight: 1.4,
  } as React.CSSProperties,

  warningStripe: {
    display:      'flex',
    alignItems:   'flex-start',
    gap:          8,
    padding:      '10px 12px',
    background:   '#FFFBEB',
    border:       '1px solid #FDE68A',
    borderRadius: 7,
    marginTop:    10,
    marginBottom: 14,
  } as React.CSSProperties,

  confirmPreview: {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    padding:      '8px 12px',
    background:   '#F8FAFC',
    border:       '1px solid #E2E8F0',
    borderRadius: 7,
    marginBottom: 4,
  } as React.CSSProperties,

  confirmPreviewLabel: {
    fontSize:   11,
    fontWeight: 600,
    color:      '#6B7280',
    flexShrink: 0,
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  confirmPreviewValue: {
    fontSize:     13,
    fontWeight:   600,
    color:        '#0F172A',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap' as const,
  } as React.CSSProperties,

  modalActions: {
    display:        'flex',
    gap:            8,
    justifyContent: 'flex-end',
    marginTop:      18,
  } as React.CSSProperties,

  btnGhost: {
    padding:      '8px 16px',
    border:       '1px solid #E2E8F0',
    borderRadius: 7,
    background:   'transparent',
    color:        '#64748B',
    fontSize:     13,
    fontWeight:   500,
    cursor:       'pointer',
  } as React.CSSProperties,

  btnDark: {
    padding:      '8px 18px',
    border:       'none',
    borderRadius: 7,
    background:   '#0F172A',
    color:        '#FFFFFF',
    fontSize:     13,
    fontWeight:   600,
    cursor:       'pointer',
    transition:   'opacity 0.15s',
  } as React.CSSProperties,

  btnDanger: {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '8px 18px',
    border:       'none',
    borderRadius: 7,
    background:   '#D62B38',
    color:        '#FFFFFF',
    fontSize:     13,
    fontWeight:   600,
    letterSpacing: '-0.005em',
    transition:   'opacity 0.15s',
  } as React.CSSProperties,
} as const;
