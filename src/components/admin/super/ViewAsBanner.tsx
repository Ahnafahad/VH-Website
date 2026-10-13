'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { SLATE, SURFACE, T_SM, Z_TOAST } from '../lms/tokens';
import { SUPER_GOLD } from './super-ui';

/** Persistent banner while a super admin is viewing the site as another user. */
export default function ViewAsBanner() {
  const { data } = useSession();
  const [busy, setBusy] = useState(false);
  const by = data?.user?.impersonatedBy;
  if (!by) return null;

  async function exit() {
    setBusy(true);
    try { await fetch('/api/admin/super/impersonate', { method: 'DELETE' }); } finally { window.location.href = '/admin/super'; }
  }

  return (
    <div role="status" style={{ position: 'sticky', top: 0, zIndex: Z_TOAST, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 16px', background: SLATE, color: SURFACE, fontSize: T_SM, borderBottom: `2px solid ${SUPER_GOLD}` }}>
      <span>Viewing as <strong>{data?.user?.name ?? data?.user?.email}</strong> (read-only)</span>
      <button type="button" onClick={exit} disabled={busy} style={{ padding: '3px 12px', borderRadius: 6, border: `1px solid ${SUPER_GOLD}`, background: 'transparent', color: SURFACE, fontSize: T_SM, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  );
}
