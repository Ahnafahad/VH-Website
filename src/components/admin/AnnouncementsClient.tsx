'use client';

/**
 * AnnouncementsClient
 *
 * Compose + preview UI for broadcasting an announcement email. Light mode,
 * clean editorial aesthetic consistent with the admin panel.
 *
 * Features:
 *   - Subject input (max 100) + character counter
 *   - Body textarea (max 5 000) + character counter
 *   - Audience targeting: everyone / batch × product / specific students
 *     (shared resolver — src/lib/audience/resolve.ts)
 *   - Live side-by-side HTML preview (dark email-branded panel)
 *   - Recipient count badge, recomputed per audience selection
 *   - Send button → confirmation modal → POST → inline result toast
 *   - Form resets on successful send
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Megaphone,
  Users,
  Eye,
  Send,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Info,
  TriangleAlert,
} from 'lucide-react';
import {
  RED, RED_DARK, SLATE, BORDER, BORDER_FIELD, MUTED, SURFACE, SURFACE_ALT, SURFACE_SHELL,
  BEIGE, INK_SOFT, OK, OK_BG, WARN, WARN_BG, INFO, INFO_BG,
  R_SM, R_MD, R_LG, R_XL, R_PILL, SHADOW_MD, SHADOW_LG, FONT_HEADING,
  T_XS, T_SM, T_BASE, T_MD, T_LG, Z_MODAL, Z_TOAST,
} from './lms/lms-shared';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AudienceBatch {
  id: number;
  name: string;
  product: string;
}

interface AnnouncementsClientProps {
  recipientCount: number;
  adminName: string;
  batches: AudienceBatch[];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'warning' | 'error';

interface ToastState {
  type: ToastType;
  message: string;
}

interface SendResult {
  success: number;
  failed: number;
  total: number;
  sentAt: string;
}

// ─── Audience selector types ───────────────────────────────────────────────────
// Mirrors AudienceSelection in src/lib/audience/resolve.ts — the same shared
// shape the LMS announcement feed's targeting uses.

type AudienceMode = 'everyone' | 'batchProduct' | 'individuals';
type AudienceProduct = 'iba' | 'fbs' | 'fbs_detailed';

interface IndividualPick {
  id: number;
  name: string;
  email: string;
}

type AudiencePayload =
  | { mode: 'everyone' }
  | { mode: 'batchProduct'; product: AudienceProduct; batch: string | null }
  | { mode: 'individuals'; userIds: number[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_MAX = 100;
const BODY_MAX    = 5000;

// ─── Motion variants ──────────────────────────────────────────────────────────

const pageVariants: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 280,
      damping: 26,
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const childVariants: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
};

const modalBackdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.14 } },
};

const modalPanelVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 340, damping: 26 },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: { duration: 0.12 },
  },
};

const toastVariants: Variants = {
  hidden:  { opacity: 0, y: -12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 360, damping: 26 },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    transition: { duration: 0.15 },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function counterColor(current: number, max: number): string {
  const pct = current / max;
  if (pct >= 0.95) return RED;
  if (pct >= 0.80) return WARN;
  return MUTED;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CharCounter({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  return (
    <span
      style={{
        fontSize:      T_XS,
        fontWeight:    500,
        color:         counterColor(current, max),
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.01em',
        transition:    'color 0.2s',
      }}
    >
      {current} / {max}
    </span>
  );
}

function RecipientBadge({ count, loading }: { count: number; loading?: boolean }) {
  return (
    <div
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          6,
        padding:      '5px 12px',
        background:   INFO_BG,
        border:       `1px solid ${INFO}33`,
        borderRadius: R_PILL,
        fontSize:     12.5,
        fontWeight:   500,
        color:        INFO,
      }}
    >
      <Users size={13} aria-hidden />
      {loading
        ? 'Counting recipients…'
        : count === 0
          ? 'No recipients'
          : `Will be sent to ${count.toLocaleString()} user${count === 1 ? '' : 's'}`}
    </div>
  );
}

// ─── Audience selector ─────────────────────────────────────────────────────────
// Targeting: batch × product, or individual students, or everyone (preserves
// the pre-targeting behaviour as an explicit, still-selectable option).

const audienceModeStyles = (active: boolean): React.CSSProperties => ({
  padding:      '7px 14px',
  borderRadius: 7,
  fontSize:     12.5,
  fontWeight:   500,
  cursor:       'pointer',
  border:       `1px solid ${active ? RED : BORDER_FIELD}`,
  background:   active ? `${RED}0F` : SURFACE,
  color:        active ? RED : INK_SOFT,
  transition:   'border-color 0.15s, background 0.15s, color 0.15s',
});

const selectStyle: React.CSSProperties = {
  padding:      '8px 10px',
  border:       `1px solid ${BORDER_FIELD}`,
  borderRadius: 7,
  fontSize:     T_BASE,
  color:        SLATE,
  background:   SURFACE_SHELL,
  fontFamily:   'inherit',
  width:        '100%',
  boxSizing:    'border-box',
};

function IndividualPicker({
  selected,
  onChange,
}: {
  selected: IndividualPick[];
  onChange: (next: IndividualPick[]) => void;
}) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<IndividualPick[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/users?search=${encodeURIComponent(query.trim())}&limit=8`)
        .then(res => res.json())
        .then((data: { users?: IndividualPick[] }) => setResults(data.users ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const addPick = (pick: IndividualPick) => {
    if (selected.some(s => s.id === pick.id)) return;
    onChange([...selected, pick]);
    setQuery('');
    setResults([]);
  };

  const removePick = (id: number) => onChange(selected.filter(s => s.id !== id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          style={selectStyle}
        />
        {(results.length > 0 || loading) && (
          <div
            style={{
              position:     'absolute',
              top:          '100%',
              left:         0,
              right:        0,
              marginTop:    4,
              background:   SURFACE,
              border:       `1px solid ${BORDER}`,
              borderRadius: 7,
              boxShadow:    SHADOW_MD,
              zIndex:       10,
              maxHeight:    200,
              overflowY:    'auto',
            }}
          >
            {loading && (
              <div style={{ padding: '8px 12px', fontSize: T_SM, color: MUTED }}>Searching…</div>
            )}
            {!loading && results.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => addPick(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontSize: 12.5, color: SLATE,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}
              >
                {r.name} <span style={{ color: MUTED }}>({r.email})</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {selected.map(s => (
            <span
              key={s.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 8px', borderRadius: R_XL, fontSize: 11.5,
                background: INFO_BG, border: `1px solid ${INFO}33`, color: INFO,
              }}
            >
              {s.name}
              <button
                type="button"
                onClick={() => removePick(s.id)}
                aria-label={`Remove ${s.name}`}
                style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: INFO, padding: 0 }}
              >
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AudienceSelector({
  mode, onModeChange,
  product, onProductChange,
  batch, onBatchChange,
  individuals, onIndividualsChange,
  batches,
}: {
  mode: AudienceMode;
  onModeChange: (m: AudienceMode) => void;
  product: AudienceProduct;
  onProductChange: (p: AudienceProduct) => void;
  batch: string | null;
  onBatchChange: (b: string | null) => void;
  individuals: IndividualPick[];
  onIndividualsChange: (v: IndividualPick[]) => void;
  batches: AudienceBatch[];
}) {
  const batchOptions = batches.filter(b => b.product === product);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={audienceModeStyles(mode === 'everyone')} onClick={() => onModeChange('everyone')}>
          Everyone
        </button>
        <button type="button" style={audienceModeStyles(mode === 'batchProduct')} onClick={() => onModeChange('batchProduct')}>
          Batch &amp; product
        </button>
        <button type="button" style={audienceModeStyles(mode === 'individuals')} onClick={() => onModeChange('individuals')}>
          Specific students
        </button>
      </div>

      {mode === 'batchProduct' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <select
            value={product}
            onChange={e => { onProductChange(e.target.value as AudienceProduct); onBatchChange(null); }}
            style={selectStyle}
            aria-label="Product"
          >
            <option value="iba">IBA</option>
            <option value="fbs">FBS</option>
            <option value="fbs_detailed">FBS Detailed</option>
          </select>
          <select
            value={batch ?? ''}
            onChange={e => onBatchChange(e.target.value ? e.target.value : null)}
            style={selectStyle}
            aria-label="Batch"
          >
            <option value="">All batches</option>
            {batchOptions.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {mode === 'individuals' && (
        <IndividualPicker selected={individuals} onChange={onIndividualsChange} />
      )}
    </div>
  );
}

// ─── Email Preview ─────────────────────────────────────────────────────────────

function EmailPreview({
  subject,
  body,
  adminName,
}: {
  subject: string;
  body: string;
  adminName: string;
}) {
  const isEmpty = !subject && !body;

  return (
    <div
      style={{
        background:   SLATE,
        borderRadius: R_MD,
        overflow:     'hidden',
        height:       '100%',
        display:      'flex',
        flexDirection: 'column',
        minHeight:    320,
      }}
    >
      {/* Email header band */}
      <div
        style={{
          background: RED,
          padding:    '16px 20px',
          flexShrink: 0,
        }}
      >
        <p
          style={{
            margin:         0,
            fontSize:       9,
            letterSpacing:  '3px',
            textTransform:  'uppercase',
            color:          `${SURFACE}A6`,
            marginBottom:   4,
          }}
        >
          VH LexiCore — Announcement
        </p>
        <h3
          style={{
            margin:        0,
            fontFamily:    FONT_HEADING,
            fontSize:      subject ? 15 : 13,
            fontWeight:    400,
            color:         subject ? SURFACE : `${SURFACE}66`,
            letterSpacing: '0.3px',
            lineHeight:    1.3,
            fontStyle:     subject ? 'normal' : 'italic',
          }}
        >
          {subject || 'Subject preview…'}
        </h3>
      </div>

      {/* Email body */}
      <div
        style={{
          flex:       1,
          padding:    '20px',
          fontSize:   13.5,
          lineHeight: 1.75,
          color:      BORDER,
          overflowY:  'auto',
        }}
      >
        {isEmpty ? (
          <p
            style={{
              margin:     0,
              color:      BEIGE,
              fontStyle:  'italic',
              fontSize:   T_BASE,
            }}
          >
            Your message body will appear here. Supports basic HTML formatting.
          </p>
        ) : (
          /* Safe here — admin-only page, server further sanitizes before sending */
          <div
            dangerouslySetInnerHTML={{ __html: body || '' }}
          />
        )}
      </div>

      {/* Footer */}
      {!isEmpty && (
        <div
          style={{
            borderTop:  `1px solid ${INK_SOFT}`,
            padding:    '12px 20px',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              margin:    0,
              fontSize:  T_XS,
              color:     BEIGE,
              lineHeight: 1.6,
            }}
          >
            Sent by {adminName} via VH LexiCore Admin
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnnouncementsClient({
  recipientCount: initialRecipientCount,
  adminName,
  batches,
}: AnnouncementsClientProps) {
  const [subject,      setSubject]      = useState('');
  const [body,         setBody]         = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [sending,      setSending]      = useState(false);
  const [toast,        setToast]        = useState<ToastState | null>(null);
  const toastTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmBtnRef                   = useRef<HTMLButtonElement>(null);

  // ── Audience targeting ───────────────────────────────────────────────────────
  const [audienceMode,    setAudienceMode]    = useState<AudienceMode>('everyone');
  const [audienceProduct, setAudienceProduct] = useState<AudienceProduct>('iba');
  const [audienceBatch,   setAudienceBatch]   = useState<string | null>(null);
  const [individuals,     setIndividuals]     = useState<IndividualPick[]>([]);
  const [recipientCount,  setRecipientCount]  = useState(initialRecipientCount);
  const [countLoading,    setCountLoading]    = useState(false);

  const audience: AudiencePayload = useMemo(() => (
    audienceMode === 'everyone'       ? { mode: 'everyone' }
    : audienceMode === 'batchProduct' ? { mode: 'batchProduct', product: audienceProduct, batch: audienceBatch }
    : { mode: 'individuals', userIds: individuals.map(i => i.id) }
  ), [audienceMode, audienceProduct, audienceBatch, individuals]);

  // Recompute the recipient count whenever the audience selection changes.
  // "everyone" reuses the server-provided initial count (that count can't
  // change based on client-side selections); "individuals" is just the
  // number of picked users; "batchProduct" needs a server round trip.
  useEffect(() => {
    if (audienceMode === 'everyone') {
      setRecipientCount(initialRecipientCount);
      return;
    }
    if (audienceMode === 'individuals') {
      setRecipientCount(individuals.length);
      return;
    }
    let cancelled = false;
    setCountLoading(true);
    const params = new URLSearchParams({ mode: 'batchProduct', product: audienceProduct });
    if (audienceBatch) params.set('batch', audienceBatch);
    fetch(`/api/admin/announcements?${params.toString()}`)
      .then(res => res.json())
      .then((data: { recipientCount?: number }) => {
        if (!cancelled) setRecipientCount(data.recipientCount ?? 0);
      })
      .catch(() => { if (!cancelled) setRecipientCount(0); })
      .finally(() => { if (!cancelled) setCountLoading(false); });
    return () => { cancelled = true; };
  }, [audienceMode, audienceProduct, audienceBatch, individuals, initialRecipientCount]);

  // Auto-focus confirm button when modal opens
  useEffect(() => {
    if (modalOpen) {
      const t = setTimeout(() => confirmBtnRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [modalOpen]);

  // Dismiss toast on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Warn before an accidental tab close / refresh discards an unsent draft
  useEffect(() => {
    const hasDraft = subject.trim().length > 0 || body.trim().length > 0;
    if (!hasDraft || sending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [subject, body, sending]);

  // ── Toast helper ─────────────────────────────────────────────────────────────

  const showToast = useCallback((type: ToastType, message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Send announcement ─────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (sending) return;
    setModalOpen(false);
    setSending(true);

    try {
      const res = await fetch('/api/admin/announcements', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subject: subject.trim(), body: body.trim(), audience }),
      });

      const data = await res.json() as SendResult & { error?: string };

      if (!res.ok) {
        showToast('error', data.error ?? 'Failed to send announcement.');
        return;
      }

      if (data.failed > 0 && data.success > 0) {
        showToast(
          'warning',
          `Sent to ${data.success.toLocaleString()} user${data.success === 1 ? '' : 's'}, ` +
          `${data.failed} failed.`
        );
      } else if (data.success === 0) {
        showToast('error', `Failed to send to all ${data.total} recipients.`);
        return;
      } else {
        showToast(
          'success',
          `Announcement sent to ${data.success.toLocaleString()} user${data.success === 1 ? '' : 's'}.`
        );
      }

      // Reset form on any partial or full success
      setSubject('');
      setBody('');
    } catch {
      showToast('error', 'Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }, [sending, subject, body, audience, showToast]);

  // ── Keyboard: close modal on Escape ─────────────────────────────────────────

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  // ── Derived state ────────────────────────────────────────────────────────────

  const audienceValid = audienceMode !== 'individuals' || individuals.length > 0;
  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending && audienceValid;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key="toast"
            variants={toastVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="status"
            aria-live="polite"
            style={{
              position:    'fixed',
              top:         20,
              left:        '50%',
              transform:   'translateX(-50%)',
              zIndex:      Z_TOAST,
              display:     'flex',
              alignItems:  'center',
              gap:         8,
              padding:     '10px 18px',
              borderRadius: R_MD,
              fontSize:    T_BASE,
              fontWeight:  500,
              boxShadow:   SHADOW_LG,
              maxWidth:    480,
              whiteSpace:  'nowrap',
              ...(toast.type === 'success' && {
                background: OK_BG,
                color:      OK,
                border:     `1px solid ${OK}33`,
              }),
              ...(toast.type === 'warning' && {
                background: WARN_BG,
                color:      WARN,
                border:     `1px solid ${WARN}33`,
              }),
              ...(toast.type === 'error' && {
                background: `${RED}0F`,
                color:      RED_DARK,
                border:     `1px solid ${RED}33`,
              }),
            }}
          >
            {toast.type === 'success' && <CheckCircle size={15} aria-hidden />}
            {toast.type === 'warning' && <TriangleAlert size={15} aria-hidden />}
            {toast.type === 'error'   && <AlertTriangle size={15} aria-hidden />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirmation modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            key="modal-backdrop"
            variants={modalBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setModalOpen(false)}
            style={{
              position:        'fixed',
              inset:           0,
              zIndex:          Z_MODAL,
              background:      `${SLATE}59`,
              backdropFilter:  'blur(3px)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              padding:         16,
            }}
            aria-label="Confirmation dialog backdrop"
          >
            <motion.div
              key="modal-panel"
              variants={modalPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              onClick={e => e.stopPropagation()}
              style={{
                background:   SURFACE,
                borderRadius: 12,
                padding:      28,
                width:        '100%',
                maxWidth:     440,
                boxShadow:    SHADOW_LG,
                border:       `1px solid ${BORDER}`,
              }}
            >
              {/* Icon + title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <div
                  style={{
                    width:          40,
                    height:         40,
                    borderRadius:   R_LG,
                    background:     `${RED}0F`,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                  }}
                >
                  <Send size={18} color={RED} aria-hidden />
                </div>
                <div>
                  <h2
                    id="modal-title"
                    style={{
                      margin:        0,
                      fontSize:      T_LG,
                      fontWeight:    700,
                      color:         SLATE,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Send announcement?
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: T_BASE, color: MUTED, lineHeight: 1.5 }}>
                    This will send an email to&nbsp;
                    <strong style={{ color: SLATE }}>
                      {recipientCount.toLocaleString()} user{recipientCount === 1 ? '' : 's'}
                    </strong>.
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              {/* Subject preview */}
              <div
                style={{
                  background:   SURFACE_ALT,
                  border:       `1px solid ${BORDER}`,
                  borderRadius: R_SM,
                  padding:      '10px 14px',
                  marginBottom: 22,
                }}
              >
                <p
                  style={{
                    margin:        0,
                    fontSize:      10,
                    fontWeight:    600,
                    color:         MUTED,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom:  4,
                  }}
                >
                  Subject
                </p>
                <p
                  style={{
                    margin:        0,
                    fontSize:      T_BASE,
                    color:         SLATE,
                    fontWeight:    500,
                    lineHeight:    1.4,
                    wordBreak:     'break-word',
                  }}
                >
                  {subject}
                </p>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setModalOpen(false)}
                  style={s.cancelBtn}
                >
                  Cancel
                </button>
                <motion.button
                  ref={confirmBtnRef}
                  onClick={handleSend}
                  whileHover={{ filter: 'brightness(1.08)' }}
                  whileTap={{ scale: 0.97 }}
                  style={s.confirmBtn}
                  aria-label={`Confirm send to ${recipientCount} users`}
                >
                  <Send size={14} aria-hidden />
                  Send now
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page ──────────────────────────────────────────────────────────── */}
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        style={s.page}
      >
        {/* Header */}
        <motion.div variants={childVariants} style={s.header}>
          <div
            style={{
              width:          40,
              height:         40,
              borderRadius:   R_LG,
              background:     `${RED}0F`,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            }}
          >
            <Megaphone size={20} color={RED} aria-hidden />
          </div>
          <div>
            <h1 style={s.pageTitle}>Announcements</h1>
            <p style={s.pageSubtitle}>
              Compose and broadcast a message to everyone, a batch, or specific students.
            </p>
          </div>
        </motion.div>

        {/* Compose + Preview grid */}
        <motion.div variants={childVariants} style={s.grid}>

          {/* ── Left: Compose form ─────────────────────────────────────────── */}
          <section style={s.card} aria-label="Compose announcement">

            {/* Section label */}
            <div style={s.sectionLabel}>
              <div
                style={{
                  width:  6,
                  height: 6,
                  borderRadius: '50%',
                  background: RED,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
              Compose
            </div>

            {/* Subject */}
            <div style={s.fieldGroup}>
              <div style={s.fieldLabelRow}>
                <label htmlFor="ann-subject" style={s.label}>
                  Subject
                  <span style={s.required} aria-hidden>*</span>
                </label>
                <CharCounter current={subject.length} max={SUBJECT_MAX} />
              </div>
              <input
                id="ann-subject"
                type="text"
                maxLength={SUBJECT_MAX}
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. New units available — Unit 5 is live"
                style={{
                  ...s.input,
                  ...(subject.length >= SUBJECT_MAX * 0.95 && s.inputNearLimit),
                }}
                aria-required="true"
                aria-describedby="subject-counter"
                disabled={sending}
              />
            </div>

            {/* Body */}
            <div style={s.fieldGroup}>
              <div style={s.fieldLabelRow}>
                <label htmlFor="ann-body" style={s.label}>
                  Message body
                  <span style={s.required} aria-hidden>*</span>
                </label>
                <CharCounter current={body.length} max={BODY_MAX} />
              </div>
              <textarea
                id="ann-body"
                maxLength={BODY_MAX}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message here…"
                rows={10}
                style={{
                  ...s.textarea,
                  ...(body.length >= BODY_MAX * 0.95 && s.inputNearLimit),
                }}
                aria-required="true"
                disabled={sending}
              />

              {/* HTML hint */}
              <div style={s.hint}>
                <Info size={11} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                <span>
                  Supports basic HTML:&nbsp;
                  <code style={s.code}>&lt;b&gt;</code>,&nbsp;
                  <code style={s.code}>&lt;i&gt;</code>,&nbsp;
                  <code style={s.code}>&lt;a href="…"&gt;</code>,&nbsp;
                  <code style={s.code}>&lt;br&gt;</code>.
                  Scripts and iframes are stripped server-side.
                </span>
              </div>
            </div>

            {/* Audience */}
            <div style={s.fieldGroup}>
              <div style={s.fieldLabelRow}>
                <label style={s.label}>Send to</label>
              </div>
              <AudienceSelector
                mode={audienceMode}
                onModeChange={setAudienceMode}
                product={audienceProduct}
                onProductChange={setAudienceProduct}
                batch={audienceBatch}
                onBatchChange={setAudienceBatch}
                individuals={individuals}
                onIndividualsChange={setIndividuals}
                batches={batches}
              />
              {audienceMode === 'individuals' && individuals.length === 0 && (
                <p style={{ margin: 0, fontSize: 11.5, color: MUTED }}>
                  Search and add at least one student.
                </p>
              )}
            </div>

            {/* Recipients + Send button */}
            <div style={s.footer}>
              <RecipientBadge count={recipientCount} loading={countLoading} />

              <motion.button
                onClick={() => canSend && setModalOpen(true)}
                disabled={!canSend}
                whileHover={canSend ? { filter: 'brightness(1.08)' } : {}}
                whileTap={canSend ? { scale: 0.97 } : {}}
                style={{
                  ...s.sendBtn,
                  opacity: canSend ? 1 : 0.45,
                  cursor:  canSend ? 'pointer' : 'not-allowed',
                }}
                aria-label="Open send confirmation"
                aria-disabled={!canSend}
              >
                {sending ? (
                  <Loader2
                    size={15}
                    aria-hidden
                    style={{ animation: 'spin 0.9s linear infinite' }}
                  />
                ) : (
                  <Send size={15} aria-hidden />
                )}
                {sending ? 'Sending…' : 'Send Announcement'}
              </motion.button>
            </div>
          </section>

          {/* ── Right: Live preview ────────────────────────────────────────── */}
          <section style={s.previewColumn} aria-label="Email preview">
            <div style={s.sectionLabel}>
              <Eye
                size={11}
                style={{ flexShrink: 0 }}
                aria-hidden
              />
              Live Preview
            </div>

            <EmailPreview
              subject={subject}
              body={body}
              adminName={adminName}
            />

            <p style={s.previewCaption}>
              Approximate rendering — exact appearance varies by email client.
            </p>
          </section>

        </motion.div>
      </motion.div>

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    maxWidth:   1080,
    margin:     '0 auto',
    padding:    '8px 0 48px',
    color:      SLATE,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },

  header: {
    display:      'flex',
    alignItems:   'flex-start',
    gap:          14,
    marginBottom: 28,
  },

  pageTitle: {
    margin:        0,
    fontSize:      22,
    fontWeight:    700,
    color:         SLATE,
    fontFamily:    FONT_HEADING,
    letterSpacing: '-0.025em',
    lineHeight:    1.2,
  },

  pageSubtitle: {
    margin:     '3px 0 0',
    fontSize:   13.5,
    color:      MUTED,
    lineHeight: 1.5,
  },

  grid: {
    display:             'grid',
    gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
    gap:                 20,
    alignItems:          'start',
    // Stack on narrow screens via media query is not available inline;
    // handled by the responsive class below via className fallback.
  },

  card: {
    background:   SURFACE,
    border:       `1px solid ${BORDER}`,
    borderRadius: 12,
    padding:      24,
    display:      'flex',
    flexDirection: 'column',
    gap:           20,
  },

  previewColumn: {
    display:       'flex',
    flexDirection: 'column',
    gap:           10,
  },

  sectionLabel: {
    display:       'flex',
    alignItems:    'center',
    gap:           6,
    fontSize:      T_XS,
    fontWeight:    600,
    color:         MUTED,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },

  fieldGroup: {
    display:       'flex',
    flexDirection: 'column',
    gap:           6,
  },

  fieldLabelRow: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            8,
  },

  label: {
    fontSize:      T_BASE,
    fontWeight:    600,
    color:         INK_SOFT,
    letterSpacing: '-0.01em',
  },

  required: {
    color:      RED,
    marginLeft: 2,
  },

  input: {
    padding:       '9px 12px',
    border:        `1px solid ${BORDER_FIELD}`,
    borderRadius:  7,
    fontSize:      T_MD,
    color:         SLATE,
    background:    SURFACE_SHELL,
    outline:       'none',
    width:         '100%',
    boxSizing:     'border-box',
    transition:    'border-color 0.15s, box-shadow 0.15s',
    fontFamily:    'inherit',
  },

  textarea: {
    padding:      '9px 12px',
    border:       `1px solid ${BORDER_FIELD}`,
    borderRadius: 7,
    fontSize:     13.5,
    color:        SLATE,
    background:   SURFACE_SHELL,
    outline:      'none',
    width:        '100%',
    boxSizing:    'border-box',
    resize:       'vertical',
    minHeight:    200,
    lineHeight:   1.65,
    fontFamily:   'inherit',
    transition:   'border-color 0.15s, box-shadow 0.15s',
  },

  inputNearLimit: {
    borderColor: RED,
    background:  `${RED}0A`,
  },

  hint: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        5,
    fontSize:   11.5,
    color:      MUTED,
    lineHeight: 1.55,
    marginTop:  -4,
  },

  code: {
    fontFamily:   'ui-monospace, monospace',
    fontSize:     10.5,
    background:   SURFACE_ALT,
    color:        INK_SOFT,
    padding:      '1px 4px',
    borderRadius: 3,
    border:       `1px solid ${BORDER}`,
  },

  footer: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            12,
    flexWrap:       'wrap',
    borderTop:      `1px solid ${BORDER}`,
    paddingTop:     16,
    marginTop:      -4,
  },

  sendBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          7,
    padding:      '10px 20px',
    background:   RED,
    color:        SURFACE,
    border:       'none',
    borderRadius: R_MD,
    fontSize:     13.5,
    fontWeight:   600,
    letterSpacing: '-0.01em',
    whiteSpace:   'nowrap',
    transition:   'opacity 0.15s, filter 0.15s',
    minWidth:     0,
  },

  previewCaption: {
    margin:     0,
    fontSize:   T_XS,
    color:      MUTED,
    lineHeight: 1.5,
    fontStyle:  'italic',
  },

  // Modal button styles
  cancelBtn: {
    padding:      '9px 18px',
    background:   SURFACE_SHELL,
    color:        INK_SOFT,
    border:       `1px solid ${BORDER}`,
    borderRadius: 7,
    fontSize:     T_BASE,
    fontWeight:   500,
    cursor:       'pointer',
  },

  confirmBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          7,
    padding:      '9px 20px',
    background:   RED,
    color:        SURFACE,
    border:       'none',
    borderRadius: 7,
    fontSize:     T_BASE,
    fontWeight:   600,
    cursor:       'pointer',
    letterSpacing: '-0.01em',
  },
};
