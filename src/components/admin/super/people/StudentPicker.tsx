'use client';

import { useEffect, useState } from 'react';
import { FieldInput, FieldLabel, MUTED, SLATE, BORDER, SURFACE, R_MD, T_SM } from '../../lms/lms-shared';
import { superApi } from '../super-ui';

export interface PickedUser { id: number; name: string; email: string; studentId: string | null; batch: string | null; role: string; status: string }

/** Debounced name/email/studentId search; calls onPick with the chosen account. */
export default function StudentPicker({ label = 'Student', value, onPick }: { label?: string; value: PickedUser | null; onPick: (u: PickedUser | null) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedUser[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await superApi<{ users: PickedUser[] }>(`/api/admin/super/people/students/search?q=${encodeURIComponent(q.trim())}`);
        setResults(r.users); setErr('');
      } catch (e) { setErr((e as Error).message); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div style={{ marginBottom: 12 }}>
        <FieldLabel>{label}</FieldLabel>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: T_SM, color: SLATE }}>
          <strong>{value.name}</strong> <span style={{ color: MUTED }}>{value.email}{value.studentId ? ` | ${value.studentId}` : ''}{value.batch ? ` | ${value.batch}` : ''}</span>
          <button type="button" onClick={() => { onPick(null); setQ(''); }} style={{ background: 'none', border: 'none', color: MUTED, textDecoration: 'underline', cursor: 'pointer', fontSize: T_SM }}>change</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 12, position: 'relative' }}>
      <FieldLabel htmlFor={`pick-${label}`}>{label}</FieldLabel>
      <FieldInput id={`pick-${label}`} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email or student ID" autoComplete="off" />
      {err && <p style={{ color: MUTED, fontSize: T_SM }}>{err}</p>}
      {results.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, border: `1px solid ${BORDER}`, borderRadius: R_MD, background: SURFACE, maxHeight: 260, overflowY: 'auto' }}>
          {results.map(u => (
            <li key={u.id}>
              <button type="button" onClick={() => { onPick(u); setResults([]); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: T_SM, color: SLATE }}>
                <strong>{u.name}</strong> <span style={{ color: MUTED }}>{u.email} | {u.role}{u.studentId ? ` | ${u.studentId}` : ''}{u.batch ? ` | ${u.batch}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
