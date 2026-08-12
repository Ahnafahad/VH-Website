'use client';

import React, { useState, useCallback, useRef, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  Calendar,
  Flame,
  Star,
  Shield,
  ShieldOff,
  Package,
  Check,
  Clock,
  MessageSquare,
  Phone,
  RefreshCw,
  Loader2,
  Gauge,
  Mail,
  Users,
} from 'lucide-react';
import { ConfirmDialog, Modal, AtRiskBadge, AtRiskPopover, useAtRiskPopover, type AtRiskBadgeReason, RED, RED_DARK, SLATE, BORDER, BORDER_FIELD, MUTED, BG, SURFACE, SURFACE_ALT, SURFACE_SHELL, BEIGE, INK_SOFT, OK, OK_BG, WARN, WARN_BG, R_SM, R_MD, R_LG, R_PILL, SHADOW_LG, T_XS, T_SM, T_BASE, T_LG } from './lms/lms-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id:            number;
  name:          string;
  email:         string;
  role:          string;
  status:        string;
  studentId:     string | null;
  batch:         string | null;
  createdAt:     string;
  products:      ('iba' | 'fbs' | 'fbs_detailed')[];
  totalPoints:   number;
  streakDays:    number;
  lastStudyDate: string | null;
}

export interface AdminAccessRequest {
  id:        number;
  userId:    number;
  whatsapp:  string | null;
  message:   string | null;
  status:    string;
  createdAt: string;
  userName:  string;
  userEmail: string;
}

export interface AdminBatch {
  id:      number;
  name:    string;
  product: string;
}

export interface AdminAtRiskStudent {
  id:      number;
  reasons: AtRiskBadgeReason[];
}

interface DetailedUser extends AdminUserRow {
  badgeCount?:  number;
  vocabPhase?:  number | null;
  notes?:       string | null;
}

interface UsersClientProps {
  initialUsers:          AdminUserRow[];
  initialTotal:          number;
  initialAccessRequests: AdminAccessRequest[];
  initialBatches:        AdminBatch[];
  atRiskStudents?:       AdminAtRiskStudent[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE       = 20;
const DEBOUNCE_MS     = 300;
const PRODUCTS        = ['iba', 'fbs', 'fbs_detailed'] as const;
const PRODUCT_LABELS  = { iba: 'IBA', fbs: 'FBS', fbs_detailed: 'FBS Detailed' } as const;

const selectFilterStyle: React.CSSProperties = {
  padding:      '6px 10px',
  borderRadius: R_MD,
  border:       `1.5px solid ${BORDER_FIELD}`,
  background:   SURFACE_SHELL,
  fontSize:     12.5,
  color:        INK_SOFT,
  outline:      'none',
  cursor:       'pointer',
};

// ─── Framer Motion Variants ───────────────────────────────────────────────────

const panelVariants: Variants = {
  hidden:  { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 25, stiffness: 260 },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { type: 'spring' as const, damping: 30, stiffness: 300, duration: 0.22 },
  },
};

const backdropVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.16 } },
};

const rowVariants: Variants = {
  hidden:  { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 380, damping: 32, delay: i * 0.028 },
  }),
};

const cardVariants: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 340, damping: 28, delay: i * 0.05 },
  }),
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.2 },
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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(typeof iso === 'string' && /^\d+$/.test(iso) ? parseInt(iso) * 1000 : iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(typeof iso === 'string' && /^\d+$/.test(iso) ? parseInt(iso) * 1000 : iso);
  if (isNaN(d.getTime())) return 'Never';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, React.CSSProperties> = {
    super_admin: {
      background:    SLATE,
      color:         SURFACE,
      border:        `1px solid ${SLATE}`,
    },
    admin: {
      background:    `${RED}12`,
      color:         RED_DARK,
      border:        `1px solid ${RED}33`,
    },
    student: {
      background:    SURFACE_ALT,
      color:         INK_SOFT,
      border:        `1px solid ${BORDER}`,
    },
  };

  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin:       'Admin',
    student:     'Student',
  };

  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:       '2px 8px',
      borderRadius:  R_PILL,
      fontSize:      T_XS,
      fontWeight:    600,
      letterSpacing: '0.02em',
      lineHeight:    1.6,
      whiteSpace:    'nowrap',
      ...(styles[role] ?? styles.student),
    }}>
      {labels[role] ?? role}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isActive   = status === 'active';
  const isPending  = status === 'pending';

  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           4,
      padding:       '2px 8px',
      borderRadius:  R_PILL,
      fontSize:      T_XS,
      fontWeight:    500,
      letterSpacing: '0.01em',
      lineHeight:    1.6,
      background:    isActive ? OK_BG : isPending ? WARN_BG : `${RED}14`,
      color:         isActive ? OK                : isPending ? WARN               : RED_DARK,
      border:        `1px solid ${isActive ? `${OK}33` : isPending ? `${WARN}40` : `${RED}33`}`,
    }}>
      <span style={{
        width:        5,
        height:       5,
        borderRadius: '50%',
        background:   isActive ? OK : isPending ? WARN : RED,
        flexShrink:   0,
      }} />
      {isActive ? 'Active' : isPending ? 'Pending' : 'Suspended'}
    </span>
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label:   string;
  active:  boolean;
  count?:  number;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           5,
        padding:       '5px 12px',
        borderRadius:  R_PILL,
        fontSize:      T_SM,
        fontWeight:    active ? 600 : 400,
        letterSpacing: '-0.01em',
        cursor:        'pointer',
        border:        active ? `1.5px solid ${RED}` : `1.5px solid ${BORDER}`,
        background:    active ? `${RED}0D` : SURFACE,
        color:         active ? RED : MUTED,
        transition:    'all 0.14s ease',
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{
          fontSize:   10,
          fontWeight: 700,
          padding:    '1px 5px',
          borderRadius: R_PILL,
          background: active ? RED : SURFACE_ALT,
          color:      active ? SURFACE : MUTED,
          lineHeight: 1.6,
        }}>
          {count}
        </span>
      )}
    </motion.button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{
        margin:        0,
        fontSize:      18,
        fontWeight:    700,
        color:         SLATE,
        letterSpacing: '-0.03em',
        lineHeight:    1.2,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{
          margin:    '3px 0 0',
          fontSize:  T_BASE,
          color:     MUTED,
          lineHeight: 1.4,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── User Detail Panel ────────────────────────────────────────────────────────

function UserDetailPanel({
  user,
  batches,
  onClose,
  onUpdate,
}: {
  user:     DetailedUser;
  batches:  AdminBatch[];
  onClose:  () => void;
  onUpdate: (updated: Partial<AdminUserRow>) => void;
}) {
  const [role,           setRole]           = useState(user.role);
  const [products,       setProducts]       = useState<Set<string>>(new Set(user.products));
  const [saving,         setSaving]         = useState(false);
  const [suspending,     setSuspending]     = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [toast,          setToast]          = useState<string | null>(null);
  const [roleChanged,    setRoleChanged]    = useState(false);
  const [productsChanged, setProductsChanged] = useState(false);
  const [batch,          setBatch]          = useState(user.batch ?? '');
  const [batchChanged,   setBatchChanged]   = useState(false);
  const batchOptions = Array.from(new Set(batches.map(b => b.name))).sort();

  const anyChanged = roleChanged || productsChanged || batchChanged;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setRoleChanged(newRole !== user.role);
  };

  const toggleProduct = (p: string) => {
    const next = new Set(products);
    if (next.has(p)) next.delete(p); else next.add(p);
    setProducts(next);
    setProductsChanged(true);
  };

  // Each `apply*` fires its own PATCH and, on success, clears its own
  // `*Changed` flag — so a field that failed stays marked as pending and can
  // be retried, while fields that succeeded don't re-fire on retry.
  const applyRole = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed');
      onUpdate({ role });
      setRoleChanged(false);
      return true;
    } catch {
      return false;
    }
  };

  const applyProducts = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ products: Array.from(products) }),
      });
      if (!res.ok) throw new Error('Failed');
      onUpdate({ products: Array.from(products) as ('iba' | 'fbs' | 'fbs_detailed')[] });
      setProductsChanged(false);
      return true;
    } catch {
      return false;
    }
  };

  const applyBatch = async (): Promise<boolean> => {
    const trimmed = batch.trim() || null;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ batch: trimmed }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { user?: { studentId?: string | null } };
      // Assigning an eligible batch (e.g. IBA 2026-27) may allocate a student ID.
      const assignedId = data.user?.studentId;
      onUpdate(assignedId != null ? { batch: trimmed, studentId: assignedId } : { batch: trimmed });
      setBatchChanged(false);
      return true;
    } catch {
      return false;
    }
  };

  // Single consolidated save: fires only the PATCH calls for fields that
  // actually changed, then reports exactly which of those succeeded/failed —
  // never a blanket "saved" or "failed" when it was actually a partial result.
  const handleSaveAll = async () => {
    const jobs: { label: string; run: () => Promise<boolean> }[] = [];
    if (productsChanged) jobs.push({ label: 'Product access', run: applyProducts });
    if (roleChanged)     jobs.push({ label: 'Role',            run: applyRole });
    if (batchChanged)    jobs.push({ label: 'Batch',           run: applyBatch });
    if (jobs.length === 0) return;

    setSaving(true);
    const results = await Promise.all(
      jobs.map(async j => ({ label: j.label, ok: await j.run() })),
    );
    setSaving(false);

    const succeeded = results.filter(r => r.ok).map(r => r.label);
    const failed    = results.filter(r => !r.ok).map(r => r.label);

    if (failed.length === 0) {
      showToast(succeeded.length > 1 ? 'All changes saved' : `${succeeded[0]} saved`);
    } else if (succeeded.length === 0) {
      showToast(failed.length > 1 ? `Failed to save: ${failed.join(', ')}` : `Failed to save ${failed[0].toLowerCase()}`);
    } else {
      showToast(`Saved: ${succeeded.join(', ')}. Failed: ${failed.join(', ')} — try again.`);
    }
  };

  const handleSuspendToggle = async () => {
    setSuspending(true);
    setConfirmSuspend(false);
    try {
      const action = user.status === 'active' ? 'suspend' : 'reactivate';
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { status: string };
      onUpdate({ status: data.status });
      showToast(action === 'suspend' ? 'User suspended' : 'User reactivated');
    } catch {
      showToast('Action failed');
    } finally {
      setSuspending(false);
    }
  };

  const isSuspended = user.status === 'inactive';

  // Closing (backdrop click or the X button) must not silently discard
  // unsaved role/product/batch edits — confirm first if anything is pending.
  const requestClose = () => {
    if (anyChanged) { setConfirmDiscard(true); return; }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={requestClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: `${SLATE}40`,
          zIndex:     50,
        }}
      />

      {/* Panel */}
      <motion.aside
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        aria-label={`User detail: ${user.name}`}
        style={{
          position:    'fixed',
          top:         0,
          right:       0,
          bottom:      0,
          width:       400,
          maxWidth:    '92vw',
          zIndex:      51,
          background:  SURFACE,
          border:      `1px solid ${BORDER}`,
          overflowY:   'auto',
          display:     'flex',
          flexDirection: 'column',
          boxShadow:   SHADOW_LG,
        }}
      >
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '16px 20px',
          borderBottom:   `1px solid ${SURFACE_ALT}`,
          position:       'sticky',
          top:            0,
          background:     SURFACE,
          zIndex:         1,
        }}>
          <span style={{
            fontSize:   T_XS,
            fontWeight: 600,
            color:      MUTED,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            User Detail
          </span>
          <motion.button
            onClick={requestClose}
            whileTap={{ scale: 0.92 }}
            aria-label="Close panel"
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          30,
              height:         30,
              borderRadius:   '50%',
              border:         `1px solid ${BORDER}`,
              background:     SURFACE_SHELL,
              cursor:         'pointer',
              color:          MUTED,
            }}
          >
            <X size={14} aria-hidden />
          </motion.button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '20px' }}>

          {/* Avatar + identity */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          14,
            marginBottom: 20,
            paddingBottom: 20,
            borderBottom: `1px solid ${SURFACE_ALT}`,
          }}>
            <div style={{
              width:          52,
              height:         52,
              borderRadius:   '50%',
              background:     RED,
              color:          SURFACE,
              fontSize:       17,
              fontWeight:     700,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              letterSpacing:  '0.04em',
              flexShrink:     0,
            }}>
              {getInitials(user.name || 'U')}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                margin:       0,
                fontSize:     T_LG,
                fontWeight:   700,
                color:        SLATE,
                letterSpacing: '-0.02em',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}>
                {user.name}
              </p>
              <p style={{
                margin:       '2px 0 6px',
                fontSize:     T_SM,
                color:        MUTED,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}>
                {user.email}
              </p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <RoleBadge role={user.role} />
                <StatusBadge status={user.status} />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{
            display:      'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap:          8,
            marginBottom: 20,
          }}>
            {[
              { label: 'Points',     value: user.totalPoints.toLocaleString(),        icon: Star      },
              { label: 'Streak',     value: `${user.streakDays}d`,                    icon: Flame     },
              { label: 'Last Study', value: formatRelative(user.lastStudyDate),        icon: Clock     },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} style={{
                background:   SURFACE_SHELL,
                border:       `1px solid ${SURFACE_ALT}`,
                borderRadius: R_MD,
                padding:      '10px 12px',
                textAlign:    'center',
              }}>
                <Icon size={13} style={{ color: MUTED, marginBottom: 4 }} aria-hidden />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em' }}>
                  {value}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Meta info */}
          <div style={{
            display:      'flex',
            flexDirection: 'column',
            gap:          6,
            marginBottom: 20,
            paddingBottom: 20,
            borderBottom: `1px solid ${SURFACE_ALT}`,
          }}>
            {[
              { icon: Calendar, label: 'Joined',     value: formatDate(user.createdAt)      },
              { icon: User,     label: 'Student ID', value: user.studentId ?? '—'            },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={13} style={{ color: BEIGE, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: T_SM, color: MUTED, minWidth: 72 }}>{label}</span>
                <span style={{ fontSize: T_SM, color: INK_SOFT, fontWeight: 500 }}>{value}</span>
              </div>
            ))}
            {typeof user.badgeCount === 'number' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={13} style={{ color: BEIGE, flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: T_SM, color: MUTED, minWidth: 72 }}>Badges</span>
                <span style={{ fontSize: T_SM, color: INK_SOFT, fontWeight: 500 }}>
                  {user.badgeCount} earned
                </span>
              </div>
            )}
          </div>

          {/* View Progress (students only) — entry point to the per-student metrics page */}
          {user.role === 'student' && (
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${SURFACE_ALT}` }}>
              <Link
                href={`/admin/students/${user.id}`}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            7,
                  width:          '100%',
                  padding:        '9px',
                  borderRadius:   7,
                  border:         `1.5px solid ${RED}4D`,
                  background:     `${RED}0A`,
                  color:          RED,
                  fontSize:       T_BASE,
                  fontWeight:     600,
                  textDecoration: 'none',
                }}
              >
                <Gauge size={13} aria-hidden /> View Progress
              </Link>
            </div>
          )}

          {/* Product Access */}
          <div style={{ marginBottom: 20 }}>
            <p style={{
              margin:       '0 0 10px',
              fontSize:     T_XS,
              fontWeight:   700,
              color:        MUTED,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}>
              Product Access
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PRODUCTS.map(p => {
                const granted = products.has(p);
                return (
                  <motion.button
                    key={p}
                    onClick={() => toggleProduct(p)}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'space-between',
                      padding:         '9px 12px',
                      borderRadius:    7,
                      border:          granted ? `1.5px solid ${RED}40` : `1.5px solid ${BORDER}`,
                      background:      granted ? `${RED}0A` : SURFACE_SHELL,
                      cursor:          'pointer',
                      transition:      'all 0.14s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Package size={13} style={{ color: granted ? RED : MUTED }} aria-hidden />
                      <span style={{
                        fontSize:  T_SM,
                        fontWeight: 600,
                        color:      granted ? RED_DARK : INK_SOFT,
                      }}>
                        {PRODUCT_LABELS[p]}
                      </span>
                    </div>
                    <div style={{
                      width:          18,
                      height:         18,
                      borderRadius:   '50%',
                      border:         granted ? 'none' : `1.5px solid ${BEIGE}`,
                      background:     granted ? RED : 'transparent',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                    }}>
                      {granted && <Check size={10} style={{ color: SURFACE }} aria-hidden />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Change Role */}
          <div style={{
            marginBottom: 20,
            paddingBottom: 20,
            borderBottom: `1px solid ${SURFACE_ALT}`,
          }}>
            <p style={{
              margin:       '0 0 8px',
              fontSize:     T_XS,
              fontWeight:   700,
              color:        MUTED,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}>
              Role
            </p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <select
                  value={role}
                  onChange={e => handleRoleChange(e.target.value)}
                  style={{
                    width:        '100%',
                    appearance:   'none',
                    padding:      '9px 36px 9px 12px',
                    borderRadius: 7,
                    border:       `1.5px solid ${BORDER_FIELD}`,
                    background:   SURFACE_SHELL,
                    fontSize:     T_BASE,
                    fontWeight:   500,
                    color:        SLATE,
                    cursor:       'pointer',
                    outline:      'none',
                  }}
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <ChevronDown
                  size={13}
                  style={{
                    position:    'absolute',
                    right:       10,
                    top:         '50%',
                    transform:   'translateY(-50%)',
                    color:       MUTED,
                    pointerEvents: 'none',
                  }}
                  aria-hidden
                />
              </div>
            </div>
          </div>

          {/* Assign Batch */}
          <div style={{
            marginBottom: 20,
            paddingBottom: 20,
            borderBottom: `1px solid ${SURFACE_ALT}`,
          }}>
            <p style={{
              margin:       '0 0 8px',
              fontSize:     T_XS,
              fontWeight:   700,
              color:        MUTED,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}>
              Batch
            </p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={batch}
                onChange={e => { setBatch(e.target.value); setBatchChanged(e.target.value !== (user.batch ?? '')); }}
                style={{
                  flex:         1,
                  padding:      '9px 12px',
                  borderRadius: 7,
                  border:       `1.5px solid ${BORDER_FIELD}`,
                  background:   SURFACE_SHELL,
                  fontSize:     T_BASE,
                  fontWeight:   500,
                  color:        SLATE,
                  outline:      'none',
                  cursor:       'pointer',
                }}
              >
                <option value="">— none —</option>
                {batchOptions.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>

          {/* Save changes (consolidated Product Access / Role / Batch) */}
          {anyChanged && (
            <div style={{
              marginBottom: 20,
              paddingBottom: 20,
              borderBottom: `1px solid ${SURFACE_ALT}`,
            }}>
              <motion.button
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleSaveAll}
                disabled={saving}
                whileTap={{ scale: 0.97 }}
                style={{
                  width:        '100%',
                  padding:      '10px',
                  borderRadius: 7,
                  border:       'none',
                  background:   SLATE,
                  color:        SURFACE,
                  fontSize:     T_BASE,
                  fontWeight:   600,
                  cursor:       saving ? 'not-allowed' : 'pointer',
                  opacity:      saving ? 0.7 : 1,
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  gap:          6,
                }}
              >
                {saving
                  ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} aria-hidden /> Saving…</>
                  : <><Check size={13} aria-hidden /> Save changes</>}
              </motion.button>
            </div>
          )}

          {/* Suspend / Reactivate */}
          <div>
            <p style={{
              margin:       '0 0 8px',
              fontSize:     T_XS,
              fontWeight:   700,
              color:        MUTED,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}>
              Account Status
            </p>
            <motion.button
              onClick={() => setConfirmSuspend(true)}
              whileTap={{ scale: 0.97 }}
              disabled={suspending}
              style={{
                width:        '100%',
                padding:      '9px',
                borderRadius: 7,
                border:       isSuspended ? `1.5px solid ${OK}4D` : `1.5px solid ${RED}4D`,
                background:   isSuspended ? `${OK}0D` : `${RED}0A`,
                color:        isSuspended ? OK : RED,
                fontSize:     T_BASE,
                fontWeight:   600,
                cursor:       suspending ? 'not-allowed' : 'pointer',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          7,
                opacity:      suspending ? 0.6 : 1,
              }}
            >
              {suspending
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
                : isSuspended
                  ? <><RefreshCw size={13} aria-hidden /> Reactivate Account</>
                  : <><ShieldOff size={13} aria-hidden /> Suspend Account</>}
            </motion.button>
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              role="status"
              aria-live="polite"
              style={{
                position:     'sticky',
                bottom:       16,
                margin:       '0 16px 16px',
                padding:      '10px 16px',
                borderRadius: R_MD,
                background:   SLATE,
                color:        SURFACE,
                fontSize:     T_SM,
                fontWeight:   500,
                textAlign:    'center',
                boxShadow:    SHADOW_LG,
              }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      {/* Suspend Confirm Dialog */}
      <ConfirmDialog
        open={confirmSuspend}
        title={isSuspended ? 'Reactivate this user?' : 'Suspend this user?'}
        message={
          isSuspended
            ? `${user.name} will regain access to the platform.`
            : `${user.name} will lose access to the platform immediately.`
        }
        confirmLabel={isSuspended ? 'Reactivate' : 'Suspend'}
        destructive={!isSuspended}
        loading={suspending}
        onConfirm={handleSuspendToggle}
        onCancel={() => setConfirmSuspend(false)}
      />

      {/* Discard Unsaved Changes Confirm Dialog */}
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved changes?"
        message="Product access, role, or batch edits you made haven't been saved yet. Closing now will discard them."
        confirmLabel="Discard"
        destructive
        loading={false}
        onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

// ─── Access Request Card ──────────────────────────────────────────────────────

function AccessRequestCard({
  request,
  index,
  onApprove,
}: {
  request:   AdminAccessRequest;
  index:     number;
  onApprove: (id: number) => void;
}) {
  const [loading,  setLoading]  = useState(false);
  const [approved, setApproved] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/access-requests/${request.id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed');
      setApproved(true);
      setTimeout(() => onApprove(request.id), 600);
    } catch {
      setLoading(false);
    }
  };

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate={approved ? { opacity: 0, scale: 0.96, transition: { duration: 0.3 } } : 'visible'}
      exit="exit"
      layout
      style={{
        background:   SURFACE,
        border:       `1px solid ${BORDER}`,
        borderRadius: R_LG,
        padding:      '16px 18px',
        display:      'flex',
        alignItems:   'flex-start',
        gap:          14,
      }}
    >
      {/* Avatar */}
      <div style={{
        width:          36,
        height:         36,
        borderRadius:   '50%',
        background:     SURFACE_ALT,
        color:          INK_SOFT,
        fontSize:       T_SM,
        fontWeight:     700,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
      }}>
        {getInitials(request.userName || 'U')}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
          <p style={{
            margin:       0,
            fontSize:     T_BASE,
            fontWeight:   600,
            color:        SLATE,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {request.userName}
          </p>
          <span style={{
            fontSize:   T_XS,
            color:      MUTED,
            flexShrink: 0,
          }}>
            {formatRelative(request.createdAt)}
          </span>
        </div>

        <p style={{
          margin:       '0 0 8px',
          fontSize:     T_SM,
          color:        MUTED,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {request.userEmail}
        </p>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
          {request.whatsapp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={10} style={{ color: BEIGE, flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: T_XS, color: MUTED }}>{request.whatsapp}</span>
            </div>
          )}
          {request.message && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <MessageSquare size={10} style={{ color: BEIGE, flexShrink: 0, marginTop: 2 }} aria-hidden />
              <span style={{
                fontSize:       T_XS,
                color:          MUTED,
                lineHeight:     1.45,
                display:        '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow:       'hidden',
              }}>
                {request.message}
              </span>
            </div>
          )}
        </div>

        {/* Grant button */}
        <motion.button
          onClick={handleApprove}
          disabled={loading || approved}
          whileTap={{ scale: 0.96 }}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            padding:      '6px 14px',
            borderRadius: R_SM,
            border:       approved ? `1px solid ${OK}4D` : `1px solid ${BORDER}`,
            background:   approved ? OK_BG : SURFACE_SHELL,
            color:        approved ? OK : INK_SOFT,
            fontSize:     T_SM,
            fontWeight:   600,
            cursor:       loading || approved ? 'not-allowed' : 'pointer',
            opacity:      loading ? 0.7 : 1,
            transition:   'all 0.18s ease',
          }}
        >
          {loading
            ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} aria-hidden /> Approving…</>
            : approved
              ? <><Check size={11} aria-hidden /> Granted</>
              : <><Shield size={11} aria-hidden /> Grant Full Access</>}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Bulk email modal ───────────────────────────────────────────────────────────

const SUBJECT_MAX = 100;
const BODY_MAX    = 5000;

const bulkFieldStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '9px 12px',
  borderRadius: 7,
  border:       `1.5px solid ${BORDER_FIELD}`,
  background:   SURFACE_SHELL,
  fontSize:     T_BASE,
  color:        SLATE,
  outline:      'none',
};

function BulkEmailModal({
  open, onClose, selectedIds, onSent,
}: {
  open: boolean; onClose: () => void; selectedIds: number[];
  onSent: (msg: string) => void;
}) {
  const [subject, setSubject] = useState('');
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);

  const handleClose = () => {
    if (sending) return;
    setSubject('');
    setBody('');
    onClose();
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body:    body.trim(),
          audience: { mode: 'individuals', userIds: selectedIds },
        }),
      });
      const data = await res.json() as { success?: number; failed?: number; total?: number; error?: string };
      if (!res.ok) {
        onSent(data.error ?? 'Failed to send email');
      } else {
        onSent(`Sent to ${data.success ?? 0} of ${data.total ?? selectedIds.length} recipients${(data.failed ?? 0) > 0 ? ` (${data.failed} failed)` : ''}`);
        setSubject('');
        setBody('');
        onClose();
      }
    } catch {
      onSent('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending;

  return (
    <Modal open={open} onClose={handleClose} title={`Email ${selectedIds.length} selected user${selectedIds.length === 1 ? '' : 's'}`} width={480}>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label htmlFor="bulk-email-subject" style={{ display: 'block', fontSize: T_XS, fontWeight: 700, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Subject
          </label>
          <input
            id="bulk-email-subject"
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
            style={bulkFieldStyle}
            placeholder="Subject"
          />
        </div>
        <div>
          <label htmlFor="bulk-email-body" style={{ display: 'block', fontSize: T_XS, fontWeight: 700, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Message
          </label>
          <textarea
            id="bulk-email-body"
            value={body}
            onChange={e => setBody(e.target.value.slice(0, BODY_MAX))}
            rows={6}
            style={{ ...bulkFieldStyle, resize: 'vertical' as const, fontFamily: 'inherit' }}
            placeholder="Message body"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          style={{
            padding: '10px', borderRadius: 7, border: 'none',
            background: SLATE, color: SURFACE, fontSize: T_BASE, fontWeight: 600,
            cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          {sending ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} aria-hidden /> Sending…</> : `Send to ${selectedIds.length}`}
        </button>
      </div>
    </Modal>
  );
}

// ─── Bulk edit modal ──────────────────────────────────────────────────────────

interface BulkEditState {
  applyStatus:   boolean; status:   string;
  applyRole:     boolean; role:     string;
  applyBatch:    boolean; batch:    string;
  applyProducts: boolean; products: Set<'iba' | 'fbs' | 'fbs_detailed'>;
}

const bulkEditInitial: BulkEditState = {
  applyStatus: false, status: 'active',
  applyRole: false, role: 'student',
  applyBatch: false, batch: '',
  applyProducts: false, products: new Set(),
};

function BulkEditModal({
  open, onClose, selectedIds, batchOptions, onDone,
}: {
  open: boolean; onClose: () => void; selectedIds: number[]; batchOptions: string[];
  onDone: (msg: string, failedIds: number[]) => void;
}) {
  const [state, setState] = useState<BulkEditState>(bulkEditInitial);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setState(bulkEditInitial);
    onClose();
  };

  const toggleProduct = (p: 'iba' | 'fbs' | 'fbs_detailed') => {
    setState(prev => {
      const next = new Set(prev.products);
      if (next.has(p)) next.delete(p); else next.add(p);
      return { ...prev, products: next };
    });
  };

  const anyApplied = state.applyStatus || state.applyRole || state.applyBatch || state.applyProducts;

  const handleApply = async () => {
    if (!anyApplied || submitting) return;
    setSubmitting(true);

    const updates: Record<string, unknown> = {};
    if (state.applyStatus) updates.status = state.status;
    if (state.applyRole) updates.role = state.role;
    if (state.applyBatch) updates.batch = state.batch;
    if (state.applyProducts) updates.products = Array.from(state.products);

    try {
      const results = await Promise.allSettled(
        selectedIds.map(id =>
          fetch(`/api/admin/users/${id}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(updates),
          }).then(res => { if (!res.ok) throw new Error(String(res.status)); return id; }),
        ),
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failedIds = selectedIds.filter((_, i) => results[i]!.status === 'rejected');
      onDone(
        failedIds.length === 0
          ? `Updated ${succeeded} user${succeeded === 1 ? '' : 's'}`
          : `Updated ${succeeded}, failed ${failedIds.length} — kept failed users selected, try again`,
        failedIds,
      );
      setState(bulkEditInitial);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Edit ${selectedIds.length} selected user${selectedIds.length === 1 ? '' : 's'}`} width={440}>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Status */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: INK_SOFT, marginBottom: state.applyStatus ? 8 : 0 }}>
            <input type="checkbox" checked={state.applyStatus} onChange={e => setState(s => ({ ...s, applyStatus: e.target.checked }))} />
            Change status
          </label>
          {state.applyStatus && (
            <select value={state.status} onChange={e => setState(s => ({ ...s, status: e.target.value }))} style={bulkFieldStyle}>
              <option value="active">Active</option>
              <option value="inactive">Suspended</option>
            </select>
          )}
        </div>

        {/* Role */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: INK_SOFT, marginBottom: state.applyRole ? 8 : 0 }}>
            <input type="checkbox" checked={state.applyRole} onChange={e => setState(s => ({ ...s, applyRole: e.target.checked }))} />
            Change role
          </label>
          {state.applyRole && (
            <select value={state.role} onChange={e => setState(s => ({ ...s, role: e.target.value }))} style={bulkFieldStyle}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          )}
        </div>

        {/* Batch */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: INK_SOFT, marginBottom: state.applyBatch ? 8 : 0 }}>
            <input type="checkbox" checked={state.applyBatch} onChange={e => setState(s => ({ ...s, applyBatch: e.target.checked }))} />
            Change batch
          </label>
          {state.applyBatch && (
            <select value={state.batch} onChange={e => setState(s => ({ ...s, batch: e.target.value }))} style={bulkFieldStyle}>
              <option value="">— none —</option>
              {batchOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
        </div>

        {/* Products */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: INK_SOFT, marginBottom: state.applyProducts ? 8 : 0 }}>
            <input type="checkbox" checked={state.applyProducts} onChange={e => setState(s => ({ ...s, applyProducts: e.target.checked }))} />
            Change product access
          </label>
          {state.applyProducts && (
            <div style={{ display: 'flex', gap: 8 }}>
              {PRODUCTS.map(p => {
                const on = state.products.has(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProduct(p)}
                    style={{
                      flex: 1, padding: '7px 8px', borderRadius: 7, fontSize: T_SM, fontWeight: 600, cursor: 'pointer',
                      border: on ? `1.5px solid ${RED}4D` : `1.5px solid ${BORDER}`,
                      background: on ? `${RED}0F` : SURFACE_SHELL,
                      color: on ? RED_DARK : MUTED,
                    }}
                  >
                    {PRODUCT_LABELS[p]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={!anyApplied || submitting}
          style={{
            padding: '10px', borderRadius: 7, border: 'none',
            background: SLATE, color: SURFACE, fontSize: T_BASE, fontWeight: 600,
            cursor: anyApplied && !submitting ? 'pointer' : 'not-allowed', opacity: anyApplied && !submitting ? 1 : 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          {submitting ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} aria-hidden /> Applying…</> : `Apply to ${selectedIds.length}`}
        </button>
      </div>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UsersClient({
  initialUsers,
  initialTotal,
  initialAccessRequests,
  initialBatches,
  atRiskStudents = [],
}: UsersClientProps) {
  const atRiskMap = React.useMemo(() => {
    const m = new Map<number, AtRiskBadgeReason[]>();
    for (const s of atRiskStudents) m.set(s.id, s.reasons);
    return m;
  }, [atRiskStudents]);
  const atRiskPopover = useAtRiskPopover();
  const router      = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  // ── State (filters initialised from the URL so they're shareable/reloadable) ─
  const [userList,      setUserList]      = useState<AdminUserRow[]>(initialUsers);
  const [total,         setTotal]         = useState(initialTotal);
  const [search,        setSearch]        = useState(() => searchParams.get('search') ?? '');
  const [roleFilter,    setRoleFilter]    = useState<'all' | 'student' | 'instructor' | 'admin' | 'super_admin'>(
    () => (searchParams.get('role') as 'student' | 'instructor' | 'admin' | 'super_admin' | null) ?? 'all',
  );
  const [batchFilter,   setBatchFilter]   = useState(() => searchParams.get('batch') ?? '');
  const [productFilter, setProductFilter] = useState(() => searchParams.get('product') ?? '');
  const [statusFilter,  setStatusFilter]  = useState(() => searchParams.get('status') ?? '');
  const [page,          setPage]          = useState(() => Number(searchParams.get('page')) || 1);
  const [loading,       setLoading]       = useState(false);
  const [selectedUser,  setSelectedUser]  = useState<DetailedUser | null>(null);
  const [panelLoading,  setPanelLoading]  = useState(false);
  const [accessRequests, setAccessRequests] = useState<AdminAccessRequest[]>(initialAccessRequests);
  const [, startTransition] = useTransition();

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selected,       setSelected]       = useState<Set<number>>(new Set());
  const [showBulkEmail,  setShowBulkEmail]  = useState(false);
  const [showBulkEdit,   setShowBulkEdit]   = useState(false);
  const [bulkToast,      setBulkToast]      = useState<string | null>(null);

  const showBulkToast = (msg: string) => {
    setBulkToast(msg);
    setTimeout(() => setBulkToast(null), 4000);
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = userList.length > 0 && userList.every(u => selected.has(u.id));

  const toggleSelectAllOnPage = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const u of userList) next.delete(u.id);
      } else {
        for (const u of userList) next.add(u.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages  = Math.ceil(total / PAGE_SIZE);

  interface Filters { q: string; role: string; batch: string; product: string; status: string }
  const currentFilters = (): Filters => ({ q: search, role: roleFilter, batch: batchFilter, product: productFilter, status: statusFilter });

  // ── Fetch users ────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (
    filters: Filters,
    pg: number,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q)                params.set('search',  filters.q);
      if (filters.role !== 'all')   params.set('role',    filters.role);
      if (filters.batch)            params.set('batch',   filters.batch);
      if (filters.product)          params.set('product', filters.product);
      if (filters.status)           params.set('status',  filters.status);
      params.set('page',  String(pg));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { users: AdminUserRow[]; count: number };

      // Map to AdminUserRow shape (API returns flat user + products array but no vocab stats directly)
      // We'll call the existing /api/admin/users endpoint which returns users with products
      setUserList(data.users.map(u => ({
        ...u,
        totalPoints:   0,
        streakDays:    0,
        lastStudyDate: null,
      })));
      setTotal(data.count);
    } catch {
      // keep current data on error
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Keep the URL in sync with the current filters/page (shareable, survives reload) ─
  const syncURL = useCallback((filters: Filters, pg: number) => {
    const params = new URLSearchParams();
    if (filters.q)              params.set('search',  filters.q);
    if (filters.role !== 'all') params.set('role',    filters.role);
    if (filters.batch)          params.set('batch',   filters.batch);
    if (filters.product)        params.set('product', filters.product);
    if (filters.status)         params.set('status',  filters.status);
    if (pg > 1)                 params.set('page',    String(pg));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);

  // Debounced filters → refetch page 1 + sync URL
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        const filters = currentFilters();
        void fetchUsers(filters, 1);
        setPage(1);
        syncURL(filters, 1);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, batchFilter, productFilter, statusFilter]);

  // Pagination
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const filters = currentFilters();
    void fetchUsers(filters, newPage);
    syncURL(filters, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Open user detail panel ─────────────────────────────────────────────────
  const openUserPanel = async (user: AdminUserRow) => {
    setSelectedUser({ ...user });
    setPanelLoading(true);
    try {
      const res  = await fetch(`/api/admin/users/${user.id}`);
      const data = await res.json() as {
        user: AdminUserRow & {
          badgeCount:    number;
          vocabProgress: { totalPoints: number; streakDays: number; lastStudyDate: string | null; phase: number } | null;
        };
      };
      setSelectedUser({
        ...data.user,
        totalPoints:   data.user.vocabProgress?.totalPoints   ?? 0,
        streakDays:    data.user.vocabProgress?.streakDays    ?? 0,
        lastStudyDate: data.user.vocabProgress?.lastStudyDate ?? null,
        badgeCount:    data.user.badgeCount,
        vocabPhase:    data.user.vocabProgress?.phase ?? null,
      });
    } catch {
      // panel stays open with basic data
    } finally {
      setPanelLoading(false);
    }
  };

  // ── Update user in list after panel edits ──────────────────────────────────
  const handleUserUpdate = (updated: Partial<AdminUserRow>) => {
    setSelectedUser(prev => prev ? { ...prev, ...updated } : prev);
    setUserList(prev => prev.map(u =>
      u.id === selectedUser?.id ? { ...u, ...updated } : u,
    ));
  };

  // ── Remove approved access request ────────────────────────────────────────
  const handleRequestApproved = (id: number) => {
    setAccessRequests(prev => prev.filter(r => r.id !== id));
  };

  // ── Role filter counts (current page only, like the existing chips) ────────
  const studentCount    = userList.filter(u => u.role === 'student').length;
  const instructorCount = userList.filter(u => u.role === 'instructor').length;
  const adminCount      = userList.filter(u => u.role === 'admin').length;
  const superAdminCount = userList.filter(u => u.role === 'super_admin').length;

  // ── Batch filter options — empty when the batches table has no rows yet ────
  const batchOptions = Array.from(new Set(initialBatches.map(b => b.name))).sort();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 1040, margin: '0 auto' }}>

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            margin:        0,
            fontSize:      22,
            fontWeight:    700,
            color:         SLATE,
            letterSpacing: '-0.04em',
            lineHeight:    1.2,
          }}>
            Users
          </h1>
          <p style={{
            margin:   '4px 0 0',
            fontSize: T_BASE,
            color:    MUTED,
          }}>
            {total.toLocaleString()} total — manage roles, access, and account status
          </p>
        </div>

        {/* ─── Section A: User Table ─────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>

          {/* Toolbar */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            12,
            marginBottom:   16,
            flexWrap:       'wrap',
          }}>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <FilterChip
                label="All"
                active={roleFilter === 'all'}
                count={total}
                onClick={() => setRoleFilter('all')}
              />
              <FilterChip
                label="Student"
                active={roleFilter === 'student'}
                count={studentCount}
                onClick={() => setRoleFilter('student')}
              />
              <FilterChip
                label="Instructor"
                active={roleFilter === 'instructor'}
                count={instructorCount}
                onClick={() => setRoleFilter('instructor')}
              />
              <FilterChip
                label="Admin"
                active={roleFilter === 'admin'}
                count={adminCount}
                onClick={() => setRoleFilter('admin')}
              />
              <FilterChip
                label="Super Admin"
                active={roleFilter === 'super_admin'}
                count={superAdminCount}
                onClick={() => setRoleFilter('super_admin')}
              />
            </div>

            {/* Search */}
            <div style={{ position: 'relative', flex: '0 0 auto', width: 240 }}>
              <Search
                size={13}
                style={{
                  position:    'absolute',
                  left:        11,
                  top:         '50%',
                  transform:   'translateY(-50%)',
                  color:       MUTED,
                  pointerEvents: 'none',
                }}
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                aria-label="Search users"
                style={{
                  width:        '100%',
                  boxSizing:    'border-box',
                  padding:      '7px 12px 7px 32px',
                  borderRadius: R_MD,
                  border:       `1.5px solid ${BORDER_FIELD}`,
                  background:   SURFACE_SHELL,
                  fontSize:     T_BASE,
                  color:        SLATE,
                  outline:      'none',
                  transition:   'border-color 0.14s',
                }}
                onFocus={e => (e.target.style.borderColor = RED)}
                onBlur={e  => (e.target.style.borderColor = BORDER_FIELD)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  style={{
                    position:   'absolute',
                    right:      8,
                    top:        '50%',
                    transform:  'translateY(-50%)',
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                    padding:    2,
                    color:      MUTED,
                    display:    'flex',
                  }}
                >
                  <X size={12} aria-hidden />
                </button>
              )}
            </div>
          </div>

          {/* Secondary filters: batch / product / status */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <select
              value={batchFilter}
              onChange={e => setBatchFilter(e.target.value)}
              aria-label="Filter by batch"
              style={selectFilterStyle}
            >
              <option value="">All batches</option>
              {batchOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <select
              value={productFilter}
              onChange={e => setProductFilter(e.target.value)}
              aria-label="Filter by product"
              style={selectFilterStyle}
            >
              <option value="">All products</option>
              {PRODUCTS.map(p => <option key={p} value={p}>{PRODUCT_LABELS[p]}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              style={selectFilterStyle}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Bulk selection toolbar */}
          {selected.size > 0 && (
            <div style={{
              display:        'flex',
              alignItems:     'center',
              gap:            12,
              padding:        '10px 16px',
              marginBottom:   12,
              borderRadius:   R_LG,
              background:     SLATE,
              color:          SURFACE,
            }}>
              <Users size={14} aria-hidden />
              <span style={{ fontSize: T_BASE, fontWeight: 600 }}>{selected.size} selected</span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setShowBulkEmail(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7, border: 'none',
                  background: `${SURFACE}1F`, color: SURFACE,
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Mail size={13} aria-hidden /> Email
              </button>
              <button
                type="button"
                onClick={() => setShowBulkEdit(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7, border: 'none',
                  background: `${SURFACE}1F`, color: SURFACE,
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Edit fields
              </button>
              <button
                type="button"
                onClick={clearSelection}
                style={{
                  padding: '6px 12px', borderRadius: 7, border: 'none',
                  background: 'transparent', color: `${SURFACE}A3`,
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Table */}
          <div style={{
            background:   SURFACE,
            border:       `1px solid ${BORDER}`,
            borderRadius: R_LG,
            overflow:     'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display:     'grid',
              gridTemplateColumns: '28px 2fr 1fr 90px 80px 110px 80px',
              padding:     '10px 16px',
              background:  SURFACE_SHELL,
              borderBottom: `1px solid ${SURFACE_ALT}`,
              alignItems:  'center',
            }}>
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleSelectAllOnPage}
                aria-label="Select all users on this page"
                style={{ width: 15, height: 15, cursor: 'pointer' }}
              />
              {['User', 'Role', 'Points', 'Streak', 'Last Active', 'Status'].map(h => (
                <span key={h} style={{
                  fontSize:      T_XS,
                  fontWeight:    600,
                  color:         MUTED,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Loading overlay */}
            {loading && (
              <div style={{
                padding:        '32px',
                textAlign:      'center',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            8,
                color:          MUTED,
                fontSize:       T_BASE,
              }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
                Loading…
              </div>
            )}

            {/* Rows */}
            {!loading && userList.length === 0 && (
              <div style={{
                padding:    '40px 16px',
                textAlign:  'center',
                color:      MUTED,
                fontSize:   T_BASE,
              }}>
                No users found.
              </div>
            )}

            {!loading && userList.map((user, i) => (
              <motion.div
                key={user.id}
                custom={i}
                variants={rowVariants}
                initial="hidden"
                animate="visible"
                onClick={() => void openUserPanel(user)}
                onContextMenu={(e) => {
                  const reasons = atRiskMap.get(user.id);
                  if (reasons) atRiskPopover.openFromContextMenu(e, user.name, reasons);
                }}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${user.name}`}
                onKeyDown={e => e.key === 'Enter' && void openUserPanel(user)}
                style={{
                  display:     'grid',
                  gridTemplateColumns: '28px 2fr 1fr 90px 80px 110px 80px',
                  padding:     '12px 16px',
                  borderBottom: i < userList.length - 1 ? `1px solid ${BG}` : 'none',
                  cursor:      'pointer',
                  transition:  'background 0.1s',
                  alignItems:  'center',
                }}
                whileHover={{ backgroundColor: `${SLATE}04` }}
              >
                {/* Select */}
                <input
                  type="checkbox"
                  checked={selected.has(user.id)}
                  onChange={() => toggleSelect(user.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${user.name}`}
                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                />

                {/* User info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width:          30,
                    height:         30,
                    borderRadius:   '50%',
                    background:     user.role === 'admin' || user.role === 'super_admin'
                      ? RED
                      : SURFACE_ALT,
                    color:          user.role === 'admin' || user.role === 'super_admin'
                      ? SURFACE
                      : INK_SOFT,
                    fontSize:       10,
                    fontWeight:     700,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                    letterSpacing:  '0.03em',
                  }}>
                    {getInitials(user.name || 'U')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      margin:       0,
                      fontSize:     T_BASE,
                      fontWeight:   600,
                      color:        SLATE,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                      display:      'flex',
                      alignItems:   'center',
                      gap:          6,
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</span>
                      {atRiskMap.has(user.id) && (
                        <AtRiskBadge onOpen={(e) => atRiskPopover.openFromBadge(e, user.name, atRiskMap.get(user.id)!)} />
                      )}
                    </p>
                    <p style={{
                      margin:       0,
                      fontSize:     T_XS,
                      color:        MUTED,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}>
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Role */}
                <div><RoleBadge role={user.role} /></div>

                {/* Points */}
                <div style={{ fontSize: T_BASE, fontWeight: 600, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
                  {user.totalPoints.toLocaleString()}
                </div>

                {/* Streak */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: T_BASE, color: user.streakDays > 0 ? WARN : MUTED, fontWeight: 600 }}>
                  {user.streakDays > 0 && <Flame size={12} aria-hidden />}
                  {user.streakDays > 0 ? `${user.streakDays}d` : '—'}
                </div>

                {/* Last Active */}
                <div style={{ fontSize: T_SM, color: MUTED }}>
                  {formatRelative(user.lastStudyDate)}
                </div>

                {/* Status */}
                <div><StatusBadge status={user.status} /></div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              marginTop:      14,
              padding:        '10px 0',
            }}>
              <span style={{ fontSize: T_SM, color: MUTED }}>
                Page {page} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <motion.button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1 || loading}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Previous page"
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            4,
                    padding:        '6px 12px',
                    borderRadius:   7,
                    border:         `1px solid ${BORDER}`,
                    background:     SURFACE,
                    fontSize:       T_SM,
                    fontWeight:     500,
                    color:          page === 1 ? BEIGE : INK_SOFT,
                    cursor:         page === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronLeft size={13} aria-hidden /> Previous
                </motion.button>
                <motion.button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages || loading}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Next page"
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            4,
                    padding:        '6px 12px',
                    borderRadius:   7,
                    border:         `1px solid ${BORDER}`,
                    background:     SURFACE,
                    fontSize:       T_SM,
                    fontWeight:     500,
                    color:          page === totalPages ? BEIGE : INK_SOFT,
                    cursor:         page === totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Next <ChevronRight size={13} aria-hidden />
                </motion.button>
              </div>
            </div>
          )}
        </section>

        {/* ─── Section B: Access Requests ───────────────────────────────── */}
        <section>
          <SectionHeader
            title="Access Requests"
            subtitle={
              accessRequests.length === 0
                ? 'No pending requests'
                : `${accessRequests.length} pending — LexiCore full access requests`
            }
          />

          {accessRequests.length === 0 ? (
            <div style={{
              background:   SURFACE_SHELL,
              border:       `1px dashed ${BORDER}`,
              borderRadius: R_LG,
              padding:      '32px 24px',
              textAlign:    'center',
            }}>
              <Shield size={22} style={{ color: BEIGE, margin: '0 auto 8px' }} aria-hidden />
              <p style={{ margin: 0, fontSize: T_BASE, color: MUTED }}>
                All caught up — no pending access requests.
              </p>
            </div>
          ) : (
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap:                 12,
            }}>
              <AnimatePresence mode="popLayout">
                {accessRequests.map((req, i) => (
                  <AccessRequestCard
                    key={req.id}
                    request={req}
                    index={i}
                    onApprove={handleRequestApproved}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>

      {/* ─── User Detail Panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedUser && (
          <UserDetailPanel
            key={selectedUser.id}
            user={selectedUser}
            batches={initialBatches}
            onClose={() => setSelectedUser(null)}
            onUpdate={handleUserUpdate}
          />
        )}
      </AnimatePresence>

      {/* Panel loading overlay (brief) */}
      {panelLoading && selectedUser && (
        <div style={{
          position:        'fixed',
          top:             16,
          right:           416,
          zIndex:          60,
          background:      SLATE,
          color:           SURFACE,
          fontSize:        T_XS,
          fontWeight:      600,
          padding:         '5px 10px',
          borderRadius:    R_PILL,
          display:         'flex',
          alignItems:      'center',
          gap:             5,
          pointerEvents:   'none',
        }}>
          <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
          Loading details…
        </div>
      )}

      <AtRiskPopover state={atRiskPopover.state} onClose={atRiskPopover.close} />

      <BulkEmailModal
        open={showBulkEmail}
        onClose={() => setShowBulkEmail(false)}
        selectedIds={Array.from(selected)}
        onSent={(msg) => showBulkToast(msg)}
      />
      <BulkEditModal
        open={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        selectedIds={Array.from(selected)}
        batchOptions={batchOptions}
        onDone={(msg, failedIds) => {
          showBulkToast(msg);
          setSelected(new Set(failedIds));
          void fetchUsers(currentFilters(), page);
        }}
      />

      {/* Bulk action toast */}
      {bulkToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, background: SLATE, color: SURFACE, fontSize: T_BASE, fontWeight: 600,
          padding: '10px 18px', borderRadius: R_PILL, boxShadow: SHADOW_LG,
        }}>
          {bulkToast}
        </div>
      )}
    </>
  );
}
