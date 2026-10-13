'use client';

import { useCallback, useEffect, useState } from 'react';
import { FieldInput, GhostBtn, DangerBtn, useConfirm, fmtDhaka, MUTED, T_SM } from '../../lms/lms-shared';
import { SuperCard, SuperBadge, SuperTable, tdStyle, superApi } from '../super-ui';
import StudentPicker, { type PickedUser } from './StudentPicker';

interface Overview {
  user: PickedUser;
  tests: { id: number; title: string; status: string; mode: string; score: number | null; startedAt: number | null; submittedAt: number | null }[];
  sprints: { id: number; title: string; correct: number; of: number; submittedAt: number | null }[];
  marathon: { id: number; chapter: string; day: number; status: string; correct: number | null; startedAt: number | null }[];
  recordings: { id: number; title: string; at: number | null; grantedUntil: number | null }[];
}

export default function OverridesTab({ notify }: { notify: (m: string) => void }) {
  const [picked, setPicked] = useState<PickedUser | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [minutes, setMinutes] = useState('60');
  const [days, setDays] = useState('14');
  const [confirm, dialog] = useConfirm();

  const load = useCallback(async (id: number) => {
    try { setOv(await superApi<Overview>(`/api/admin/super/people/students/overview?userId=${id}`)); }
    catch (e) { notify((e as Error).message); }
  }, [notify]);
  useEffect(() => { if (picked) void load(picked.id); else setOv(null); }, [picked, load]);

  async function run(body: Record<string, unknown>, title: string, message: string, done: string, destructive = false) {
    if (!(await confirm({ title, message, confirmLabel: 'Apply', destructive }))) return;
    try {
      await superApi('/api/admin/super/people/students/overrides', { method: 'POST', body });
      notify(done);
      if (picked) await load(picked.id);
    } catch (e) { notify((e as Error).message); }
  }

  const mins = Math.max(5, parseInt(minutes, 10) || 60);
  const dayN = Math.max(1, parseInt(days, 10) || 14);

  return (
    <>
      <SuperCard>
        <StudentPicker value={picked} onPick={setPicked} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 420 }}>
          <label style={{ flex: 1, fontSize: T_SM, color: MUTED }}>Test minutes from now<FieldInput inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
          <label style={{ flex: 1, fontSize: T_SM, color: MUTED }}>Recording grant days<FieldInput inputMode="numeric" value={days} onChange={e => setDays(e.target.value)} /></label>
        </div>
        <p style={{ color: MUTED, fontSize: T_SM, margin: '10px 0 0' }}>
          Reopen/extend creates a one-off window closing in the chosen minutes and moves only this student&apos;s attempt to it.
          Marathon early-unlock is not available: days unlock per batch assignment, not per student.
        </p>
      </SuperCard>

      {ov && (
        <>
          <SuperCard title="Test attempts">
            <SuperTable head={['Test', 'Status', 'Score', 'Started', 'Action']}>
              {ov.tests.map(t => (
                <tr key={t.id}>
                  <td style={tdStyle}>{t.title}</td>
                  <td style={tdStyle}><SuperBadge tone={t.status === 'submitted' ? 'ok' : t.status === 'banned' ? 'bad' : 'warn'}>{t.status}</SuperBadge></td>
                  <td style={tdStyle}>{t.score ?? 'n/a'}</td>
                  <td style={tdStyle}>{t.startedAt ? fmtDhaka(t.startedAt) : 'n/a'}</td>
                  <td style={tdStyle}>
                    {t.status === 'submitted' && <GhostBtn small onClick={() => void run({ action: 'test.reopen', attemptId: t.id, minutes: mins }, 'Reopen attempt', `Reopen "${t.title}" for ${ov.user.name}? The submitted score is cleared and recomputed on resubmit. They get ${mins} minutes.`, 'Attempt reopened', true)}>Reopen</GhostBtn>}
                    {t.status === 'in_progress' && <GhostBtn small onClick={() => void run({ action: 'test.extend', attemptId: t.id, minutes: mins }, 'Extend window', `Give ${ov.user.name} until ${mins} minutes from now on "${t.title}"?`, 'Window extended')}>Extend</GhostBtn>}
                  </td>
                </tr>
              ))}
            </SuperTable>
            {ov.tests.length === 0 && <p style={{ color: MUTED }}>No test attempts.</p>}
          </SuperCard>

          <SuperCard title="Recordings (latest 40)">
            <SuperTable head={['Class', 'Date', 'Student grant', 'Action']}>
              {ov.recordings.map(r => (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.title}</td>
                  <td style={tdStyle}>{r.at ? fmtDhaka(r.at) : 'n/a'}</td>
                  <td style={tdStyle}>{r.grantedUntil ? `until ${fmtDhaka(r.grantedUntil)}` : 'none'}</td>
                  <td style={tdStyle}><GhostBtn small onClick={() => void run({ action: 'recording.grant', userId: ov.user.id, recordingId: r.id, days: dayN }, 'Unlock recording', `Unlock "${r.title}" for ${ov.user.name} for ${dayN} days?`, 'Recording unlocked')}>Unlock</GhostBtn></td>
                </tr>
              ))}
            </SuperTable>
          </SuperCard>

          <SuperCard title="Sprint attempts">
            <SuperTable head={['Set', 'Score', 'Submitted', 'Action']}>
              {ov.sprints.map(s => (
                <tr key={s.id}>
                  <td style={tdStyle}>{s.title}</td>
                  <td style={tdStyle}>{s.correct}/{s.of}</td>
                  <td style={tdStyle}>{s.submittedAt ? fmtDhaka(s.submittedAt) : 'n/a'}</td>
                  <td style={tdStyle}><DangerBtn small onClick={() => void run({ action: 'sprint.reset', attemptId: s.id }, 'Reset Sprint attempt', `Delete ${ov.user.name}'s attempt on "${s.title}" so they can retake it? The old answers are kept in the audit log.`, 'Sprint attempt reset', true)}>Reset</DangerBtn></td>
                </tr>
              ))}
            </SuperTable>
            {ov.sprints.length === 0 && <p style={{ color: MUTED }}>No Sprint attempts.</p>}
          </SuperCard>

          <SuperCard title="Marathon attempts">
            <SuperTable head={['Chapter', 'Day', 'Status', 'Correct', 'Action']}>
              {ov.marathon.map(m => (
                <tr key={m.id}>
                  <td style={tdStyle}>{m.chapter}</td>
                  <td style={tdStyle}>{m.day}</td>
                  <td style={tdStyle}>{m.status}</td>
                  <td style={tdStyle}>{m.correct ?? 'n/a'}</td>
                  <td style={tdStyle}><DangerBtn small onClick={() => void run({ action: 'marathon.reset', attemptId: m.id }, 'Reset Marathon attempt', `Delete ${ov.user.name}'s Day ${m.day} attempt in "${m.chapter}"? The old answers are kept in the audit log.`, 'Marathon attempt reset', true)}>Reset</DangerBtn></td>
                </tr>
              ))}
            </SuperTable>
            {ov.marathon.length === 0 && <p style={{ color: MUTED }}>No Marathon attempts.</p>}
          </SuperCard>
        </>
      )}
      {dialog}
    </>
  );
}
