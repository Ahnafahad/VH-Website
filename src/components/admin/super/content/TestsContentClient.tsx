'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  MUTED, SPIN_CSS, T_SM, Toast, TabBar, FieldSelect, FieldTextarea, FieldLabel, FormActions,
  GhostBtn, PrimaryBtn, DangerBtn, Modal, fmtDhaka,
} from '../../lms/lms-shared';
import { SuperHeader, SuperCard, SuperTable, SuperBadge, StatGrid, StatTile, TypedConfirm, superApi, tdStyle } from '../super-ui';

interface TestRow { id: number; title: string; slug: string; bucket: string; status: string }
interface Attempt { id: number; name: string; email: string; score: number | null; voided: boolean }
interface Diff { questionsChanged: number; keysChanged: number; added: number; removed: number }
interface Version { id: number; reason: string; createdBy: string | null; createdAt: number; diff: Diff }
interface RegradeRow { attemptId: number; name: string; oldScore: number; newScore: number; oldRank: number; newRank: number; rankDelta: number; changed: boolean }
interface RegradeDiff { rows: RegradeRow[]; total: number; changedCount: number; rankChangedCount: number; topMovers: RegradeRow[] }

export default function TestsContentClient() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [testId, setTestId] = useState<number | null>(null);
  const [tab, setTab] = useState('regrade');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [preview, setPreview] = useState<RegradeDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'regrade' | { restore: number } | null>(null);
  const [voidFor, setVoidFor] = useState<Attempt | null>(null);
  const [reason, setReason] = useState('');

  const fail = (e: unknown) => setToast((e as Error).message);
  const url = `/api/admin/super/content/tests/${testId}`;

  useEffect(() => {
    superApi<{ tests: TestRow[] }>('/api/admin/super/content/tests').then(d => setTests(d.tests)).catch(fail);
  }, []);

  const loadDetail = useCallback(async () => {
    if (testId == null) return;
    try {
      const d = await superApi<{ attempts: Attempt[]; versions: Version[] }>(`/api/admin/super/content/tests/${testId}`);
      setAttempts(d.attempts); setVersions(d.versions);
    } catch (e) { fail(e); }
  }, [testId]);

  useEffect(() => { setPreview(null); setAttempts([]); setVersions([]); loadDetail(); }, [loadDetail]);

  async function post<T>(body: unknown): Promise<T> {
    setBusy(true);
    try { return await superApi<T>(url, { method: 'POST', body }); } finally { setBusy(false); }
  }

  async function runPreview() {
    try { setPreview(await post<RegradeDiff>({ action: 'regrade-preview' })); } catch (e) { fail(e); }
  }
  async function apply() {
    try {
      const r = await post<{ changed: number; total: number }>({ action: 'regrade-apply', confirm: 'REGRADE' });
      setToast(`Regraded: ${r.changed} of ${r.total} attempts changed`);
      setConfirm(null); setPreview(null); loadDetail();
    } catch (e) { fail(e); setConfirm(null); }
  }
  async function doVoid() {
    if (!voidFor) return;
    try {
      await post({ action: 'void', attemptId: voidFor.id, reason });
      setToast('Attempt voided'); setVoidFor(null); setReason(''); loadDetail();
    } catch (e) { fail(e); }
  }
  async function unvoid(a: Attempt) {
    try { await post({ action: 'unvoid', attemptId: a.id }); setToast('Attempt restored'); loadDetail(); } catch (e) { fail(e); }
  }
  async function restore(versionId: number) {
    try {
      const d = await post<Diff>({ action: 'restore', versionId, confirm: 'RESTORE' });
      setToast(`Restored: ${d.keysChanged} keys, ${d.questionsChanged} questions. Run a regrade preview to update scores.`);
      setConfirm(null); loadDetail();
    } catch (e) { fail(e); setConfirm(null); }
  }

  return (
    <div>
      <style>{SPIN_CSS}</style>
      <SuperHeader title="Content & tests" subtitle="Regrade after a key fix, void attempts, and roll back test versions." />
      <SuperCard>
        <FieldLabel htmlFor="super-test">Test</FieldLabel>
        <FieldSelect id="super-test" value={testId ?? ''} onChange={e => setTestId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose a test…</option>
          {tests.map(t => <option key={t.id} value={t.id}>{t.title} ({t.bucket}, {t.status})</option>)}
        </FieldSelect>
      </SuperCard>

      {testId != null && (
        <>
          <TabBar tabs={[{ id: 'regrade', label: 'Regrade' }, { id: 'attempts', label: 'Attempts' }, { id: 'versions', label: 'Versions' }]} active={tab} onChange={setTab} />

          {tab === 'regrade' && (
            <SuperCard title="Regrade submitted attempts" action={<PrimaryBtn small loading={busy} onClick={runPreview}>Preview</PrimaryBtn>}>
              <p style={{ margin: '0 0 12px', fontSize: T_SM, color: MUTED }}>Recomputes every submitted attempt with the live answer key. Nothing is saved until you apply.</p>
              {preview && (
                <>
                  <StatGrid>
                    <StatTile label="Attempts" value={preview.total} />
                    <StatTile label="Scores changing" value={preview.changedCount} tone={preview.changedCount ? 'warn' : 'ok'} />
                    <StatTile label="Rank changes" value={preview.rankChangedCount} />
                  </StatGrid>
                  {preview.topMovers.length > 0 && (
                    <p style={{ fontSize: T_SM }}>Top movers: {preview.topMovers.map(m => `${m.name} (#${m.oldRank} to #${m.newRank})`).join(', ')}</p>
                  )}
                  <SuperTable head={['Student', 'Old', 'New', 'Rank']}>
                    {preview.rows.filter(r => r.changed || r.rankDelta !== 0).map(r => (
                      <tr key={r.attemptId}>
                        <td style={tdStyle}>{r.name}</td>
                        <td style={tdStyle}>{r.oldScore}</td>
                        <td style={tdStyle}>{r.newScore}</td>
                        <td style={tdStyle}>#{r.oldRank} to #{r.newRank}</td>
                      </tr>
                    ))}
                  </SuperTable>
                  <FormActions>
                    <DangerBtn disabled={preview.changedCount === 0} onClick={() => setConfirm('regrade')}>Apply regrade</DangerBtn>
                  </FormActions>
                </>
              )}
            </SuperCard>
          )}

          {tab === 'attempts' && (
            <SuperCard title="Submitted attempts">
              <SuperTable head={['Student', 'Score', 'State', '']}>
                {attempts.map(a => (
                  <tr key={a.id}>
                    <td style={tdStyle}>{a.name}<br /><span style={{ color: MUTED }}>{a.email}</span></td>
                    <td style={tdStyle}>{a.score ?? '-'}</td>
                    <td style={tdStyle}>{a.voided ? <SuperBadge tone="bad">Voided</SuperBadge> : <SuperBadge tone="ok">Counted</SuperBadge>}</td>
                    <td style={tdStyle}>
                      {a.voided
                        ? <GhostBtn small onClick={() => unvoid(a)} disabled={busy}>Restore</GhostBtn>
                        : <DangerBtn small onClick={() => setVoidFor(a)}>Void</DangerBtn>}
                    </td>
                  </tr>
                ))}
              </SuperTable>
            </SuperCard>
          )}

          {tab === 'versions' && (
            <SuperCard title="Version history">
              {versions.length === 0 && <p style={{ margin: 0, color: MUTED, fontSize: T_SM }}>No versions yet. One is saved before every answer-key edit, regrade, or restore.</p>}
              {versions.length > 0 && (
                <SuperTable head={['When', 'By', 'Reason', 'Vs current', '']}>
                  {versions.map(v => (
                    <tr key={v.id}>
                      <td style={tdStyle}>{fmtDhaka(v.createdAt)}</td>
                      <td style={tdStyle}>{v.createdBy ?? '-'}</td>
                      <td style={tdStyle}>{v.reason}</td>
                      <td style={tdStyle}>{v.diff.keysChanged} keys, {v.diff.questionsChanged} questions differ{v.diff.added || v.diff.removed ? `, +${v.diff.added}/-${v.diff.removed} questions` : ''}</td>
                      <td style={tdStyle}><GhostBtn small onClick={() => setConfirm({ restore: v.id })}>Restore</GhostBtn></td>
                    </tr>
                  ))}
                </SuperTable>
              )}
            </SuperCard>
          )}
        </>
      )}

      <TypedConfirm
        open={confirm === 'regrade'} title="Apply regrade" phrase="REGRADE" confirmLabel="Apply" loading={busy}
        message={`This overwrites the stored scores of ${preview?.changedCount ?? 0} attempts. A version snapshot is saved first.`}
        onConfirm={apply} onCancel={() => setConfirm(null)}
      />
      <TypedConfirm
        open={typeof confirm === 'object' && confirm !== null} title="Restore version" phrase="RESTORE" confirmLabel="Restore" loading={busy}
        message="Answer keys and question content go back to this version (a snapshot of the current state is saved first). Stored scores are not changed until you regrade."
        onConfirm={() => typeof confirm === 'object' && confirm && restore(confirm.restore)} onCancel={() => setConfirm(null)}
      />
      <Modal open={voidFor !== null} title="Void attempt" onClose={() => setVoidFor(null)}>
        <p style={{ margin: '0 0 10px', fontSize: T_SM }}>{voidFor?.name}'s attempt will be excluded from leaderboards and results.</p>
        <FieldLabel htmlFor="void-reason">Reason (required)</FieldLabel>
        <FieldTextarea id="void-reason" value={reason} onChange={e => setReason(e.target.value)} />
        <FormActions>
          <GhostBtn onClick={() => setVoidFor(null)}>Cancel</GhostBtn>
          <DangerBtn disabled={busy || reason.trim().length < 3} onClick={doVoid}>Void attempt</DangerBtn>
        </FormActions>
      </Modal>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
