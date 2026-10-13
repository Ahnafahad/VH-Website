'use client';

import { useCallback, useEffect, useState } from 'react';
import { FieldInput, FieldLabel, GhostBtn, PrimaryBtn, fmtDhaka, MUTED, T_SM } from '../../lms/lms-shared';
import { SuperCard, StatGrid, StatTile, TypedConfirm, superApi } from '../super-ui';
import StudentPicker, { type PickedUser } from './StudentPicker';

const API = '/api/admin/super/people/students';
interface Pts { total: number; weekly: number }
interface Snap { takenAt: number; rows: number; reason: string }

export default function PointsTab({ notify }: { notify: (m: string) => void }) {
  const [picked, setPicked] = useState<PickedUser | null>(null);
  const [pts, setPts] = useState<Pts | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [snap, setSnap] = useState<Snap | null>(null);
  const [resetReason, setResetReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadSnap = useCallback(async () => {
    try { setSnap((await superApi<{ snapshot: Snap | null }>(`${API}/points`)).snapshot); } catch (e) { notify((e as Error).message); }
  }, [notify]);
  useEffect(() => { void loadSnap(); }, [loadSnap]);
  useEffect(() => {
    if (!picked) { setPts(null); return; }
    superApi<{ points: Pts | null }>(`${API}/overview?userId=${picked.id}`).then(r => setPts(r.points)).catch(e => notify((e as Error).message));
  }, [picked, notify]);

  async function post(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const r = await superApi<{ points?: Pts }>(`${API}/points`, { method: 'POST', body });
      if (r.points) setPts(r.points);
      notify(done);
      await loadSnap();
      return true;
    } catch (e) { notify((e as Error).message); return false; }
    finally { setBusy(false); }
  }

  const d = parseInt(delta, 10);
  return (
    <>
      <SuperCard title="Adjust one student's LexiCore points">
        <StudentPicker value={picked} onPick={setPicked} />
        {picked && (pts ? (
          <>
            <StatGrid><StatTile label="Total points" value={pts.total} /><StatTile label="Weekly points" value={pts.weekly} /></StatGrid>
            <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
              <div><FieldLabel htmlFor="pt-delta">Change (use a minus sign to remove)</FieldLabel><FieldInput id="pt-delta" inputMode="numeric" value={delta} onChange={e => setDelta(e.target.value)} placeholder="e.g. 50 or -20" /></div>
              <div><FieldLabel htmlFor="pt-reason">Reason (required, audited)</FieldLabel><FieldInput id="pt-reason" value={reason} onChange={e => setReason(e.target.value)} /></div>
              <PrimaryBtn small disabled={busy || !Number.isInteger(d) || d === 0 || !reason.trim()}
                onClick={async () => { if (await post({ action: 'adjust', userId: picked.id, delta: d, reason }, 'Points adjusted')) { setDelta(''); setReason(''); } }}>Apply</PrimaryBtn>
            </div>
          </>
        ) : <p style={{ color: MUTED }}>This student has no LexiCore progress yet.</p>)}
      </SuperCard>

      <SuperCard title="Weekly leaderboard" tone="danger">
        <p style={{ color: MUTED, fontSize: T_SM, marginTop: 0 }}>
          Zeroes every student&apos;s weekly points. A snapshot is saved first so the reset can be undone (points earned since are kept).
        </p>
        <div style={{ maxWidth: 420, display: 'grid', gap: 10 }}>
          <div><FieldLabel htmlFor="rs-reason">Reason</FieldLabel><FieldInput id="rs-reason" value={resetReason} onChange={e => setResetReason(e.target.value)} /></div>
          <PrimaryBtn small disabled={busy || !resetReason.trim()} onClick={() => setConfirming(true)}>Reset weekly board...</PrimaryBtn>
        </div>
        {snap && (
          <div style={{ marginTop: 16, fontSize: T_SM }}>
            <p style={{ margin: '0 0 8px' }}>Last reset: {fmtDhaka(snap.takenAt)}, {snap.rows} students, reason: {snap.reason}</p>
            <GhostBtn disabled={busy} onClick={() => void post({ action: 'undo-reset' }, 'Weekly board restored')}>Undo last reset</GhostBtn>
          </div>
        )}
      </SuperCard>

      <TypedConfirm open={confirming} title="Reset weekly board" message="Every student's weekly points go to 0 and the board restarts."
        phrase="RESET" confirmLabel="Reset" loading={busy} onCancel={() => setConfirming(false)}
        onConfirm={async () => { if (await post({ action: 'reset-weekly', reason: resetReason, confirm: 'RESET' }, 'Weekly board reset')) setResetReason(''); setConfirming(false); }} />
    </>
  );
}
