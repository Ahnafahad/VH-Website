'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileDown, Lock, Star, Users } from 'lucide-react';
import {
  BG, BORDER, FieldSelect, GhostBtn, INFO, INFO_BG, MUTED, Modal, OK, OK_BG, PrimaryBtn, R_LG, R_PILL, RED, SLATE, SPIN_CSS, SURFACE,
  SURFACE_ALT, T_BASE, T_SM, T_XS, TabBar, Toast, WARN, WARN_BG, FormActions, fmtDhaka,
} from '@/components/admin/lms/lms-shared';
import { ScoreHistogram } from '@/components/essays/EssayCharts';
import { buildMarkedPdf, downloadBlob, type MarkedScript } from '@/lib/essays/render-client';
import type { EssayHistogramBin, EssayPageDTO, EssaySection } from '@/lib/essays/types';

interface ScriptRow {
  id: number;
  userId: number;
  studentName: string;
  studentEmail: string;
  studentId: string | null;
  essayIndex: number;
  status: 'submitted' | 'graded' | 'rejected';
  attempt: number;
  submittedAt: string;
  total: number | null;
  pageCount: number;
  markedPages: number;
  gradedBy: string | null;
  gradedAt: string | null;
  rejectReason: string | null;
  lockedBy: { id: number; name: string } | null;
  assignedTo: { id: number; name: string } | null;
  isReference: boolean;
  referenceLabel: string | null;
}

interface Data {
  series: {
    id: number; title: string; prompt: string; essayDate: string | null; essayCount: number; sections: EssaySection[];
    totalMarks: number; product: string; batch: string | null; deadline: string; status: string; publishedAt: string | null;
  };
  scripts: ScriptRow[];
  missing: { userId: number; name: string; email: string; missingEssays: number[] }[];
  audienceSize: number;
  stats: { count: number; average: number | null; highest: number | null; lowest: number | null; histogram: EssayHistogramBin[]; sectionAverages: { key: string; name: string; max: number; average: number | null }[] };
  viewer: { id: number; isAdmin: boolean };
}

type Filter = 'all' | 'submitted' | 'graded' | 'rejected' | 'mine';

const STATUS_STYLE: Record<ScriptRow['status'], [string, string, string]> = {
  submitted: ['To mark', WARN, WARN_BG],
  graded: ['Graded', OK, OK_BG],
  rejected: ['Rejected', RED, `${RED}12`],
};

export default function SeriesScriptsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [graders, setGraders] = useState<{ id: number; name: string; role: string }[]>([]);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/essays/series/${id}/scripts`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error ?? 'Could not load'); return; }
    setData(j);
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/essays/graders').then(r => (r.ok ? r.json() : { graders: [] })).then(j => setGraders(j.graders)).catch(() => {});
  }, []);

  const scripts = useMemo(() => {
    if (!data) return [];
    return data.scripts.filter(s =>
      filter === 'all' ? true : filter === 'mine' ? s.assignedTo?.id === data.viewer.id : s.status === filter);
  }, [data, filter]);

  if (error) return <p style={{ color: RED, fontSize: T_SM }}>{error}</p>;
  if (!data) return <p style={{ color: MUTED, fontSize: T_SM }}>Loading…</p>;

  const s = data.series;
  const counts = {
    submitted: data.scripts.filter(x => x.status === 'submitted').length,
    graded: data.scripts.filter(x => x.status === 'graded').length,
    rejected: data.scripts.filter(x => x.status === 'rejected').length,
  };
  const done = counts.graded + counts.rejected;
  const open = new Date(s.deadline).getTime() > Date.now();

  const assignOne = async (submissionId: number, graderId: number | null) => {
    const res = await fetch(`/api/admin/essays/series/${s.id}/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'set', submissionId, graderId }),
    });
    if (res.ok) void load();
  };

  const toggleReference = async (row: ScriptRow) => {
    let label: string | null = null;
    if (!row.isReference) {
      label = window.prompt('Label for this reference script (e.g. "Strong 16/20"):', `${row.total}/${s.totalMarks}`);
      if (label === null) return;
    }
    const res = await fetch(`/api/admin/essays/scripts/${row.id}/reference`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isReference: !row.isReference, label }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setToast(j.error ?? 'Could not update'); else void load();
  };

  const downloadAll = async () => {
    setPdfBusy('Loading scripts…');
    try {
      const res = await fetch(`/api/admin/essays/series/${s.id}/bundle`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not load');
      const scriptsForPdf: MarkedScript[] = (j.scripts as {
        studentName: string; essayIndex: number; marks: Record<string, number | null>; sectionComments: Record<string, string>;
        total: number | null; overallFeedback: string; gradedBy: string | null; pages: EssayPageDTO[];
      }[]).map(x => ({
        title: s.essayCount > 1 ? `${s.title} — Essay ${x.essayIndex}` : s.title,
        studentName: x.studentName,
        sections: s.sections,
        marks: x.marks,
        sectionComments: x.sectionComments,
        total: x.total,
        totalMarks: s.totalMarks,
        overallFeedback: x.overallFeedback,
        gradedBy: x.gradedBy,
        pages: x.pages,
      }));
      if (scriptsForPdf.length === 0) { setToast('No graded scripts yet'); return; }
      const blob = await buildMarkedPdf(scriptsForPdf, (d, t) => setPdfBusy(`Rendering page ${d} of ${t}…`));
      downloadBlob(blob, `${s.title.replace(/\s+/g, '-')}-marked-scripts.pdf`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setPdfBusy(null);
    }
  };

  const tile = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 14 } as const;
  const th = { textAlign: 'left' as const, fontSize: T_XS, fontWeight: 700, color: MUTED, padding: '8px 10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' };
  const td = { fontSize: T_BASE, color: SLATE, padding: '10px', borderTop: `1px solid ${BORDER}`, verticalAlign: 'top' as const };

  return (
    <div style={{ maxWidth: 1180 }}>
      <style>{SPIN_CSS}</style>
      <Link href="/admin/essays" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T_SM, color: MUTED, textDecoration: 'none', marginBottom: 12 }}>
        <ArrowLeft size={14} aria-hidden /> All series
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: SLATE }}>{s.title}</h1>
          <p style={{ margin: '4px 0 0', fontSize: T_SM, color: MUTED }}>
            {s.batch ?? 'All batches'} · deadline {fmtDhaka(new Date(s.deadline).getTime())} ({open ? 'open' : 'closed'}) ·{' '}
            {s.publishedAt ? `published ${fmtDhaka(new Date(s.publishedAt).getTime())}` : 'not yet published'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={`/api/admin/essays/series/${s.id}/export`} style={{ textDecoration: 'none' }}><GhostBtn><FileDown size={14} aria-hidden /> Marks (Excel/CSV)</GhostBtn></a>
          <GhostBtn onClick={downloadAll} disabled={!!pdfBusy}><Download size={14} aria-hidden /> {pdfBusy ?? 'All marked scripts (PDF)'}</GhostBtn>
          {data.viewer.isAdmin && <GhostBtn onClick={() => setAssignOpen(true)}><Users size={14} aria-hidden /> Assign graders</GhostBtn>}
          <Link href={`/admin/essays/${s.id}/mark`} style={{ textDecoration: 'none' }}><PrimaryBtn>Start marking</PrimaryBtn></Link>
        </div>
      </div>

      {!s.publishedAt && (
        <div style={{ ...tile, background: INFO_BG, borderColor: `${INFO}33`, color: INFO, fontSize: T_SM, marginBottom: 16 }}>
          {open
            ? 'Results publish automatically after the deadline, once every script is graded or rejected.'
            : counts.submitted > 0
              ? `${counts.submitted} script${counts.submitted === 1 ? '' : 's'} left to mark — results publish automatically when the last one is graded or rejected.`
              : 'Waiting for submissions.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          ['Submitted', `${data.scripts.length}`],
          ['Checked', `${done} / ${data.scripts.length}`],
          ['To mark', `${counts.submitted}`],
          ['Missing', `${data.missing.length} / ${data.audienceSize}`],
          ['Average', data.stats.average === null ? '—' : `${data.stats.average} / ${s.totalMarks}`],
          ['High · Low', data.stats.highest === null ? '—' : `${data.stats.highest} · ${data.stats.lowest}`],
        ].map(([k, v]) => (
          <div key={k} style={tile}>
            <p style={{ margin: 0, fontSize: T_XS, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</p>
            <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: SLATE }}>{v}</p>
          </div>
        ))}
      </div>

      {data.stats.count > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, marginBottom: 20 }}>
          <div style={tile}>
            <p style={{ margin: '0 0 8px', fontSize: T_SM, fontWeight: 700, color: SLATE }}>Distribution of totals (per essay)</p>
            <ScoreHistogram bins={data.stats.histogram} tone="light" height={180} />
          </div>
          <div style={tile}>
            <p style={{ margin: '0 0 8px', fontSize: T_SM, fontWeight: 700, color: SLATE }}>Section averages</p>
            {data.stats.sectionAverages.map(sec => (
              <div key={sec.key} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T_SM, color: SLATE }}>
                  <span>{sec.name}</span><span>{sec.average ?? '—'} / {sec.max}</span>
                </div>
                <div style={{ height: 6, borderRadius: R_PILL, background: BG, marginTop: 4 }}>
                  <div style={{ width: `${sec.average === null ? 0 : (sec.average / sec.max) * 100}%`, height: '100%', borderRadius: R_PILL, background: RED }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TabBar
        tabs={[
          { id: 'all', label: `All (${data.scripts.length})` },
          { id: 'submitted', label: `To mark (${counts.submitted})` },
          { id: 'graded', label: `Graded (${counts.graded})` },
          { id: 'rejected', label: `Rejected (${counts.rejected})` },
          { id: 'mine', label: 'Assigned to me' },
        ]}
        active={filter}
        onChange={k => setFilter(k as Filter)}
      />

      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: SURFACE_ALT }}>
            <tr>
              <th style={th}>Student</th>
              {s.essayCount > 1 && <th style={th}>Essay</th>}
              <th style={th}>Status</th>
              <th style={th}>Total</th>
              <th style={th}>Pages</th>
              <th style={th}>Graded by</th>
              <th style={th}>Assigned</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {scripts.length === 0 && (
              <tr><td style={{ ...td, color: MUTED }} colSpan={8}>Nothing here.</td></tr>
            )}
            {scripts.map(row => {
              const [label, fg, bg] = STATUS_STYLE[row.status];
              return (
                <tr key={row.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{row.studentName}</div>
                    <div style={{ fontSize: T_XS, color: MUTED }}>{row.studentId ?? row.studentEmail} · {fmtDhaka(new Date(row.submittedAt).getTime())}{row.attempt > 1 ? ` · attempt ${row.attempt}` : ''}</div>
                  </td>
                  {s.essayCount > 1 && <td style={td}>{row.essayIndex}</td>}
                  <td style={td}>
                    <span style={{ fontSize: T_XS, fontWeight: 700, padding: '3px 8px', borderRadius: R_PILL, color: fg, background: bg }}>{label}</span>
                    {row.lockedBy && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: T_XS, color: WARN, marginTop: 4 }}><Lock size={10} aria-hidden /> {row.lockedBy.name}</div>}
                    {row.status === 'rejected' && row.rejectReason && <div style={{ fontSize: T_XS, color: MUTED, marginTop: 4, maxWidth: 220 }}>{row.rejectReason}</div>}
                  </td>
                  <td style={td}>{row.total === null ? '—' : `${row.total} / ${s.totalMarks}`}</td>
                  <td style={td}>{row.markedPages}/{row.pageCount} marked</td>
                  <td style={td}>{row.gradedBy ?? '—'}</td>
                  <td style={td}>
                    {data.viewer.isAdmin ? (
                      <FieldSelect aria-label="Assigned grader" value={row.assignedTo?.id ?? ''} onChange={e => assignOne(row.id, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">—</option>
                        {graders.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </FieldSelect>
                    ) : (row.assignedTo?.name ?? '—')}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link href={`/admin/essays/${s.id}/mark?script=${row.id}`} style={{ textDecoration: 'none' }}>
                        <GhostBtn small>{row.status === 'submitted' ? 'Mark' : 'Open'}</GhostBtn>
                      </Link>
                      {row.status === 'graded' && (
                        <GhostBtn small onClick={() => toggleReference(row)}>
                          <Star size={12} aria-hidden fill={row.isReference ? 'currentColor' : 'none'} /> {row.isReference ? (row.referenceLabel ?? 'Reference') : 'Reference'}
                        </GhostBtn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.missing.length > 0 && (
        <details style={{ marginTop: 20, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, padding: 14 }}>
          <summary style={{ cursor: 'pointer', fontSize: T_BASE, fontWeight: 700, color: SLATE }}>Not submitted ({data.missing.length})</summary>
          <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
            {data.missing.map(m => (
              <li key={m.userId} style={{ fontSize: T_SM, color: SLATE }}>
                {m.name}{s.essayCount > 1 && <span style={{ color: MUTED }}> — essay {m.missingEssays.join(', ')}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <AssignModal open={assignOpen} graders={graders} seriesId={s.id} onClose={() => setAssignOpen(false)} onDone={msg => { setAssignOpen(false); setToast(msg); void load(); }} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function AssignModal({ open, graders, seriesId, onClose, onDone }: {
  open: boolean; graders: { id: number; name: string; role: string }[]; seriesId: number; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const run = async (mode: 'split' | 'clear') => {
    setBusy(true);
    const res = await fetch(`/api/admin/essays/series/${seriesId}/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, graderIds: picked }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    onDone(res.ok ? (mode === 'clear' ? 'Assignments cleared' : `${j.assigned} scripts split between ${picked.length} grader${picked.length === 1 ? '' : 's'}`) : j.error ?? 'Failed');
  };
  return (
    <Modal open={open} onClose={onClose} title="Assign graders" width={460}>
      <p style={{ margin: '0 0 12px', fontSize: T_SM, color: MUTED }}>
        Splits the scripts still waiting to be marked into equal blocks (alphabetical by student). Each grader gets an &ldquo;Assigned to me&rdquo; filter; anyone can still mark any script.
      </p>
      <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
        {graders.map(g => (
          <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T_BASE, color: SLATE }}>
            <input type="checkbox" checked={picked.includes(g.id)} onChange={e => setPicked(p => (e.target.checked ? [...p, g.id] : p.filter(x => x !== g.id)))} />
            {g.name} <span style={{ color: MUTED, fontSize: T_XS }}>{g.role.replace('_', ' ')}</span>
          </label>
        ))}
      </div>
      <FormActions>
        <GhostBtn onClick={() => run('clear')} disabled={busy}>Clear all</GhostBtn>
        <PrimaryBtn onClick={() => run('split')} loading={busy} disabled={picked.length === 0}>Split evenly</PrimaryBtn>
      </FormActions>
    </Modal>
  );
}
