'use client';

import React, { useState, useCallback, useRef, useEffect, useTransition } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  Mail,
  Calendar,
  Flame,
  Star,
  Shield,
  ShieldOff,
  Package,
  Check,
  AlertTriangle,
  Clock,
  MessageSquare,
  Phone,
  RefreshCw,
  Loader2,
} from 'lucide-react';

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

interface DetailedUser extends AdminUserRow {
  badgeCount?:  number;
  vocabPhase?:  number | null;
  notes?:       string | null;
}

interface UsersClientProps {
  initialUsers:          AdminUserRow[];
  initialTotal:          number;
  initialAccessRequests: AdminAccessRequest[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE       = 20;
const DEBOUNCE_MS     = 300;
const PRODUCTS        = ['iba', 'fbs', 'fbs_detailed'] as const;
const PRODUCT_LABELS  = { iba: 'IBA', fbs: 'FBS', fbs_detailed: 'FBS Detailed' } as const;

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
      background:    '#0F172A',
      color:         '#F8FAFC',
      border:        '1px solid #0F172A',
    },
    admin: {
      background:    'rgba(214,43,56,0.07)',
      color:         '#B91C2C',
      border:        '1px solid rgba(214,43,56,0.2)',
    },
    student: {
      background:    '#F3F4F6',
      color:         '#374151',
      border:        '1px solid #E5E7EB',
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
      borderRadius:  100,
      fontSize:      11,
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
      borderRadius:  100,
      fontSize:      11,
      fontWeight:    500,
      letterSpacing: '0.01em',
      lineHeight:    1.6,
      background:    isActive ? 'rgba(16,185,129,0.08)' : isPending ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.08)',
      color:         isActive ? '#047857'                : isPending ? '#92400E'               : '#B91C1C',
      border:        `1px solid ${isActive ? 'rgba(16,185,129,0.2)' : isPending ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.2)'}`,
    }}>
      <span style={{
        width:        5,
        height:       5,
        borderRadius: '50%',
        background:   isActive ? '#10B981' : isPending ? '#F59E0B' : '#EF4444',
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
        borderRadius:  100,
        fontSize:      12,
        fontWeight:    active ? 600 : 400,
        letterSpacing: '-0.01em',
        cursor:        'pointer',
        border:        active ? '1.5px solid #D62B38' : '1.5px solid #E5E7EB',
        background:    active ? 'rgba(214,43,56,0.05)' : '#FFFFFF',
        color:         active ? '#D62B38' : '#6B7280',
        transition:    'all 0.14s ease',
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{
          fontSize:   10,
          fontWeight: 700,
          padding:    '1px 5px',
          borderRadius: 100,
          background: active ? '#D62B38' : '#F3F4F6',
          color:      active ? '#FFFFFF' : '#9CA3AF',
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
        color:         '#0F172A',
        letterSpacing: '-0.03em',
        lineHeight:    1.2,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{
          margin:    '3px 0 0',
          fontSize:  13,
          color:     '#9CA3AF',
          lineHeight: 1.4,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
}: {
  open:          boolean;
  title:         string;
  message:       string;
  confirmLabel:  string;
  destructive:   boolean;
  loading:       boolean;
  onConfirm:     () => void;
  onCancel:      () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onCancel}
            style={{
              position:   'fixed',
              inset:      0,
              background: 'rgba(0,0,0,0.35)',
              zIndex:     200,
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } }}
            exit={{ opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.16 } }}
            style={{
              position:     'fixed',
              top:          '50%',
              left:         '50%',
              transform:    'translate(-50%, -50%)',
              zIndex:       201,
              background:   '#FFFFFF',
              borderRadius: 12,
              padding:      '24px 28px',
              width:        340,
              boxShadow:    '0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)',
              border:       '1px solid #E5E7EB',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
              <div style={{
                width:           36,
                height:          36,
                borderRadius:    '50%',
                background:      destructive ? 'rgba(214,43,56,0.1)' : 'rgba(59,130,246,0.1)',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                flexShrink:      0,
              }}>
                <AlertTriangle
                  size={17}
                  style={{ color: destructive ? '#D62B38' : '#3B82F6' }}
                  aria-hidden
                />
              </div>
              <div>
                <p style={{
                  margin:     0,
                  fontSize:   14,
                  fontWeight: 600,
                  color:      '#0F172A',
                  lineHeight: 1.3,
                }}>
                  {title}
                </p>
                <p style={{
                  margin:     '5px 0 0',
                  fontSize:   13,
                  color:      '#6B7280',
                  lineHeight: 1.45,
                }}>
                  {message}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <motion.button
                onClick={onCancel}
                whileTap={{ scale: 0.97 }}
                disabled={loading}
                style={{
                  padding:      '8px 16px',
                  borderRadius: 7,
                  fontSize:     13,
                  fontWeight:   500,
                  border:       '1px solid #E5E7EB',
                  background:   '#FFFFFF',
                  color:        '#374151',
                  cursor:       'pointer',
                  opacity:      loading ? 0.5 : 1,
                }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={onConfirm}
                whileTap={{ scale: 0.97 }}
                disabled={loading}
                style={{
                  padding:      '8px 16px',
                  borderRadius: 7,
                  fontSize:     13,
                  fontWeight:   600,
                  border:       'none',
                  background:   destructive ? '#D62B38' : '#0F172A',
                  color:        '#FFFFFF',
                  cursor:       loading ? 'not-allowed' : 'pointer',
                  opacity:      loading ? 0.7 : 1,
                  display:      'flex',
                  alignItems:   'center',
                  gap:          6,
                }}
              >
                {loading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />}
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── User Detail Panel ────────────────────────────────────────────────────────

function UserDetailPanel({
  user,
  onClose,
  onUpdate,
}: {
  user:     DetailedUser;
  onClose:  () => void;
  onUpdate: (updated: Partial<AdminUserRow>) => void;
}) {
  const [role,           setRole]           = useState(user.role);
  const [products,       setProducts]       = useState<Set<string>>(new Set(user.products));
  const [saving,         setSaving]         = useState(false);
  const [suspending,     setSuspending]     = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [toast,          setToast]          = useState<string | null>(null);
  const [roleChanged,    setRoleChanged]    = useState(false);
  const [productsChanged, setProductsChanged] = useState(false);

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

  const handleSaveRole = async () => {
    if (!roleChanged) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed');
      onUpdate({ role });
      setRoleChanged(false);
      showToast('Role updated');
    } catch {
      showToast('Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProducts = async () => {
    if (!productsChanged) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ products: Array.from(products) }),
      });
      if (!res.ok) throw new Error('Failed');
      onUpdate({ products: Array.from(products) as ('iba' | 'fbs' | 'fbs_detailed')[] });
      setProductsChanged(false);
      showToast('Products updated');
    } catch {
      showToast('Failed to update products');
    } finally {
      setSaving(false);
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

  return (
    <>
      {/* Backdrop */}
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.25)',
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
          background:  '#FFFFFF',
          borderLeft:  '1px solid #E5E7EB',
          overflowY:   'auto',
          display:     'flex',
          flexDirection: 'column',
          boxShadow:   '-8px 0 40px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '16px 20px',
          borderBottom:   '1px solid #F3F4F6',
          position:       'sticky',
          top:            0,
          background:     '#FFFFFF',
          zIndex:         1,
        }}>
          <span style={{
            fontSize:   11,
            fontWeight: 600,
            color:      '#9CA3AF',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            User Detail
          </span>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.92 }}
            aria-label="Close panel"
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              width:          30,
              height:         30,
              borderRadius:   '50%',
              border:         '1px solid #E5E7EB',
              background:     '#FAFAFA',
              cursor:         'pointer',
              color:          '#6B7280',
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
            borderBottom: '1px solid #F3F4F6',
          }}>
            <div style={{
              width:          52,
              height:         52,
              borderRadius:   '50%',
              background:     '#D62B38',
              color:          '#FFFFFF',
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
                fontSize:     16,
                fontWeight:   700,
                color:        '#0F172A',
                letterSpacing: '-0.02em',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}>
                {user.name}
              </p>
              <p style={{
                margin:       '2px 0 6px',
                fontSize:     12,
                color:        '#6B7280',
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
                background:   '#FAFAFA',
                border:       '1px solid #F3F4F6',
                borderRadius: 8,
                padding:      '10px 12px',
                textAlign:    'center',
              }}>
                <Icon size={13} style={{ color: '#9CA3AF', marginBottom: 4 }} aria-hidden />
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  {value}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
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
            borderBottom: '1px solid #F3F4F6',
          }}>
            {[
              { icon: Calendar, label: 'Joined',     value: formatDate(user.createdAt)      },
              { icon: User,     label: 'Student ID', value: user.studentId ?? '—'            },
              { icon: Mail,     label: 'Batch',      value: user.batch ?? '—'                },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={13} style={{ color: '#D1D5DB', flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 12, color: '#9CA3AF', minWidth: 72 }}>{label}</span>
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
            {typeof user.badgeCount === 'number' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={13} style={{ color: '#D1D5DB', flexShrink: 0 }} aria-hidden />
                <span style={{ fontSize: 12, color: '#9CA3AF', minWidth: 72 }}>Badges</span>
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
                  {user.badgeCount} earned
                </span>
              </div>
            )}
          </div>

          {/* Product Access */}
          <div style={{ marginBottom: 20 }}>
            <p style={{
              margin:       '0 0 10px',
              fontSize:     11,
              fontWeight:   700,
              color:        '#6B7280',
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
                      border:          granted ? '1.5px solid rgba(214,43,56,0.25)' : '1.5px solid #E5E7EB',
                      background:      granted ? 'rgba(214,43,56,0.04)' : '#FAFAFA',
                      cursor:          'pointer',
                      transition:      'all 0.14s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Package size={13} style={{ color: granted ? '#D62B38' : '#9CA3AF' }} aria-hidden />
                      <span style={{
                        fontSize:  12,
                        fontWeight: 600,
                        color:      granted ? '#B91C2C' : '#374151',
                      }}>
                        {PRODUCT_LABELS[p]}
                      </span>
                    </div>
                    <div style={{
                      width:          18,
                      height:         18,
                      borderRadius:   '50%',
                      border:         granted ? 'none' : '1.5px solid #D1D5DB',
                      background:     granted ? '#D62B38' : 'transparent',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                    }}>
                      {granted && <Check size={10} style={{ color: '#FFFFFF' }} aria-hidden />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
            {productsChanged && (
              <motion.button
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleSaveProducts}
                disabled={saving}
                whileTap={{ scale: 0.97 }}
                style={{
                  marginTop:    8,
                  width:        '100%',
                  padding:      '8px',
                  borderRadius: 7,
                  border:       'none',
                  background:   '#0F172A',
                  color:        '#FFFFFF',
                  fontSize:     12,
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
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden /> Saving…</>
                  : 'Save Product Changes'}
              </motion.button>
            )}
          </div>

          {/* Change Role */}
          <div style={{
            marginBottom: 20,
            paddingBottom: 20,
            borderBottom: '1px solid #F3F4F6',
          }}>
            <p style={{
              margin:       '0 0 8px',
              fontSize:     11,
              fontWeight:   700,
              color:        '#6B7280',
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
                    border:       '1.5px solid #E5E7EB',
                    background:   '#FAFAFA',
                    fontSize:     13,
                    fontWeight:   500,
                    color:        '#0F172A',
                    cursor:       'pointer',
                    outline:      'none',
                  }}
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown
                  size={13}
                  style={{
                    position:    'absolute',
                    right:       10,
                    top:         '50%',
                    transform:   'translateY(-50%)',
                    color:       '#9CA3AF',
                    pointerEvents: 'none',
                  }}
                  aria-hidden
                />
              </div>
              {roleChanged && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleSaveRole}
                  disabled={saving}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    padding:      '9px 14px',
                    borderRadius: 7,
                    border:       'none',
                    background:   '#0F172A',
                    color:        '#FFFFFF',
                    fontSize:     12,
                    fontWeight:   600,
                    cursor:       saving ? 'not-allowed' : 'pointer',
                    flexShrink:   0,
                    display:      'flex',
                    alignItems:   'center',
                    gap:          5,
                  }}
                >
                  {saving
                    ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
                    : <Check size={12} aria-hidden />}
                  Apply
                </motion.button>
              )}
            </div>
          </div>

          {/* Suspend / Reactivate */}
          <div>
            <p style={{
              margin:       '0 0 8px',
              fontSize:     11,
              fontWeight:   700,
              color:        '#6B7280',
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
                border:       isSuspended ? '1.5px solid rgba(16,185,129,0.3)' : '1.5px solid rgba(214,43,56,0.3)',
                background:   isSuspended ? 'rgba(16,185,129,0.05)' : 'rgba(214,43,56,0.04)',
                color:        isSuspended ? '#047857' : '#D62B38',
                fontSize:     13,
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
                borderRadius: 8,
                background:   '#0F172A',
                color:        '#FFFFFF',
                fontSize:     12,
                fontWeight:   500,
                textAlign:    'center',
                boxShadow:    '0 4px 16px rgba(0,0,0,0.15)',
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
        background:   '#FFFFFF',
        border:       '1px solid #E5E7EB',
        borderRadius: 10,
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
        background:     '#F3F4F6',
        color:          '#374151',
        fontSize:       12,
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
            fontSize:     13,
            fontWeight:   600,
            color:        '#0F172A',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {request.userName}
          </p>
          <span style={{
            fontSize:   11,
            color:      '#9CA3AF',
            flexShrink: 0,
          }}>
            {formatRelative(request.createdAt)}
          </span>
        </div>

        <p style={{
          margin:       '0 0 8px',
          fontSize:     12,
          color:        '#6B7280',
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
              <Phone size={10} style={{ color: '#D1D5DB', flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{request.whatsapp}</span>
            </div>
          )}
          {request.message && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <MessageSquare size={10} style={{ color: '#D1D5DB', flexShrink: 0, marginTop: 2 }} aria-hidden />
              <span style={{
                fontSize:       11,
                color:          '#9CA3AF',
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
            borderRadius: 6,
            border:       approved ? '1px solid rgba(16,185,129,0.3)' : '1px solid #E5E7EB',
            background:   approved ? 'rgba(16,185,129,0.08)' : '#FAFAFA',
            color:        approved ? '#047857' : '#374151',
            fontSize:     12,
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UsersClient({
  initialUsers,
  initialTotal,
  initialAccessRequests,
}: UsersClientProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [userList,      setUserList]      = useState<AdminUserRow[]>(initialUsers);
  const [total,         setTotal]         = useState(initialTotal);
  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState<'all' | 'admin' | 'student'>('all');
  const [page,          setPage]          = useState(1);
  const [loading,       setLoading]       = useState(false);
  const [selectedUser,  setSelectedUser]  = useState<DetailedUser | null>(null);
  const [panelLoading,  setPanelLoading]  = useState(false);
  const [accessRequests, setAccessRequests] = useState<AdminAccessRequest[]>(initialAccessRequests);
  const [, startTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages  = Math.ceil(total / PAGE_SIZE);

  // ── Fetch users ────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (
    q: string,
    role: string,
    pg: number,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q)            params.set('search', q);
      if (role !== 'all') params.set('role', role);
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

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        void fetchUsers(search, roleFilter, 1);
        setPage(1);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  // Pagination
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchUsers(search, roleFilter, newPage);
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

  // ── Role filter counts ─────────────────────────────────────────────────────
  const adminCount   = userList.filter(u => u.role === 'admin' || u.role === 'super_admin').length;
  const studentCount = userList.filter(u => u.role === 'student').length;

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
            color:         '#0F172A',
            letterSpacing: '-0.04em',
            lineHeight:    1.2,
          }}>
            Users
          </h1>
          <p style={{
            margin:   '4px 0 0',
            fontSize: 13,
            color:    '#9CA3AF',
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
                label="Admin"
                active={roleFilter === 'admin'}
                count={adminCount}
                onClick={() => setRoleFilter('admin')}
              />
              <FilterChip
                label="Student"
                active={roleFilter === 'student'}
                count={studentCount}
                onClick={() => setRoleFilter('student')}
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
                  color:       '#9CA3AF',
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
                  borderRadius: 8,
                  border:       '1.5px solid #E5E7EB',
                  background:   '#FAFAFA',
                  fontSize:     13,
                  color:        '#0F172A',
                  outline:      'none',
                  transition:   'border-color 0.14s',
                }}
                onFocus={e => (e.target.style.borderColor = '#D62B38')}
                onBlur={e  => (e.target.style.borderColor = '#E5E7EB')}
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
                    color:      '#9CA3AF',
                    display:    'flex',
                  }}
                >
                  <X size={12} aria-hidden />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{
            background:   '#FFFFFF',
            border:       '1px solid #E5E7EB',
            borderRadius: 10,
            overflow:     'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display:     'grid',
              gridTemplateColumns: '2fr 1fr 90px 80px 110px 80px',
              padding:     '10px 16px',
              background:  '#FAFAFA',
              borderBottom: '1px solid #F3F4F6',
            }}>
              {['User', 'Role', 'Points', 'Streak', 'Last Active', 'Status'].map(h => (
                <span key={h} style={{
                  fontSize:      11,
                  fontWeight:    600,
                  color:         '#9CA3AF',
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
                color:          '#9CA3AF',
                fontSize:       13,
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
                color:      '#9CA3AF',
                fontSize:   13,
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
                role="button"
                tabIndex={0}
                aria-label={`View details for ${user.name}`}
                onKeyDown={e => e.key === 'Enter' && void openUserPanel(user)}
                style={{
                  display:     'grid',
                  gridTemplateColumns: '2fr 1fr 90px 80px 110px 80px',
                  padding:     '12px 16px',
                  borderBottom: i < userList.length - 1 ? '1px solid #F9FAFB' : 'none',
                  cursor:      'pointer',
                  transition:  'background 0.1s',
                  alignItems:  'center',
                }}
                whileHover={{ backgroundColor: 'rgba(0,0,0,0.015)' }}
              >
                {/* User info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width:          30,
                    height:         30,
                    borderRadius:   '50%',
                    background:     user.role === 'admin' || user.role === 'super_admin'
                      ? '#D62B38'
                      : '#F3F4F6',
                    color:          user.role === 'admin' || user.role === 'super_admin'
                      ? '#FFFFFF'
                      : '#374151',
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
                      fontSize:     13,
                      fontWeight:   600,
                      color:        '#0F172A',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}>
                      {user.name}
                    </p>
                    <p style={{
                      margin:       0,
                      fontSize:     11,
                      color:        '#9CA3AF',
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
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                  {user.totalPoints.toLocaleString()}
                </div>

                {/* Streak */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: user.streakDays > 0 ? '#EA580C' : '#9CA3AF', fontWeight: 600 }}>
                  {user.streakDays > 0 && <Flame size={12} aria-hidden />}
                  {user.streakDays > 0 ? `${user.streakDays}d` : '—'}
                </div>

                {/* Last Active */}
                <div style={{ fontSize: 12, color: '#6B7280' }}>
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
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>
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
                    border:         '1px solid #E5E7EB',
                    background:     '#FFFFFF',
                    fontSize:       12,
                    fontWeight:     500,
                    color:          page === 1 ? '#D1D5DB' : '#374151',
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
                    border:         '1px solid #E5E7EB',
                    background:     '#FFFFFF',
                    fontSize:       12,
                    fontWeight:     500,
                    color:          page === totalPages ? '#D1D5DB' : '#374151',
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
              background:   '#FAFAFA',
              border:       '1px dashed #E5E7EB',
              borderRadius: 10,
              padding:      '32px 24px',
              textAlign:    'center',
            }}>
              <Shield size={22} style={{ color: '#D1D5DB', margin: '0 auto 8px' }} aria-hidden />
              <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>
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
          background:      '#0F172A',
          color:           '#FFFFFF',
          fontSize:        11,
          fontWeight:      600,
          padding:         '5px 10px',
          borderRadius:    100,
          display:         'flex',
          alignItems:      'center',
          gap:             5,
          pointerEvents:   'none',
        }}>
          <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
          Loading details…
        </div>
      )}
    </>
  );
}
