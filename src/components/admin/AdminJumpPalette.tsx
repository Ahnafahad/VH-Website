'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BORDER, INK_SOFT, MUTED, R_LG, RED, SHADOW_LG, SURFACE, SURFACE_ALT, T_BASE, T_SM, Z_MODAL, Z_MODAL_BACKDROP } from './lms/tokens';
import { useDialogBehaviour } from './lms/lms-shared';
import { filterItems, type NavGroup } from './admin-nav';

/** Jump-to palette over nav items. Opened by the sidebar search box or Cmd/Ctrl-K. */
export default function AdminJumpPalette({ groups, open, onClose }: {
  groups: readonly NavGroup[]; open: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const ref = useDialogBehaviour(open, onClose);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  if (!open) return null;

  const results = q.trim() ? filterItems(groups, q) : groups.flatMap(g => g.items);
  const go = (href: string) => { onClose(); setQ(''); setSel(0); router.push(href); };

  return (
    <>
      <div onClick={onClose} aria-hidden style={{ position: 'fixed', inset: 0, background: 'rgba(26,5,7,0.35)', zIndex: Z_MODAL_BACKDROP }} />
      <div
        ref={ref} role="dialog" aria-modal="true" aria-label="Jump to page" tabIndex={-1}
        style={{
          position: 'fixed', top: '14vh', left: '50%', transform: 'translateX(-50%)', width: 'min(440px, 92vw)',
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, boxShadow: SHADOW_LG, zIndex: Z_MODAL, overflow: 'hidden',
        }}
      >
        <input
          autoFocus value={q} placeholder="Jump to page…" aria-label="Jump to page"
          onChange={e => { setQ(e.target.value); setSel(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
            else if (e.key === 'Enter' && results[sel]) go(results[sel].href);
          }}
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', border: 0, borderBottom: `1px solid ${BORDER}`, fontSize: 15, color: INK_SOFT, background: SURFACE, outline: 'none' }}
        />
        <ul role="listbox" style={{ listStyle: 'none', margin: 0, padding: 6, maxHeight: '50vh', overflowY: 'auto' }}>
          {results.length === 0 && <li style={{ padding: '10px 12px', fontSize: T_SM, color: MUTED }}>No matching page.</li>}
          {results.map((it, i) => (
            <li key={it.href} role="option" aria-selected={i === sel}>
              <button
                onClick={() => go(it.href)} onMouseEnter={() => setSel(i)}
                style={{
                  width: '100%', textAlign: 'left', border: 0, borderRadius: 6, minHeight: 36, padding: '8px 12px', cursor: 'pointer',
                  fontSize: T_BASE, color: i === sel ? RED : INK_SOFT, fontWeight: i === sel ? 600 : 400,
                  background: i === sel ? SURFACE_ALT : 'transparent',
                }}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
