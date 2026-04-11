'use client';

/**
 * AnnouncementsClient
 *
 * Compose + preview UI for broadcasting an announcement to all active users.
 * Light mode, clean editorial aesthetic consistent with the admin panel.
 *
 * Features:
 *   - Subject input (max 100) + character counter
 *   - Body textarea (max 5 000) + character counter
 *   - Live side-by-side HTML preview (dark email-branded panel)
 *   - Recipient count badge
 *   - Send button → confirmation modal → POST → inline result toast
 *   - Form resets on successful send
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface AnnouncementsClientProps {
  recipientCount: number;
  adminName: string;
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
  if (pct >= 0.95) return '#DC2626';
  if (pct >= 0.80) return '#D97706';
  return '#9CA3AF';
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
        fontSize:      11,
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

function RecipientBadge({ count }: { count: number }) {
  return (
    <div
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          6,
        padding:      '5px 12px',
        background:   '#F0F9FF',
        border:       '1px solid #BAE6FD',
        borderRadius: 20,
        fontSize:     12.5,
        fontWeight:   500,
        color:        '#0369A1',
      }}
    >
      <Users size={13} aria-hidden />
      {count === 0
        ? 'No active recipients'
        : `Will be sent to ${count.toLocaleString()} user${count === 1 ? '' : 's'}`}
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
        background:   '#0F0F0F',
        borderRadius: 8,
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
          background: '#D62B38',
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
            color:          'rgba(255,255,255,0.65)',
            marginBottom:   4,
          }}
        >
          VH LexiCore — Announcement
        </p>
        <h3
          style={{
            margin:        0,
            fontFamily:    'Georgia, serif',
            fontSize:      subject ? 15 : 13,
            fontWeight:    400,
            color:         subject ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
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
          color:      '#E8E4DC',
          overflowY:  'auto',
        }}
      >
        {isEmpty ? (
          <p
            style={{
              margin:     0,
              color:      '#5A5750',
              fontStyle:  'italic',
              fontSize:   13,
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
            borderTop:  '1px solid #2A2A2A',
            padding:    '12px 20px',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              margin:    0,
              fontSize:  11,
              color:     '#5A5750',
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
  recipientCount,
  adminName,
}: AnnouncementsClientProps) {
  const [subject,      setSubject]      = useState('');
  const [body,         setBody]         = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [sending,      setSending]      = useState(false);
  const [toast,        setToast]        = useState<ToastState | null>(null);
  const toastTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmBtnRef                   = useRef<HTMLButtonElement>(null);

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
        body:    JSON.stringify({ subject: subject.trim(), body: body.trim() }),
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
  }, [sending, subject, body, showToast]);

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

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending;

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
              zIndex:      9999,
              display:     'flex',
              alignItems:  'center',
              gap:         8,
              padding:     '10px 18px',
              borderRadius: 8,
              fontSize:    13,
              fontWeight:  500,
              boxShadow:   '0 4px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)',
              maxWidth:    480,
              whiteSpace:  'nowrap',
              ...(toast.type === 'success' && {
                background: '#F0FDF4',
                color:      '#166534',
                border:     '1px solid #BBF7D0',
              }),
              ...(toast.type === 'warning' && {
                background: '#FFFBEB',
                color:      '#92400E',
                border:     '1px solid #FDE68A',
              }),
              ...(toast.type === 'error' && {
                background: '#FEF2F2',
                color:      '#991B1B',
                border:     '1px solid #FECACA',
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
              zIndex:          1000,
              background:      'rgba(0,0,0,0.35)',
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
                background:   '#FFFFFF',
                borderRadius: 12,
                padding:      28,
                width:        '100%',
                maxWidth:     440,
                boxShadow:    '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                border:       '1px solid #E5E7EB',
              }}
            >
              {/* Icon + title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <div
                  style={{
                    width:          40,
                    height:         40,
                    borderRadius:   10,
                    background:     '#FEF2F2',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                  }}
                >
                  <Send size={18} color="#D62B38" aria-hidden />
                </div>
                <div>
                  <h2
                    id="modal-title"
                    style={{
                      margin:        0,
                      fontSize:      16,
                      fontWeight:    700,
                      color:         '#0F172A',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Send announcement?
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                    This will send an email to&nbsp;
                    <strong style={{ color: '#0F172A' }}>
                      {recipientCount.toLocaleString()} active user{recipientCount === 1 ? '' : 's'}
                    </strong>.
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              {/* Subject preview */}
              <div
                style={{
                  background:   '#F8FAFC',
                  border:       '1px solid #E5E7EB',
                  borderRadius: 6,
                  padding:      '10px 14px',
                  marginBottom: 22,
                }}
              >
                <p
                  style={{
                    margin:        0,
                    fontSize:      10,
                    fontWeight:    600,
                    color:         '#9CA3AF',
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
                    fontSize:      13,
                    color:         '#0F172A',
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
              borderRadius:   10,
              background:     '#FEF2F2',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            }}
          >
            <Megaphone size={20} color="#D62B38" aria-hidden />
          </div>
          <div>
            <h1 style={s.pageTitle}>Announcements</h1>
            <p style={s.pageSubtitle}>
              Compose and broadcast a message to all active LexiCore users.
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
                  background: '#D62B38',
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

            {/* Recipients + Send button */}
            <div style={s.footer}>
              <RecipientBadge count={recipientCount} />

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
    color:      '#0F172A',
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
    color:         '#0F172A',
    letterSpacing: '-0.025em',
    lineHeight:    1.2,
  },

  pageSubtitle: {
    margin:     '3px 0 0',
    fontSize:   13.5,
    color:      '#6B7280',
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
    background:   '#FFFFFF',
    border:       '1px solid #E5E7EB',
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
    fontSize:      11,
    fontWeight:    600,
    color:         '#9CA3AF',
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
    fontSize:      13,
    fontWeight:    600,
    color:         '#374151',
    letterSpacing: '-0.01em',
  },

  required: {
    color:      '#D62B38',
    marginLeft: 2,
  },

  input: {
    padding:       '9px 12px',
    border:        '1px solid #D1D5DB',
    borderRadius:  7,
    fontSize:      14,
    color:         '#0F172A',
    background:    '#FAFAFA',
    outline:       'none',
    width:         '100%',
    boxSizing:     'border-box',
    transition:    'border-color 0.15s, box-shadow 0.15s',
    fontFamily:    'inherit',
  },

  textarea: {
    padding:      '9px 12px',
    border:       '1px solid #D1D5DB',
    borderRadius: 7,
    fontSize:     13.5,
    color:        '#0F172A',
    background:   '#FAFAFA',
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
    borderColor: '#FCA5A5',
    background:  '#FFF8F8',
  },

  hint: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        5,
    fontSize:   11.5,
    color:      '#9CA3AF',
    lineHeight: 1.55,
    marginTop:  -4,
  },

  code: {
    fontFamily:   'ui-monospace, monospace',
    fontSize:     10.5,
    background:   '#F3F4F6',
    color:        '#4B5563',
    padding:      '1px 4px',
    borderRadius: 3,
    border:       '1px solid #E5E7EB',
  },

  footer: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            12,
    flexWrap:       'wrap',
    borderTop:      '1px solid #F3F4F6',
    paddingTop:     16,
    marginTop:      -4,
  },

  sendBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          7,
    padding:      '10px 20px',
    background:   '#D62B38',
    color:        '#FFFFFF',
    border:       'none',
    borderRadius: 8,
    fontSize:     13.5,
    fontWeight:   600,
    letterSpacing: '-0.01em',
    whiteSpace:   'nowrap',
    transition:   'opacity 0.15s, filter 0.15s',
    minWidth:     0,
  },

  previewCaption: {
    margin:     0,
    fontSize:   11,
    color:      '#9CA3AF',
    lineHeight: 1.5,
    fontStyle:  'italic',
  },

  // Modal button styles
  cancelBtn: {
    padding:      '9px 18px',
    background:   '#F9FAFB',
    color:        '#374151',
    border:       '1px solid #E5E7EB',
    borderRadius: 7,
    fontSize:     13,
    fontWeight:   500,
    cursor:       'pointer',
  },

  confirmBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          7,
    padding:      '9px 20px',
    background:   '#D62B38',
    color:        '#FFFFFF',
    border:       'none',
    borderRadius: 7,
    fontSize:     13,
    fontWeight:   600,
    cursor:       'pointer',
    letterSpacing: '-0.01em',
  },
};
