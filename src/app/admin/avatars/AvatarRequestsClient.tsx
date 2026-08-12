'use client';

/**
 * /admin/avatars — custom avatar write-in requests.
 * Lists students who asked for a character not in the catalogue; staff
 * approve or reject. Approving does NOT auto-create a catalogue character or
 * assign it — see the route's comment for why that's out of scope here.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Drama, Check, X } from 'lucide-react';
import {
  RED, RED_DARK, SLATE, INK_SOFT, BORDER, MUTED, SURFACE_SHELL, OK, OK_BG,
  R_SM, R_MD, R_PILL, SHADOW_LG, FONT_HEADING, T_SM, T_BASE, T_XL, Z_TOAST,
} from '@/components/admin/lms/lms-shared';

type Status = 'pending' | 'approved' | 'rejected';

interface RequestRow {
  id: number;
  name: string;
  email: string;
  request: string;
  status: Status;
  updatedAt: string;
}

export default function AvatarRequestsClient() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [tab, setTab] = useState<Status>('pending');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
    if (sessionStatus === 'authenticated' && !session.user?.isAdmin) router.push('/');
  }, [sessionStatus, session, router]);

  const fetchRows = useCallback(async (s: Status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/avatar-requests?status=${s}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(json.requests ?? []);
    } catch {
      showToast('error', 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session.user?.isAdmin) {
      void fetchRows(tab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session, tab]);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function act(id: number, decision: 'approved' | 'rejected') {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/avatar-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: decision }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('success', decision === 'approved' ? 'Approved.' : 'Rejected.');
      setRows(prev => prev.filter(r => r.id !== id));
    } catch {
      showToast('error', 'Action failed.');
    } finally {
      setActing(null);
    }
  }

  if (
    sessionStatus === 'loading' ||
    sessionStatus === 'unauthenticated' ||
    (sessionStatus === 'authenticated' && !session?.user?.isAdmin)
  ) {
    return (
      <div style={S.center}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: RED }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {toast && (
        <div style={{ ...S.toast, ...(toast.type === 'success' ? S.toastSuccess : S.toastError) }}>
          {toast.msg}
        </div>
      )}

      <div style={S.header}>
        <Drama size={20} color={RED} aria-hidden />
        <div>
          <h1 style={S.title}>Avatar Requests</h1>
          <p style={S.subtitle}>Custom write-ins — not in the catalogue, review before granting.</p>
        </div>
      </div>

      <div style={S.chips}>
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setTab(s)}
            style={{ ...S.chip, ...(tab === s ? S.chipActive : {}) }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={S.center}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: MUTED }} />
        </div>
      ) : rows.length === 0 ? (
        <div style={S.emptyState}>
          <Drama size={32} color={BORDER} aria-hidden />
          <p style={S.emptyTitle}>Nothing here.</p>
        </div>
      ) : (
        <div style={S.list}>
          {rows.map(row => (
            <div key={row.id} style={S.card}>
              <div style={S.cardBody}>
                <p style={S.name}>{row.name} <span style={S.email}>{row.email}</span></p>
                <p style={S.request}>&ldquo;{row.request}&rdquo;</p>
              </div>
              {tab === 'pending' && (
                <div style={S.actions}>
                  <button
                    onClick={() => act(row.id, 'approved')}
                    disabled={acting === row.id}
                    style={S.approveBtn}
                    aria-label={`Approve ${row.name}'s request`}
                  >
                    <Check size={13} /> Approve
                  </button>
                  <button
                    onClick={() => act(row.id, 'rejected')}
                    disabled={acting === row.id}
                    style={S.rejectBtn}
                    aria-label={`Reject ${row.name}'s request`}
                  >
                    <X size={13} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SANS = "'Inter', 'Sora', system-ui, sans-serif";

const S = {
  page: { fontFamily: SANS, color: SLATE, maxWidth: 800 } as React.CSSProperties,
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 } as React.CSSProperties,
  toast: {
    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: Z_TOAST,
    padding: '10px 18px', borderRadius: R_MD, fontSize: T_BASE, fontWeight: 500,
    boxShadow: SHADOW_LG, whiteSpace: 'nowrap',
  } as React.CSSProperties,
  toastSuccess: { background: OK_BG, color: OK, border: `1px solid ${OK}4D` } as React.CSSProperties,
  toastError: { background: `${RED}0F`, color: RED_DARK, border: `1px solid ${RED}47` } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 } as React.CSSProperties,
  title: { margin: 0, fontFamily: FONT_HEADING, fontSize: T_XL, fontWeight: 700, color: SLATE } as React.CSSProperties,
  subtitle: { margin: '2px 0 0', fontSize: T_BASE, color: MUTED, fontWeight: 400 } as React.CSSProperties,
  chips: { display: 'flex', gap: 8, marginBottom: 16 } as React.CSSProperties,
  chip: {
    padding: '6px 14px', borderRadius: R_PILL, border: `1px solid ${BORDER}`, background: 'transparent',
    cursor: 'pointer', fontSize: T_SM, fontWeight: 500, color: MUTED, textTransform: 'capitalize' as const,
  } as React.CSSProperties,
  chipActive: { background: `${RED}0F`, border: `1px solid ${RED}40`, color: RED } as React.CSSProperties,
  emptyState: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    padding: '48px 24px', gap: 10, textAlign: 'center' as const,
  } as React.CSSProperties,
  emptyTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: INK_SOFT } as React.CSSProperties,
  list: { display: 'flex', flexDirection: 'column' as const, gap: 8 } as React.CSSProperties,
  card: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    background: SURFACE_SHELL, border: `1px solid ${BORDER}`, borderRadius: R_MD, padding: '12px 14px', flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  cardBody: { minWidth: 0, flex: 1 } as React.CSSProperties,
  name: { margin: 0, fontSize: T_BASE, fontWeight: 600, color: SLATE } as React.CSSProperties,
  email: { fontWeight: 400, color: MUTED, fontSize: T_SM, marginLeft: 6 } as React.CSSProperties,
  request: { margin: '4px 0 0', fontSize: T_BASE, color: INK_SOFT, fontStyle: 'italic' as const } as React.CSSProperties,
  actions: { display: 'flex', gap: 8, flexShrink: 0 } as React.CSSProperties,
  approveBtn: {
    display: 'flex', alignItems: 'center', gap: 6, background: OK_BG, border: `1px solid ${OK}59`,
    borderRadius: R_SM, padding: '7px 12px', cursor: 'pointer', color: OK, fontSize: T_SM, fontWeight: 500,
  } as React.CSSProperties,
  rejectBtn: {
    display: 'flex', alignItems: 'center', gap: 6, background: `${RED}0F`, border: `1px solid ${RED}59`,
    borderRadius: R_SM, padding: '7px 12px', cursor: 'pointer', color: RED, fontSize: T_SM, fontWeight: 500,
  } as React.CSSProperties,
};
