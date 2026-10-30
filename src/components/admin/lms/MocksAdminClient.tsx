'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import {
  SPIN_CSS, PageHeader, EmptyState, PrimaryBtn, GhostBtn, DangerBtn, FieldLabel, FieldInput, FieldSelect,
  ConfirmDialog, Toast, fmtDhaka,
  RED, SLATE, BORDER, MUTED, BG, SURFACE, SURFACE_ALT, OK, OK_BG, WARN, WARN_BG, R_LG, R_MD, R_PILL, SHADOW_SM,
} from './lms-shared';
import { uploadToR2 } from '@/lib/lms/upload-client';
import type { MockAdminEntry, MockAdminOverview } from '@/lib/mocks/types';

interface OmrReport {
  applied: boolean; expectedLength: number; total: number; matched: number; created: number; overwritten: number;
  unknownStudents: string[]; badLength: string[]; duplicates: string[]; skippedBanned: string[];
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}
const patch = (url: string, body: unknown) =>
  api(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const pill = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: R_PILL, background: bg, color: fg, fontSize: 11, fontWeight: 700,
});
const panel: React.CSSProperties = {
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 20, boxShadow: SHADOW_SM,
};
const sub: React.CSSProperties = { margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.07em', textTransform: 'uppercase' };

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: SURFACE_ALT, borderRadius: R_MD, padding: '10px 14px', minWidth: 92 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: SLATE, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
    </div>
  );
}

function OmrImport({ mock, onDone, toast }: { mock: MockAdminEntry; onDone: () => void; toast: (m: string) => void }) {
  const [json, setJson] = useState<unknown>(null);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<OmrReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const run = async (apply: boolean) => {
    setBusy(true);
    try {
      const r = await api<OmrReport>(`/api/admin/mocks/${mock.id}/omr${apply ? '?apply=1' : ''}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json),
      });
      setReport(r);
      if (apply) { toast(`Imported ${r.matched} scanned sheets`); onDone(); }
    } catch (e) { toast(e instanceof Error ? e.message : 'Import failed'); }
    setBusy(false); setConfirm(false);
  };

  const onFile = async (f: File | undefined) => {
    setReport(null); setJson(null); setFileName(f?.name ?? '');
    if (!f) return;
    try { setJson(JSON.parse(await f.text())); } catch { toast('That file is not valid JSON'); setFileName(''); }
  };

  const problems = report ? report.unknownStudents.length + report.badLength.length + report.duplicates.length + report.skippedBanned.length : 0;

  return (
    <div>
      <p style={sub}>Scanned OMR results</p>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: MUTED }}>
        Official source. Overwrites anything a student typed or took online. Expects {mock.totalQuestions} answers per student, matched by student ID.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="file" accept="application/json,.json" onChange={e => onFile(e.target.files?.[0])} aria-label="OMR results JSON file" />
        <GhostBtn small disabled={!json || busy} onClick={() => run(false)}>Check (dry run)</GhostBtn>
        {report && !report.applied && report.matched > 0 && (
          <PrimaryBtn small loading={busy} onClick={() => setConfirm(true)}>Apply {report.matched} sheets</PrimaryBtn>
        )}
      </div>
      {report && (
        <div style={{ marginTop: 10, fontSize: 12, color: SLATE, background: problems ? WARN_BG : OK_BG, borderRadius: R_MD, padding: 12 }}>
          <strong>{fileName}</strong>: {report.total} rows · {report.matched} matched ({report.overwritten} overwrite typed answers, {report.created} new){report.applied ? ' — applied' : ''}
          {report.unknownStudents.length > 0 && <div style={{ color: WARN }}>Unknown student IDs: {report.unknownStudents.join(', ')}</div>}
          {report.badLength.length > 0 && <div style={{ color: WARN }}>Wrong answer count (need {report.expectedLength}): {report.badLength.join(', ')}</div>}
          {report.duplicates.length > 0 && <div style={{ color: WARN }}>Duplicate rows ignored: {report.duplicates.join(', ')}</div>}
          {report.skippedBanned.length > 0 && <div style={{ color: WARN }}>Banned, left untouched: {report.skippedBanned.join(', ')}</div>}
        </div>
      )}
      <ConfirmDialog
        open={confirm} title="Apply scanned results?" confirmLabel="Apply" loading={busy}
        message={`This overwrites the answers and scores of ${report?.overwritten ?? 0} students who already have an entry and creates ${report?.created ?? 0} new ones.`}
        onConfirm={() => run(true)} onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

function MockCard({ mock, series, reload, toast }: {
  mock: MockAdminEntry; series: MockAdminOverview['essaySeries']; reload: () => void; toast: (m: string) => void;
}) {
  const [examCode, setExamCode] = useState(mock.examCode ?? '');
  const [batch, setBatch] = useState(mock.mockBatch ?? '');
  const [essaySeriesId, setEssaySeriesId] = useState(mock.essaySeriesId ? String(mock.essaySeriesId) : '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishAsk, setPublishAsk] = useState<'publish' | 'unpublish' | null>(null);
  const published = mock.resultsPublishedAt != null;

  const save = async () => {
    setSaving(true);
    try {
      await patch(`/api/admin/mocks/${mock.id}`, {
        examCode: examCode.trim() || null, mockBatch: batch.trim() || null,
        essaySeriesId: essaySeriesId ? Number(essaySeriesId) : null,
      });
      toast('Saved'); reload();
    } catch (e) { toast(e instanceof Error ? e.message : 'Save failed'); }
    setSaving(false);
  };

  const uploadSolution = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { toast('Solutions must be a PDF'); return; }
    setUploading(true);
    try {
      const { key } = await uploadToR2({ file, endpoint: `/api/admin/mocks/${mock.id}/solution-upload` });
      await patch(`/api/admin/mocks/${mock.id}`, { solutionPdfKey: key });
      toast('Solutions PDF uploaded'); reload();
    } catch (e) { toast(e instanceof Error ? e.message : 'Upload failed'); }
    setUploading(false);
  };

  const setPublished = async (publish: boolean) => {
    try {
      await patch(`/api/admin/tests/${mock.id}`, { publishResults: publish });
      toast(publish ? 'Results published' : 'Results hidden again'); reload();
    } catch (e) { toast(e instanceof Error ? e.message : 'Failed'); }
    setPublishAsk(null);
  };

  const unscanned = mock.attempts.submitted - mock.attempts.scanned;
  const essayPending = mock.essay ? mock.essay.submitted : 0;
  const warnings = [
    mock.attempts.inProgress > 0 && `${mock.attempts.inProgress} attempts are still in progress`,
    mock.attempts.scanned === 0 && 'no scanned OMR results imported yet',
    mock.attempts.scanned > 0 && unscanned > 0 && `${unscanned} submitted entries have no scan`,
    essayPending > 0 && `${essayPending} essays are not marked yet`,
    !mock.essay && 'no essay series linked',
    !mock.hasSolution && 'no solutions PDF uploaded',
  ].filter(Boolean) as string[];

  return (
    <section style={{ ...panel, display: 'grid', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: SLATE }}>{mock.title}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>
            {mock.totalQuestions} MCQs · {mock.totalMarks} marks · {mock.status}
          </p>
        </div>
        <span style={published ? pill(OK_BG, OK) : pill(WARN_BG, WARN)}>
          {published ? `Results published ${fmtDhaka(mock.resultsPublishedAt!, { dateStyle: 'medium' })}` : 'Results hidden'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Stat label="expected" value={mock.cohortSize} />
        <Stat label="in progress" value={mock.attempts.inProgress} />
        <Stat label="submitted" value={mock.attempts.submitted} />
        <Stat label="scans imported" value={mock.attempts.scanned} />
        <Stat label="banned" value={mock.attempts.banned} />
      </div>

      <div>
        <p style={sub}>Windows</p>
        {mock.windows.length === 0 && <p style={{ margin: 0, fontSize: 13, color: WARN }}>No windows yet.</p>}
        {mock.windows.map(w => (
          <div key={w.id} style={{ fontSize: 13, color: SLATE, padding: '3px 0' }}>
            <span style={pill(w.state === 'open' ? OK_BG : SURFACE_ALT, w.state === 'open' ? OK : MUTED)}>{w.state}</span>{' '}
            {w.mode === 'online' ? 'Online' : 'In-class entry'} · {fmtDhaka(w.opensAt)} – {fmtDhaka(w.closesAt, { timeStyle: 'short' })}
            {w.durationMinutes ? ` · ${w.durationMinutes} min` : ''}
          </div>
        ))}
        <Link href="/admin/tests" style={{ fontSize: 12, color: RED }}>Add / change windows and view question analytics in Tests →</Link>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <div><FieldLabel htmlFor={`code-${mock.id}`}>Exam code</FieldLabel>
          <FieldInput id={`code-${mock.id}`} value={examCode} onChange={e => setExamCode(e.target.value)} placeholder="9001" /></div>
        <div><FieldLabel htmlFor={`batch-${mock.id}`}>Batch (blank = all)</FieldLabel>
          <FieldInput id={`batch-${mock.id}`} value={batch} onChange={e => setBatch(e.target.value)} placeholder="2026-27" /></div>
        <div><FieldLabel htmlFor={`series-${mock.id}`}>Essay series (Part 2)</FieldLabel>
          <FieldSelect id={`series-${mock.id}`} value={essaySeriesId} onChange={e => setEssaySeriesId(e.target.value)}>
            <option value="">None</option>
            {series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </FieldSelect></div>
        <div style={{ alignSelf: 'end' }}><PrimaryBtn small loading={saving} onClick={save}>Save settings</PrimaryBtn></div>
      </div>

      {mock.essay && (
        <p style={{ margin: 0, fontSize: 13, color: SLATE }}>
          Essays · {mock.essay.title}: {mock.essay.submitted} to mark · {mock.essay.graded} marked · {mock.essay.rejected} sent back.{' '}
          <Link href="/admin/essays" style={{ color: RED }}>Open marking →</Link>
        </p>
      )}

      <OmrImport mock={mock} onDone={reload} toast={toast} />

      <div>
        <p style={sub}>Solutions PDF</p>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: MUTED }}>Students receive it with the published results.</p>
        <span style={{ fontSize: 13, color: SLATE, marginRight: 12 }}>{mock.hasSolution ? 'Uploaded — choose a file to replace' : 'Not uploaded'}</span>
        <input type="file" accept="application/pdf" disabled={uploading} onChange={e => uploadSolution(e.target.files?.[0])} aria-label="Solutions PDF" />
        {uploading && <span style={{ fontSize: 12, color: MUTED }}> uploading…</span>}
      </div>

      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R_MD, padding: 14 }}>
        <p style={sub}>Publish</p>
        {!published && warnings.length > 0 && (
          <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12, color: WARN }}>{warnings.map(w => <li key={w}>{w}</li>)}</ul>
        )}
        {published
          ? <DangerBtn small onClick={() => setPublishAsk('unpublish')}>Hide results again</DangerBtn>
          : <PrimaryBtn small onClick={() => setPublishAsk('publish')}>Publish official results</PrimaryBtn>}
      </div>

      <ConfirmDialog
        open={publishAsk !== null}
        title={publishAsk === 'publish' ? 'Publish official results?' : 'Hide the results?'}
        message={publishAsk === 'publish'
          ? 'Students will see their final score, rank, missed chances and the solutions PDF. Provisional entries stop being used.'
          : 'Students go back to seeing the provisional view only.'}
        confirmLabel={publishAsk === 'publish' ? 'Publish' : 'Hide'}
        destructive={publishAsk === 'unpublish'}
        onConfirm={() => setPublished(publishAsk === 'publish')}
        onCancel={() => setPublishAsk(null)}
      />
    </section>
  );
}

export default function MocksAdminClient() {
  const [data, setData] = useState<MockAdminOverview | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newBatch, setNewBatch] = useState('2026-27');

  const load = useCallback(async () => {
    try { setData(await api<MockAdminOverview>('/api/admin/mocks')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load mocks'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // live monitor: refresh every 20 s while any window is open
  const anyOpen = data?.mocks.some(m => m.windows.some(w => w.state === 'open')) ?? false;
  useEffect(() => {
    if (!anyOpen) return;
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [anyOpen, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const createMock = async () => {
    try {
      await patch(`/api/admin/mocks/${pick}`, { isMock: true, examCode: newCode.trim() || null, mockBatch: newBatch.trim() || null });
      setPick(''); setNewCode(''); setToast('Test is now a mock'); await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 980, margin: '0 auto' }}>
      <style>{SPIN_CSS}</style>
      <PageHeader
        title="Mocks"
        subtitle="Full-length exams: MCQ sections plus essays. Typed/online entries show as provisional; scanned OMR sheets are official."
      />
      {error && <p style={{ color: RED, fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'grid', gap: 18 }}>
        {data && data.mocks.length === 0 && (
          <EmptyState icon={ClipboardCheck} message="No mocks yet. Import the paper as a test, then turn it into a mock below." />
        )}
        {data?.mocks.map(m => <MockCard key={m.id} mock={m} series={data.essaySeries} reload={load} toast={setToast} />)}

        {data && (
          <section style={panel}>
            <p style={sub}>Turn a test into a mock</p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: MUTED }}>
              Import the paper and answer key first (test import), then pick it here. It disappears from the normal tests list and appears on students’ Mocks page.
            </p>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              <div><FieldLabel htmlFor="new-test">Test</FieldLabel>
                <FieldSelect id="new-test" value={pick} onChange={e => setPick(e.target.value)}>
                  <option value="">Choose a test…</option>
                  {data.candidates.map(t => <option key={t.id} value={t.id}>{t.title} ({t.status})</option>)}
                </FieldSelect></div>
              <div><FieldLabel htmlFor="new-code">Exam code</FieldLabel>
                <FieldInput id="new-code" value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="9001" /></div>
              <div><FieldLabel htmlFor="new-batch">Batch</FieldLabel>
                <FieldInput id="new-batch" value={newBatch} onChange={e => setNewBatch(e.target.value)} /></div>
              <div style={{ alignSelf: 'end' }}><PrimaryBtn small disabled={!pick} onClick={createMock}>Make it a mock</PrimaryBtn></div>
            </div>
          </section>
        )}
      </div>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
