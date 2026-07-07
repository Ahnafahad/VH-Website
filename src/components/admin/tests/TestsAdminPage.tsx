'use client';

/**
 * TestsAdminPage — full admin UI for the Online Tests module.
 * Sections:
 *   1. Test list (GET /api/admin/tests)
 *   2. Expandable detail per test:
 *      a. Test Settings     (admin-only: publish/archive, products, results)
 *      b. Windows Manager   (admin + instructor)
 *      c. Attempts Table    (admin + instructor)
 *      d. Answer Key Editor (admin-only)
 */

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Edit2,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldOff,
  Trash2,
  X,
  ZapOff,
} from 'lucide-react';
import { BUCKET_LABELS, type TestBucket, type AttemptStatus, type TestMode } from '@/lib/tests/types';

// ─── Design tokens (light admin palette, matching existing admin pages) ────────

const C = {
  bg:         '#FFFFFF',
  surface:    '#FAFAFA',
  border:     '#E5E7EB',
  red:        '#D62B38',
  redLight:   'rgba(214,43,56,0.06)',
  redMid:     'rgba(214,43,56,0.12)',
  text:       '#111827',
  textSec:    '#6B7280',
  textMuted:  '#9CA3AF',
  success:    '#059669',
  successBg:  'rgba(5,150,105,0.08)',
  successBdr: 'rgba(5,150,105,0.25)',
  warn:       '#D97706',
  warnBg:     'rgba(217,119,6,0.08)',
  warnBdr:    'rgba(217,119,6,0.25)',
  danger:     '#DC2626',
  dangerBg:   'rgba(220,38,38,0.08)',
  dangerBdr:  'rgba(220,38,38,0.25)',
  infoBg:     'rgba(59,130,246,0.08)',
  infoBdr:    'rgba(59,130,246,0.25)',
  infoText:   '#1D4ED8',
  gold:       '#B45309',
  goldBg:     'rgba(180,83,9,0.08)',
} as const;

const SANS = 'system-ui, -apple-system, sans-serif';

// ─── API response types ────────────────────────────────────────────────────────

interface AdminWindow {
  id: number;
  mode: TestMode;
  opensAt: number;
  closesAt: number;
  durationMinutes: number | null;
  status: 'scheduled' | 'open' | 'closed';
  state: 'upcoming' | 'open' | 'closed';
}

interface AdminTest {
  id: number;
  slug: string;
  title: string;
  bucket: TestBucket;
  status: 'draft' | 'published' | 'archived';
  totalQuestions: number;
  totalMarks: number;
  allowedProducts: string[] | null;
  resultsPublishedAt: number | null;
  syllabus: string | null;
  createdAt: number;
  windows: AdminWindow[];
  attemptCounts: { inProgress: number; submitted: number; banned: number };
}

interface AdminAttempt {
  id: number;
  user: { name: string | null; email: string; studentId: string | null };
  mode: TestMode;
  status: AttemptStatus;
  startedAt: number;
  submittedAt: number | null;
  tabLeaveCount: number;
  resetCount: number;
  totalScore: number | null;
  totalCorrect: number | null;
  totalWrong: number | null;
  totalUnattempted: number | null;
}

interface AnswerKeyQuestion {
  id: number;
  number: number;
  sectionTitle: string;
  sectionOrder: number;
  correctKey: string | null;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info' | 'warn';

interface ToastState { type: ToastType; message: string }

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((type: ToastType, message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ type, message });
    timerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  return { toast, show };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Convert local datetime-local string "YYYY-MM-DDTHH:mm" to epoch ms */
function localToMs(local: string): number {
  return new Date(local).getTime();
}

/** Convert epoch ms to datetime-local string "YYYY-MM-DDTHH:mm" */
function msToLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:      { bg: C.surface,    color: C.textSec,  label: 'Draft'      },
  published:  { bg: C.successBg,  color: C.success,  label: 'Published'  },
  archived:   { bg: C.goldBg,     color: C.gold,     label: 'Archived'   },
  in_progress:{ bg: C.warnBg,     color: C.warn,     label: 'In progress'},
  submitted:  { bg: C.successBg,  color: C.success,  label: 'Submitted'  },
  banned:     { bg: C.dangerBg,   color: C.danger,   label: 'Banned'     },
  upcoming:   { bg: C.infoBg,     color: C.infoText, label: 'Upcoming'   },
  open:       { bg: C.successBg,  color: C.success,  label: 'Open'       },
  closed:     { bg: C.surface,    color: C.textSec,  label: 'Closed'     },
  scheduled:  { bg: C.infoBg,     color: C.infoText, label: 'Scheduled'  },
};

function Badge({ value }: { value: string }) {
  const s = STATUS_STYLES[value] ?? { bg: C.surface, color: C.textSec, label: value };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

function BucketBadge({ bucket }: { bucket: TestBucket }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: bucket === 'iba' ? 'rgba(214,43,56,0.10)' : 'rgba(59,130,246,0.10)',
      color: bucket === 'iba' ? C.red : C.infoText,
      letterSpacing: '0.03em',
    }}>{BUCKET_LABELS[bucket]}</span>
  );
}

function Btn({
  children, onClick, disabled, variant = 'primary', size = 'md', danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
  danger?: boolean;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: SANS, fontWeight: 600, opacity: disabled ? 0.6 : 1,
    transition: 'background 0.15s',
    padding: size === 'sm' ? '5px 10px' : '8px 14px',
    fontSize: size === 'sm' ? 12 : 13,
  };
  if (variant === 'primary') {
    return (
      <button onClick={onClick} disabled={disabled} style={{
        ...base,
        background: danger ? C.danger : C.red,
        color: '#fff',
      }}>{children}</button>
    );
  }
  if (variant === 'outline') {
    return (
      <button onClick={onClick} disabled={disabled} style={{
        ...base,
        background: 'transparent',
        border: `1px solid ${danger ? C.danger : C.border}`,
        color: danger ? C.danger : C.text,
      }}>{children}</button>
    );
  }
  // ghost
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...base,
      background: 'transparent',
      color: danger ? C.danger : C.textSec,
    }}>{children}</button>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <>
      <Loader2 size={size} style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      margin: 0, fontSize: 12, fontWeight: 700, color: C.textMuted,
      textTransform: 'uppercase', letterSpacing: '0.07em',
      fontFamily: SANS, paddingBottom: 10,
      borderBottom: `1px solid ${C.border}`, marginBottom: 14,
    }}>{children}</h3>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', danger,
  onConfirm, onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, padding: 24,
        maxWidth: 400, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: C.text, fontFamily: SANS }}>{title}</h4>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: C.textSec, fontFamily: SANS, lineHeight: 1.55 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" danger={danger} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Toast component ──────────────────────────────────────────────────────────

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  const s = {
    success: { bg: C.successBg, color: C.success, border: C.successBdr },
    error:   { bg: C.dangerBg,  color: C.danger,  border: C.dangerBdr  },
    warn:    { bg: C.warnBg,    color: C.warn,    border: C.warnBdr    },
    info:    { bg: C.infoBg,    color: C.infoText,border: C.infoBdr    },
  }[toast.type];

  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px', borderRadius: 8, fontSize: 13, fontFamily: SANS,
      fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
      maxWidth: 'min(520px, calc(100vw - 32px))',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {toast.type === 'success' && <CheckCircle size={15} />}
      {toast.type === 'error'   && <AlertTriangle size={15} />}
      {toast.type === 'warn'    && <AlertTriangle size={15} />}
      {toast.type === 'info'    && <Info size={15} />}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Section A: Test Settings (admin-only) ────────────────────────────────────

const PRODUCTS = ['iba', 'fbs', 'fbs_detailed'] as const;
type Product = typeof PRODUCTS[number];

function TestSettings({
  test, onRefresh, showToast,
}: {
  test: AdminTest;
  onRefresh: () => void;
  showToast: (type: ToastType, msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(test.status);
  const [resultsPublished, setResultsPublished] = useState(test.resultsPublishedAt !== null);
  const [productsNull, setProductsNull] = useState(test.allowedProducts === null);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(
    (test.allowedProducts as Product[] | null) ?? []
  );
  const [syllabus, setSyllabus] = useState(test.syllabus ?? '');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tests/${test.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        showToast('error', d.error ?? 'Failed to save');
      } else {
        showToast('success', 'Settings saved.');
        onRefresh();
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setSaving(false);
    }
  }

  function toggleProduct(p: Product) {
    setSelectedProducts(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionTitle>Test Settings (admin only)</SectionTitle>

      {/* Status */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: C.text, fontWeight: 600, fontFamily: SANS, marginRight: 4 }}>Status:</span>
        {(['draft', 'published', 'archived'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              fontFamily: SANS, cursor: 'pointer',
              background: status === s ? (s === 'published' ? C.successBg : s === 'archived' ? C.goldBg : C.surface) : 'transparent',
              color: status === s ? (s === 'published' ? C.success : s === 'archived' ? C.gold : C.text) : C.textSec,
              border: `1px solid ${status === s ? (s === 'published' ? C.successBdr : s === 'archived' ? C.warnBdr : C.border) : C.border}`,
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <Btn
          size="sm" onClick={() => patch({ status })}
          disabled={saving || status === test.status}
        >
          {saving ? <Spinner size={12} /> : null}
          Save Status
        </Btn>
      </div>

      {/* Publish results */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontFamily: SANS, color: C.text }}>
          <input
            type="checkbox"
            checked={resultsPublished}
            onChange={e => setResultsPublished(e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer' }}
          />
          <span>Force-publish results</span>
        </label>
        <span style={{ fontSize: 12, color: C.textMuted, fontFamily: SANS }}>
          (normally auto-releases when all windows close)
        </span>
        <Btn
          size="sm" onClick={() => patch({ publishResults: resultsPublished })}
          disabled={saving || resultsPublished === (test.resultsPublishedAt !== null)}
        >
          {saving ? <Spinner size={12} /> : null}
          Save
        </Btn>
      </div>

      {/* Allowed products */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: SANS, marginBottom: 8 }}>
          Access control
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontFamily: SANS, color: C.text, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={productsNull}
            onChange={e => setProductsNull(e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer' }}
          />
          <span>Everyone (all logged-in users — <code style={{ fontSize: 11, background: C.surface, padding: '1px 5px', borderRadius: 3 }}>null</code>)</span>
        </label>
        {!productsNull && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {PRODUCTS.map(p => (
              <button
                key={p}
                onClick={() => toggleProduct(p)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  fontFamily: SANS, cursor: 'pointer',
                  background: selectedProducts.includes(p) ? C.redLight : 'transparent',
                  color: selectedProducts.includes(p) ? C.red : C.textSec,
                  border: `1px solid ${selectedProducts.includes(p) ? C.red : C.border}`,
                }}
              >{p}</button>
            ))}
          </div>
        )}
        <Btn
          size="sm"
          onClick={() => patch({ allowedProducts: productsNull ? null : selectedProducts })}
          disabled={saving}
        >
          {saving ? <Spinner size={12} /> : null}
          Save Access
        </Btn>
        {!productsNull && selectedProducts.length === 0 && (
          <p style={{ fontSize: 12, color: C.warn, fontFamily: SANS, margin: '6px 0 0' }}>
            Warning: no products selected — no student will see this test.
          </p>
        )}
      </div>

      {/* Syllabus */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: SANS, marginBottom: 6 }}>
          Syllabus
        </div>
        <textarea
          value={syllabus}
          onChange={e => setSyllabus(e.target.value)}
          placeholder="Topics covered — shown to students on their dashboard before the test"
          rows={4}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 6,
            border: `1px solid ${C.border}`, fontSize: 13, fontFamily: SANS,
            color: C.text, resize: 'vertical', minHeight: 80,
            boxSizing: 'border-box', background: '#fff',
          }}
        />
        <div style={{ marginTop: 8 }}>
          <Btn
            size="sm"
            onClick={() => patch({ syllabus: syllabus.trim() || null })}
            disabled={saving || (syllabus.trim() || null) === (test.syllabus ?? null)}
          >
            {saving ? <Spinner size={12} /> : null}
            Save Syllabus
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Section B: Windows Manager ───────────────────────────────────────────────

interface WindowFormState {
  mode: TestMode;
  opensAt: string;
  closesAt: string;
  durationMinutes: string;
}

function blankForm(): WindowFormState {
  return { mode: 'online', opensAt: '', closesAt: '', durationMinutes: '' };
}

function WindowsManager({
  test, onRefresh, showToast,
}: {
  test: AdminTest;
  onRefresh: () => void;
  showToast: (type: ToastType, msg: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<WindowFormState>(blankForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function startCreate() {
    setEditingId(null);
    setForm(blankForm());
    setShowCreate(true);
  }

  function startEdit(w: AdminWindow) {
    setShowCreate(false);
    setEditingId(w.id);
    setForm({
      mode: w.mode,
      opensAt: msToLocal(w.opensAt),
      closesAt: msToLocal(w.closesAt),
      durationMinutes: w.durationMinutes != null ? String(w.durationMinutes) : '',
    });
  }

  function cancelForm() {
    setShowCreate(false);
    setEditingId(null);
    setForm(blankForm());
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.opensAt || !form.closesAt) {
      showToast('error', 'opensAt and closesAt are required.');
      return;
    }
    if (form.mode === 'online' && !form.durationMinutes) {
      showToast('error', 'Online windows require a duration.');
      return;
    }
    const opensMs  = localToMs(form.opensAt);
    const closesMs = localToMs(form.closesAt);
    if (closesMs <= opensMs) {
      showToast('error', 'Close time must be after open time.');
      return;
    }

    const body: Record<string, unknown> = {
      opensAt: opensMs,
      closesAt: closesMs,
      ...(form.mode === 'online' ? { durationMinutes: parseInt(form.durationMinutes, 10) } : {}),
    };

    setSaving(true);
    try {
      if (editingId !== null) {
        // PATCH existing
        const res = await fetch(`/api/admin/tests/windows/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json() as { error?: string };
          showToast('error', d.error ?? 'Failed to update window.');
          return;
        }
        showToast('success', 'Window rescheduled.');
      } else {
        // POST new
        const res = await fetch(`/api/admin/tests/${test.id}/windows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: form.mode, ...body }),
        });
        if (!res.ok) {
          const d = await res.json() as { error?: string };
          showToast('error', d.error ?? 'Failed to create window.');
          return;
        }
        showToast('success', 'Window created.');
      }
      cancelForm();
      onRefresh();
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setSaving(false);
    }
  }

  async function patchStatus(windowId: number, status: 'open' | 'closed') {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tests/windows/${windowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        showToast('error', d.error ?? 'Failed.');
      } else {
        showToast('success', status === 'open' ? 'Window opened.' : 'Window closed.');
        onRefresh();
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteWindow(windowId: number) {
    setDeletingId(windowId);
    try {
      const res = await fetch(`/api/admin/tests/windows/${windowId}`, { method: 'DELETE' });
      if (res.status === 409) {
        showToast('warn', 'Window has attempts — close it instead of deleting.');
      } else if (!res.ok) {
        const d = await res.json() as { error?: string };
        showToast('error', d.error ?? 'Failed to delete.');
      } else {
        showToast('success', 'Window deleted.');
        onRefresh();
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
    fontSize: 13, fontFamily: SANS, color: C.text, background: '#fff',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle>Windows</SectionTitle>

      {/* Window list */}
      {test.windows.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textMuted, fontFamily: SANS, margin: 0 }}>No windows yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {test.windows.map(w => (
            <div key={w.id} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: SANS, color: C.textSec, textTransform: 'uppercase' }}>
                  {w.mode}
                </span>
                <Badge value={w.status} />
                <Badge value={w.state} />
                {w.durationMinutes && (
                  <span style={{ fontSize: 12, color: C.textMuted, fontFamily: SANS }}>
                    {w.durationMinutes} min
                  </span>
                )}
                <span style={{ fontSize: 12, color: C.textMuted, fontFamily: SANS, marginLeft: 'auto' }}>
                  {fmtDate(w.opensAt)} → {fmtDate(w.closesAt)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {w.state !== 'open' && w.status !== 'closed' && (
                  <Btn size="sm" variant="outline" onClick={() => patchStatus(w.id, 'open')} disabled={saving}>
                    Activate Now
                  </Btn>
                )}
                {w.status === 'open' && (
                  <Btn size="sm" variant="outline" danger onClick={() => patchStatus(w.id, 'closed')} disabled={saving}>
                    Close Now
                  </Btn>
                )}
                {editingId !== w.id && (
                  <Btn size="sm" variant="ghost" onClick={() => startEdit(w)}>
                    <Edit2 size={12} /> Edit
                  </Btn>
                )}
                <Btn size="sm" variant="ghost" danger onClick={() => setConfirmDelete(w.id)}
                  disabled={deletingId === w.id}>
                  {deletingId === w.id ? <Spinner size={12} /> : <Trash2 size={12} />}
                  Delete
                </Btn>
              </div>
              {/* Inline edit form */}
              {editingId === w.id && (
                <form onSubmit={submitForm} style={{ marginTop: 12 }}>
                  <WindowFormFields form={form} setForm={setForm} inputStyle={inputStyle} isEdit />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Btn size="sm" onClick={() => {}} disabled={saving}>
                      {saving ? <Spinner size={12} /> : null} Save
                    </Btn>
                    <Btn size="sm" variant="outline" onClick={cancelForm}>Cancel</Btn>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={submitForm} style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14,
        }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: C.text, fontFamily: SANS }}>New Window</p>
          <WindowFormFields form={form} setForm={setForm} inputStyle={inputStyle} isEdit={false} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Btn size="sm" onClick={() => {}} disabled={saving}>
              {saving ? <Spinner size={12} /> : null} Create Window
            </Btn>
            <Btn size="sm" variant="outline" onClick={cancelForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {!showCreate && editingId === null && (
        <div>
          <Btn size="sm" variant="outline" onClick={startCreate}>
            <Plus size={13} /> Add Window
          </Btn>
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete !== null && (
        <ConfirmDialog
          title="Delete Window"
          message="This will permanently delete the window. If any student has started an attempt through this window, the deletion will fail with an error — close it instead."
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteWindow(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function WindowFormFields({
  form, setForm, inputStyle, isEdit,
}: {
  form: WindowFormState;
  setForm: React.Dispatch<React.SetStateAction<WindowFormState>>;
  inputStyle: React.CSSProperties;
  isEdit: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      {!isEdit && (
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textSec, fontFamily: SANS, marginBottom: 4 }}>Mode</label>
          <select
            value={form.mode}
            onChange={e => setForm(prev => ({ ...prev, mode: e.target.value as TestMode }))}
            style={inputStyle}
          >
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      )}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textSec, fontFamily: SANS, marginBottom: 4 }}>Opens At</label>
        <input type="datetime-local" value={form.opensAt}
          onChange={e => setForm(prev => ({ ...prev, opensAt: e.target.value }))}
          style={inputStyle} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textSec, fontFamily: SANS, marginBottom: 4 }}>Closes At</label>
        <input type="datetime-local" value={form.closesAt}
          onChange={e => setForm(prev => ({ ...prev, closesAt: e.target.value }))}
          style={inputStyle} />
      </div>
      {(form.mode === 'online' || isEdit) && (
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textSec, fontFamily: SANS, marginBottom: 4 }}>
            Duration (minutes){form.mode === 'online' ? ' *' : ' (online only)'}
          </label>
          <input type="number" min={1} value={form.durationMinutes}
            onChange={e => setForm(prev => ({ ...prev, durationMinutes: e.target.value }))}
            placeholder="e.g. 90"
            style={inputStyle} />
        </div>
      )}
    </div>
  );
}

// ─── Section C: Attempts Table ────────────────────────────────────────────────

function AttemptsTable({
  testId, showToast,
}: {
  testId: number;
  showToast: (type: ToastType, msg: string) => void;
}) {
  const [attempts, setAttempts] = useState<AdminAttempt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tests/${testId}/attempts`);
      const d = await res.json() as { attempts?: AdminAttempt[] };
      setAttempts(d.attempts ?? []);
    } catch {
      showToast('error', 'Failed to load attempts.');
    } finally {
      setLoading(false);
    }
  }, [testId, showToast]);

  useEffect(() => { load(); }, [load]);

  async function doAction(attemptId: number, action: 'reset' | 'unban') {
    setActionId(attemptId);
    try {
      const res = await fetch(`/api/admin/tests/attempts/${attemptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        showToast('error', d.error ?? 'Action failed.');
      } else {
        showToast('success', action === 'reset' ? 'Attempt reset.' : 'Student unbanned.');
        await load();
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setActionId(null);
    }
  }

  if (loading && !attempts) {
    return (
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 8, color: C.textSec, fontSize: 13, fontFamily: SANS }}>
        <Spinner /> Loading attempts…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SectionTitle>Attempts</SectionTitle>
        <button onClick={load} disabled={loading} style={{
          marginLeft: 'auto', background: 'none', border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer', color: C.textSec, padding: 4,
        }}>
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      {!attempts || attempts.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textMuted, fontFamily: SANS, margin: 0 }}>No attempts yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: SANS }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Student', 'ID', 'Mode', 'Status', 'Started', 'Submitted', 'Leaves', 'Resets', 'Score', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '6px 10px', textAlign: 'left', fontSize: 11,
                    fontWeight: 700, color: C.textMuted, textTransform: 'uppercase',
                    letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attempts.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 10px', color: C.text }}>
                    <div style={{ fontWeight: 600 }}>{a.user.name ?? '—'}</div>
                    <div style={{ color: C.textMuted, fontSize: 11 }}>{a.user.email}</div>
                  </td>
                  <td style={{ padding: '8px 10px', color: C.textSec }}>{a.user.studentId ?? '—'}</td>
                  <td style={{ padding: '8px 10px', color: C.textSec, textTransform: 'capitalize' }}>{a.mode}</td>
                  <td style={{ padding: '8px 10px' }}><Badge value={a.status} /></td>
                  <td style={{ padding: '8px 10px', color: C.textSec, whiteSpace: 'nowrap' }}>{fmtDate(a.startedAt)}</td>
                  <td style={{ padding: '8px 10px', color: C.textSec, whiteSpace: 'nowrap' }}>
                    {a.submittedAt ? fmtDate(a.submittedAt) : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', color: C.textSec, textAlign: 'center' }}>{a.tabLeaveCount}</td>
                  <td style={{ padding: '8px 10px', color: C.textSec, textAlign: 'center' }}>{a.resetCount}</td>
                  <td style={{ padding: '8px 10px', color: C.text, textAlign: 'center' }}>
                    {a.totalScore != null ? a.totalScore.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                      <Btn
                        size="sm" variant="ghost"
                        onClick={() => setConfirmReset(a.id)}
                        disabled={actionId === a.id}
                      >
                        {actionId === a.id ? <Spinner size={11} /> : <RotateCcw size={11} />}
                        Reset
                      </Btn>
                      {a.status === 'banned' && (
                        <Btn
                          size="sm" variant="ghost"
                          onClick={() => doAction(a.id, 'unban')}
                          disabled={actionId === a.id}
                        >
                          {actionId === a.id ? <Spinner size={11} /> : <ShieldOff size={11} />}
                          Unban
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmReset !== null && (
        <ConfirmDialog
          title="Reset Attempt"
          message="This wipes the student's answers and score so they can start the test fresh. Their violation counters are also cleared. This cannot be undone."
          confirmLabel="Reset Attempt"
          danger
          onConfirm={() => { doAction(confirmReset, 'reset'); setConfirmReset(null); }}
          onCancel={() => setConfirmReset(null)}
        />
      )}
    </div>
  );
}

// ─── Section D: Answer Key Editor ─────────────────────────────────────────────

/** Parses bulk paste like "1.D 2.C 3-A, 4 B" → { qNumber: key } */
function parseBulkPaste(raw: string): Record<number, string> {
  const out: Record<number, string> = {};
  // Match patterns: <number>[. , - ]?<optional space><key letter A-E>
  const re = /(\d+)\s*[.\-,]?\s*([A-Ea-e])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const num = parseInt(m[1], 10);
    const key = m[2].toUpperCase();
    out[num] = key;
  }
  return out;
}

function AnswerKeyEditor({
  testId, showToast,
}: {
  testId: number;
  showToast: (type: ToastType, msg: string) => void;
}) {
  const [questions, setQuestions] = useState<AnswerKeyQuestion[] | null>(null);
  const [keys, setKeys] = useState<Record<number, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tests/${testId}/answer-key`);
      const d = await res.json() as { questions?: AnswerKeyQuestion[] };
      const qs = d.questions ?? [];
      setQuestions(qs);
      const init: Record<number, string | null> = {};
      for (const q of qs) init[q.id] = q.correctKey;
      setKeys(init);
    } catch {
      showToast('error', 'Failed to load answer key.');
    } finally {
      setLoading(false);
    }
  }, [testId, showToast]);

  useEffect(() => { load(); }, [load]);

  async function saveKeys() {
    setSaving(true);
    try {
      const body: Record<string, string | null> = {};
      for (const [id, k] of Object.entries(keys)) body[id] = k;
      const res = await fetch(`/api/admin/tests/${testId}/answer-key`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: body }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        showToast('error', d.error ?? 'Failed to save.');
      } else {
        const d = await res.json() as { rescored?: number; updated?: number };
        showToast('success', `Saved ${d.updated ?? 0} keys. Re-scored ${d.rescored ?? 0} attempts.`);
        await load();
      }
    } catch {
      showToast('error', 'Network error.');
    } finally {
      setSaving(false);
    }
  }

  function applyBulkPaste() {
    if (!questions) return;
    const parsed = parseBulkPaste(bulkText);
    if (Object.keys(parsed).length === 0) {
      showToast('warn', 'Could not parse any answers. Format: "1.D 2.C 3.A"');
      return;
    }
    const byNumber: Record<number, number> = {};
    for (const q of questions) byNumber[q.number] = q.id;
    const next = { ...keys };
    let matched = 0;
    for (const [num, key] of Object.entries(parsed)) {
      const qid = byNumber[Number(num)];
      if (qid !== undefined) { next[qid] = key; matched++; }
    }
    setKeys(next);
    showToast('info', `Filled ${matched} answers from paste (${Object.keys(parsed).length} parsed).`);
    setBulkText('');
  }

  if (loading) {
    return (
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 8, color: C.textSec, fontSize: 13, fontFamily: SANS }}>
        <Spinner /> Loading answer key…
      </div>
    );
  }

  // Group by section
  const sections: Record<string, AnswerKeyQuestion[]> = {};
  if (questions) {
    for (const q of questions) {
      if (!sections[q.sectionTitle]) sections[q.sectionTitle] = [];
      sections[q.sectionTitle].push(q);
    }
  }

  const selectStyle: React.CSSProperties = {
    padding: '4px 6px', borderRadius: 5, border: `1px solid ${C.border}`,
    fontSize: 12, fontFamily: SANS, color: C.text, background: '#fff',
    width: 52,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle>Answer Key (admin only)</SectionTitle>

      {/* Bulk paste */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: 14,
      }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: C.text, fontFamily: SANS }}>
          Bulk Paste
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: C.textMuted, fontFamily: SANS }}>
          Paste answer keys in any liberal format, e.g. <code>1.D 2.C 3-A, 4 B</code>
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder="1.D 2.C 3.A 4.B ..."
            rows={3}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
              fontSize: 13, fontFamily: SANS, resize: 'vertical', minHeight: 60,
            }}
          />
          <Btn size="sm" variant="outline" onClick={applyBulkPaste} disabled={!bulkText.trim()}>
            Fill Grid
          </Btn>
        </div>
      </div>

      {/* Per-section grid */}
      {Object.entries(sections).map(([title, qs]) => (
        <div key={title}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.textSec, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {qs.map(q => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: C.textSec, fontFamily: SANS, minWidth: 20 }}>#{q.number}</span>
                <select
                  value={keys[q.id] ?? ''}
                  onChange={e => setKeys(prev => ({ ...prev, [q.id]: e.target.value || null }))}
                  style={selectStyle}
                >
                  <option value="">—</option>
                  {['A','B','C','D','E'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}

      {questions && questions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
          <Btn onClick={saveKeys} disabled={saving}>
            {saving ? <Spinner size={14} /> : null}
            Save Answer Key
          </Btn>
          <Btn variant="outline" onClick={load} disabled={loading}>
            Reset
          </Btn>
        </div>
      )}

      {questions && questions.length === 0 && (
        <p style={{ fontSize: 13, color: C.textMuted, fontFamily: SANS, margin: 0 }}>
          No questions found for this test.
        </p>
      )}
    </div>
  );
}

// ─── Test Row (expandable) ────────────────────────────────────────────────────

type TabKey = 'settings' | 'windows' | 'attempts' | 'answerKey';

function TestRow({
  test, isAdmin, onRefresh, showToast,
}: {
  test: AdminTest;
  isAdmin: boolean;
  onRefresh: () => void;
  showToast: (type: ToastType, msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('windows');

  const tabs: { key: TabKey; label: string; adminOnly?: boolean }[] = [
    { key: 'windows',   label: 'Windows'    },
    { key: 'attempts',  label: 'Attempts'   },
    { key: 'settings',  label: 'Settings',  adminOnly: true },
    { key: 'answerKey', label: 'Answer Key', adminOnly: true },
  ];

  const total = test.attemptCounts.inProgress + test.attemptCounts.submitted + test.attemptCounts.banned;

  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: 10,
      background: '#fff', overflow: 'hidden',
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <BucketBadge bucket={test.bucket} />
            <Badge value={test.status} />
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: SANS }}>
              {test.title}
            </span>
          </div>
          <div style={{ marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS }}>
              {test.totalQuestions} Qs · {test.totalMarks} marks
            </span>
            <span style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS }}>
              {test.windows.length} window{test.windows.length !== 1 ? 's' : ''}
            </span>
            {total > 0 && (
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: SANS }}>
                {test.attemptCounts.inProgress} in-progress · {test.attemptCounts.submitted} submitted
                {test.attemptCounts.banned > 0 ? ` · ${test.attemptCounts.banned} banned` : ''}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={16} style={{ color: C.textMuted, flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: C.textMuted, flexShrink: 0 }} />}
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`,
            padding: '0 18px', overflowX: 'auto',
          }}>
            {tabs.filter(t => !t.adminOnly || isAdmin).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '10px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 13, fontFamily: SANS, fontWeight: tab === t.key ? 600 : 400,
                  color: tab === t.key ? C.red : C.textSec,
                  borderBottom: tab === t.key ? `2px solid ${C.red}` : '2px solid transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: '18px 18px 22px' }}>
            {tab === 'windows' && (
              <WindowsManager test={test} onRefresh={onRefresh} showToast={showToast} />
            )}
            {tab === 'attempts' && (
              <AttemptsTable testId={test.id} showToast={showToast} />
            )}
            {tab === 'settings' && isAdmin && (
              <TestSettings test={test} onRefresh={onRefresh} showToast={showToast} />
            )}
            {tab === 'answerKey' && isAdmin && (
              <AnswerKeyEditor testId={test.id} showToast={showToast} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TestsAdminPage({ isAdmin }: { isAdmin: boolean }) {
  const [tests, setTests] = useState<AdminTest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast, show: showToast } = useToast();

  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tests');
      const d = await res.json() as { tests?: AdminTest[] };
      setTests(d.tests ?? []);
    } catch {
      showToast('error', 'Failed to load tests.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = (tests ?? []).filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ fontFamily: SANS, color: C.text, maxWidth: 960, margin: '0 auto' }}>
      {/* Toast */}
      {toast && <Toast toast={toast} onClose={() => {}} />}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ClipboardList size={20} style={{ color: C.red }} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em' }}>
              Online Tests
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.textSec }}>
            Manage tests, sitting windows, student attempts{isAdmin ? ', and answer keys' : ''}.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh"
          style={{
            background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6,
            padding: 8, cursor: loading ? 'not-allowed' : 'pointer', color: C.textSec,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 36, minHeight: 36,
          }}
        >
          <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by title or slug…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '7px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
            fontSize: 13, fontFamily: SANS, color: C.text, background: '#fff',
            flex: '1 1 220px', minWidth: 0,
          }}
        />
        {(['all', 'draft', 'published', 'archived'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              fontFamily: SANS, cursor: 'pointer',
              background: filter === f ? C.redLight : 'transparent',
              color: filter === f ? C.red : C.textSec,
              border: `1px solid ${filter === f ? C.red : C.border}`,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && !tests && (
        <div style={{ padding: '48px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.textSec, fontSize: 14 }}>
          <Spinner /> Loading tests…
        </div>
      )}

      {/* Empty */}
      {!loading && tests && tests.length === 0 && (
        <div style={{
          padding: '48px 0', textAlign: 'center',
          border: `1px dashed ${C.border}`, borderRadius: 10,
        }}>
          <ZapOff size={28} style={{ color: C.textMuted, marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 14, color: C.textSec }}>No tests found.</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMuted }}>
            Import a test via <code>scripts/import-test.mjs</code> to get started.
          </p>
        </div>
      )}

      {/* Test list */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(t => (
            <TestRow
              key={t.id}
              test={t}
              isAdmin={isAdmin}
              onRefresh={load}
              showToast={showToast}
            />
          ))}
        </div>
      )}

      {/* Filtered empty */}
      {!loading && tests && tests.length > 0 && filtered.length === 0 && (
        <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '32px 0' }}>
          No tests match your filter.
        </p>
      )}

      {/* Instructor note */}
      {!isAdmin && (
        <div style={{
          marginTop: 24, padding: '10px 14px', borderRadius: 8,
          background: C.infoBg, border: `1px solid ${C.infoBdr}`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <Info size={14} style={{ color: C.infoText, flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, color: C.infoText, fontFamily: SANS, lineHeight: 1.5 }}>
            You are viewing as <strong>Instructor</strong>. Test settings and answer key editing require Admin access.
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
