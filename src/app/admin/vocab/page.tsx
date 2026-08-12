'use client';

/**
 * /admin/vocab — LexiCore Admin Settings
 *
 * Controls:
 *   - Ultimate Achievements visibility toggle (retroactive batch award on enable)
 *   - Quiz pass threshold
 *   - Phase cut-off date
 *
 * Light mode, admin only. Redirects to sign-in if session is missing or role
 * is not admin.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  Zap,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';
import {
  RED, RED_DARK, SLATE, BORDER, BORDER_FIELD, MUTED, BG, SURFACE, SURFACE_ALT,
  BEIGE, INK_SOFT, OK, OK_BG, WARN, WARN_BG, INFO, INFO_BG,
  T_SM, T_BASE, T_MD, T_XL, R_SM, R_MD, R_LG, R_PILL,
  SHADOW_LG, SHADOW_SM, FONT_HEADING, Z_TOAST,
} from '@/components/admin/lms/lms-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminSettings {
  ultimate_achievements_visible: string;
  quiz_pass_threshold:           string;
  phase_cutoff_date:             string;
  [key: string]: string;
}

interface ToastState {
  type:    'success' | 'error' | 'info';
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseThreshold(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 70 : Math.round(n * 100);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VocabAdminPage() {
  const { data: session, status } = useSession();
  const router                    = useRouter();

  const [settings,       setSettings]      = useState<AdminSettings | null>(null);
  const [loading,        setLoading]       = useState(true);
  const [ultimateLoading,setUltimateLoad]  = useState(false);
  const [thresholdEdit,  setThresholdEdit] = useState('');
  const [thresholdSaving,setThresholdSave] = useState(false);
  const [cutoffEdit,     setCutoffEdit]    = useState('');
  const [cutoffSaving,   setCutoffSave]    = useState(false);
  const [toast,          setToast]         = useState<ToastState | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated' && !session.user?.isAdmin) router.push('/');
  }, [status, session, router]);

  // ── Fetch settings ──────────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/vocab/admin/settings');
      const data = await res.json() as AdminSettings;
      setSettings(data);
      setThresholdEdit(String(parseThreshold(data.quiz_pass_threshold)));
      setCutoffEdit(data.phase_cutoff_date ?? '');
    } catch {
      showToast('error', 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session.user?.isAdmin) {
      fetchSettings();
    }
  }, [status, session, fetchSettings]);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  function showToast(type: ToastState['type'], message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  }

  // ── Toggle ultimate achievements ─────────────────────────────────────────────
  async function handleUltimateToggle() {
    if (!settings) return;
    const enabling = settings.ultimate_achievements_visible !== 'true';
    setUltimateLoad(true);

    try {
      const res  = await fetch('/api/vocab/admin/ultimate-toggle', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ enable: enabling }),
      });
      const data = await res.json();

      setSettings(prev => prev
        ? { ...prev, ultimate_achievements_visible: String(enabling) }
        : prev
      );

      if (enabling && data.badgesAwarded !== undefined) {
        showToast('success',
          `Ultimate achievements enabled. ` +
          `Checked ${data.usersChecked} user(s) — awarded ${data.badgesAwarded} badge(s) retroactively.`
        );
      } else {
        showToast('info', 'Ultimate achievements hidden from users.');
      }
    } catch {
      showToast('error', 'Toggle failed. Please try again.');
    } finally {
      setUltimateLoad(false);
    }
  }

  // ── Save quiz pass threshold ─────────────────────────────────────────────────
  async function handleThresholdSave() {
    const pct   = parseInt(thresholdEdit, 10);
    if (isNaN(pct) || pct < 1 || pct > 100) {
      showToast('error', 'Threshold must be 1–100.');
      return;
    }
    setThresholdSave(true);
    try {
      await fetch('/api/vocab/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: 'quiz_pass_threshold', value: String(pct / 100) }),
      });
      setSettings(prev => prev
        ? { ...prev, quiz_pass_threshold: String(pct / 100) }
        : prev
      );
      showToast('success', `Pass threshold updated to ${pct}%.`);
    } catch {
      showToast('error', 'Failed to save threshold.');
    } finally {
      setThresholdSave(false);
    }
  }

  // ── Save phase cut-off date ──────────────────────────────────────────────────
  async function handleCutoffSave() {
    setCutoffSave(true);
    try {
      await fetch('/api/vocab/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: 'phase_cutoff_date', value: cutoffEdit }),
      });
      setSettings(prev => prev
        ? { ...prev, phase_cutoff_date: cutoffEdit }
        : prev
      );
      showToast('success', 'Phase cut-off date saved.');
    } catch {
      showToast('error', 'Failed to save cut-off date.');
    } finally {
      setCutoffSave(false);
    }
  }

  // ── Render guards ─────────────────────────────────────────────────────────────
  // Show loading state during auth check AND during settings fetch to prevent content flash
  if (status === 'loading' || (status === 'authenticated' && loading) ||
      (status === 'unauthenticated') ||
      (status === 'authenticated' && !session?.user?.isAdmin)) {
    return (
      <div style={styles.centerPage}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: RED }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!settings) return null;

  const ultimateOn = settings.ultimate_achievements_visible === 'true';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>

      {/* Toast */}
      {toast && (
        <div style={{ ...styles.toast, ...styles.toastVariant[toast.type] }}>
          {toast.type === 'success' && <CheckCircle size={15} />}
          {toast.type === 'error'   && <AlertTriangle size={15} />}
          {toast.type === 'info'    && <Zap size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <button
          onClick={() => router.back()}
          style={styles.backBtn}
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <div>
          <h1 style={styles.title}>LexiCore Admin</h1>
          <p style={styles.subtitle}>Vocabulary game settings &amp; controls</p>
        </div>
        <button
          onClick={fetchSettings}
          style={styles.refreshBtn}
          aria-label="Refresh settings"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Cards */}
      <div style={styles.cards}>

        {/* ── Ultimate Achievements ─────────────────────────────────── */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.iconBadge, background: ultimateOn ? WARN_BG : SURFACE_ALT }}>
              <Trophy size={18} color={ultimateOn ? WARN : MUTED} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={styles.cardTitle}>Ultimate Achievements</h2>
              <p style={styles.cardDesc}>
                {ultimateOn
                  ? 'Currently visible to all users.'
                  : 'Hidden from users. Qualifying users will be awarded retroactively when enabled.'}
              </p>
            </div>
            {/* Toggle switch */}
            <button
              onClick={handleUltimateToggle}
              disabled={ultimateLoading}
              aria-pressed={ultimateOn}
              style={{
                ...styles.toggle,
                background:   ultimateOn ? RED : BEIGE,
                cursor:       ultimateLoading ? 'wait' : 'pointer',
                opacity:      ultimateLoading ? 0.7 : 1,
              }}
            >
              <span
                style={{
                  ...styles.toggleKnob,
                  transform: ultimateOn ? 'translateX(20px)' : 'translateX(2px)',
                }}
              >
                {ultimateLoading && (
                  <Loader2
                    size={10}
                    style={{ animation: 'spin 1s linear infinite', color: MUTED }}
                  />
                )}
              </span>
            </button>
          </div>

          {ultimateOn && (
            <div style={styles.warningBox}>
              <AlertTriangle size={13} color={WARN} />
              <span style={{ fontSize: T_SM, color: WARN }}>
                Disabling will hide these badges from the UI but will not revoke already-awarded badges.
              </span>
            </div>
          )}
        </section>

        {/* ── Quiz Pass Threshold ───────────────────────────────────── */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.iconBadge, background: OK_BG }}>
              <CheckCircle size={18} color={OK} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={styles.cardTitle}>Quiz Pass Threshold</h2>
              <p style={styles.cardDesc}>
                Minimum score (%) required to pass a study quiz. Default: 70%.
              </p>
            </div>
          </div>
          <div style={styles.inputRow}>
            <div style={styles.inputWrap}>
              <input
                type="number"
                min={1}
                max={100}
                value={thresholdEdit}
                onChange={e => setThresholdEdit(e.target.value)}
                style={styles.input}
                aria-label="Pass threshold percent"
              />
              <span style={styles.inputSuffix}>%</span>
            </div>
            <button
              onClick={handleThresholdSave}
              disabled={thresholdSaving}
              style={styles.saveBtn}
            >
              {thresholdSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save'}
            </button>
          </div>
        </section>

        {/* ── Phase Cut-off Date ────────────────────────────────────── */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.iconBadge, background: `${RED}14` }}>
              <Calendar size={18} color={RED} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={styles.cardTitle}>Phase 1 Cut-off Date</h2>
              <p style={styles.cardDesc}>
                Users who registered after this date are Phase 2 (limited access).
              </p>
            </div>
          </div>
          <div style={styles.inputRow}>
            <input
              type="date"
              value={cutoffEdit}
              onChange={e => setCutoffEdit(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
              aria-label="Phase cut-off date"
            />
            <button
              onClick={handleCutoffSave}
              disabled={cutoffSaving}
              style={styles.saveBtn}
            >
              {cutoffSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save'}
            </button>
          </div>
        </section>

      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight:       '100vh',
    background:      BG,
    color:           SLATE,
    padding:         '24px 16px 48px',
    maxWidth:        '680px',
    margin:          '0 auto',
  } as React.CSSProperties,

  centerPage: {
    minHeight:       '100vh',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    background:      BG,
  } as React.CSSProperties,

  toast: {
    position:      'fixed',
    top:           20,
    left:          '50%',
    transform:     'translateX(-50%)',
    zIndex:        Z_TOAST,
    display:       'flex',
    alignItems:    'center',
    gap:           8,
    padding:       '10px 18px',
    borderRadius:  R_MD,
    fontSize:      T_BASE,
    fontWeight:    500,
    boxShadow:     SHADOW_LG,
    maxWidth:      'min(480px, calc(100vw - 32px))',
    whiteSpace:    'normal',
    wordBreak:     'break-word',
  } as React.CSSProperties,

  toastVariant: {
    success: {
      background: OK_BG,
      color:      OK,
      border:     `1px solid ${OK}40`,
    },
    error: {
      background: `${RED}14`,
      color:      RED_DARK,
      border:     `1px solid ${RED}33`,
    },
    info: {
      background: INFO_BG,
      color:      INFO,
      border:     `1px solid ${INFO}33`,
    },
  },

  header: {
    display:        'flex',
    alignItems:     'flex-start',
    gap:            12,
    marginBottom:   28,
    paddingTop:     8,
  } as React.CSSProperties,

  backBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          4,
    background:   'transparent',
    border:       `1px solid ${BORDER}`,
    borderRadius: R_SM,
    padding:      '6px 10px',
    fontSize:     T_BASE,
    color:        MUTED,
    cursor:       'pointer',
    whiteSpace:   'nowrap' as const,
    marginTop:    4,
    minHeight:    40,
  } as React.CSSProperties,

  title: {
    margin:        0,
    fontSize:      T_XL,
    fontWeight:    700,
    fontFamily:    FONT_HEADING,
    color:         SLATE,
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  subtitle: {
    margin:     '2px 0 0',
    fontSize:   T_BASE,
    color:      MUTED,
    fontWeight: 400,
  } as React.CSSProperties,

  refreshBtn: {
    marginLeft:   'auto',
    marginTop:    6,
    background:   'transparent',
    border:       `1px solid ${BORDER}`,
    borderRadius: R_SM,
    padding:      8,
    cursor:       'pointer',
    color:        INK_SOFT,
    display:      'flex',
    alignItems:   'center',
    minWidth:     40,
    minHeight:    40,
    justifyContent: 'center',
  } as React.CSSProperties,

  cards: {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           16,
  } as React.CSSProperties,

  card: {
    background:   SURFACE,
    border:       `1px solid ${BORDER}`,
    borderRadius: R_LG,
    padding:      20,
  } as React.CSSProperties,

  cardHeader: {
    display:     'flex',
    alignItems:  'flex-start',
    gap:         14,
    marginBottom: 0,
  } as React.CSSProperties,

  iconBadge: {
    width:          38,
    height:         38,
    borderRadius:   R_MD,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  } as React.CSSProperties,

  cardTitle: {
    margin:     0,
    fontSize:   T_MD,
    fontWeight: 600,
    color:      SLATE,
  } as React.CSSProperties,

  cardDesc: {
    margin:     '3px 0 0',
    fontSize:   T_SM,
    color:      MUTED,
    lineHeight: 1.5,
  } as React.CSSProperties,

  toggle: {
    position:     'relative' as const,
    width:        44,
    height:       24,
    borderRadius: R_PILL,
    border:       'none',
    flexShrink:   0,
    transition:   'background 0.2s',
    display:      'flex',
    alignItems:   'center',
    minHeight:    40,
    cursor:       'pointer',
  } as React.CSSProperties,

  toggleKnob: {
    position:       'absolute' as const,
    width:          20,
    height:         20,
    borderRadius:   '50%',
    background:     SURFACE,
    boxShadow:      SHADOW_SM,
    transition:     'transform 0.2s',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  warningBox: {
    marginTop:    12,
    padding:      '8px 12px',
    background:   WARN_BG,
    border:       `1px solid ${WARN}40`,
    borderRadius: R_SM,
    display:      'flex',
    alignItems:   'flex-start',
    gap:          6,
  } as React.CSSProperties,

  inputRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         10,
    marginTop:   14,
  } as React.CSSProperties,

  inputWrap: {
    position:   'relative' as const,
    display:    'flex',
    alignItems: 'center',
  } as React.CSSProperties,

  input: {
    padding:      '11px 12px',
    border:       `1px solid ${BORDER_FIELD}`,
    borderRadius: R_SM,
    fontSize:     T_MD,
    color:        SLATE,
    background:   SURFACE,
    outline:      'none',
    width:        80,
  } as React.CSSProperties,

  inputSuffix: {
    position:      'absolute' as const,
    right:         10,
    fontSize:      T_BASE,
    color:         MUTED,
    pointerEvents: 'none' as const,
  } as React.CSSProperties,

  saveBtn: {
    padding:        '11px 18px',
    background:     RED,
    color:          SURFACE,
    border:         'none',
    borderRadius:   R_SM,
    fontSize:       T_BASE,
    fontWeight:     600,
    cursor:         'pointer',
    display:        'flex',
    alignItems:     'center',
    gap:            6,
    minWidth:       64,
    minHeight:      44,
    justifyContent: 'center',
  } as React.CSSProperties,
} as const;
