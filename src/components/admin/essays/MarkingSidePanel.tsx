'use client';

/**
 * Right-hand panel of the marking page: the essay's prompt, its one mark
 * (typed or quick-tap), overall feedback, staff-only note, the grade /
 * save / reject actions, this page's comment pins, the collapsible
 * grading-standard panel (this essay's average + histogram + reference
 * scripts) and the script's history.
 */

import { useState } from 'react';
import { BookMarked, ChevronDown, ChevronRight, Lock, Star } from 'lucide-react';
import {
  BG, BORDER, BORDER_FIELD, INFO, INFO_BG, INK_SOFT, MUTED, OK, OK_BG, R_MD, R_PILL, RED, SLATE, SURFACE, T_BASE, T_SM, T_XS, WARN, WARN_BG,
} from '@/components/admin/lms/tokens';
import { DangerBtn, GhostBtn, PrimaryBtn, fmtDhaka } from '@/components/admin/lms/lms-shared';
import { ScoreHistogram } from '@/components/essays/EssayCharts';
import { numberedComments, type EssayAnnotation } from '@/lib/essays/annotations';
import type { EssayPrompt } from '@/lib/essays/prompts';
import type { BankComment, MarksDraft, ScriptDetail, SeriesInfo, SeriesStats } from './marking-types';

function Section({ title, open, onToggle, children, right }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${BORDER}` }}>
      <button type="button" onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', minHeight: 44, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: T_SM, fontWeight: 700, color: SLATE, textAlign: 'left' }}>
        {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        <span style={{ flex: 1 }}>{title}</span>
        {right}
      </button>
      {open && <div style={{ padding: '0 14px 14px' }}>{children}</div>}
    </div>
  );
}

const HISTORY_LABEL: Record<string, string> = {
  'essay.submitted': 'Submitted',
  'essay.resubmitted': 'Resubmitted',
  'essay.graded': 'Graded',
  'essay.marks_changed': 'Marks changed',
  'essay.rejected': 'Rejected',
  'essay.unlocked': 'Lock taken over',
};

export default function MarkingSidePanel({
  series, detail, draft, onDraft, readOnly, saving, onSaveDraft, onGrade, onReject, notify, onNotify,
  stats, essays, pageItems, onOpenComment, bank, onToggleReference, references, onOpenReference, draftDirty, compact = false,
}: {
  series: SeriesInfo;
  detail: ScriptDetail;
  draft: MarksDraft;
  onDraft: (d: MarksDraft) => void;
  readOnly: boolean;
  saving: boolean;
  onSaveDraft: () => void;
  onGrade: () => void;
  onReject: () => void;
  notify: boolean;
  onNotify: (v: boolean) => void;
  /** Stats for this script's essay only. */
  stats: SeriesStats['byEssay'][number] | null;
  essays: EssayPrompt[];
  pageItems: EssayAnnotation[];
  onOpenComment: (id: string) => void;
  bank: BankComment[];
  onToggleReference: () => void;
  references: { id: number; label: string | null; total: number | null; name: string; essayIndex: number }[];
  onOpenReference: (id: number) => void;
  draftDirty: boolean;
  /** Phone / iPad-portrait sheet: 16px inputs (no iOS zoom), bigger tap targets, long sections start closed. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState({ marks: true, feedback: true, comments: true, standard: !compact, history: false });
  const total = draft.mark;
  const max = detail.max;
  const graded = detail.status === 'graded';
  const comments = numberedComments(pageItems);

  const setMark = (v: number | null) => onDraft({ ...draft, mark: v });
  const whole = total === null ? null : Math.floor(total);
  const half = total !== null && total % 1 !== 0;

  const statusChip = {
    submitted: ['To mark', WARN, WARN_BG],
    graded: ['Graded', OK, OK_BG],
    rejected: ['Rejected', RED, `${RED}12`],
  }[detail.status];

  const input = { width: '100%', boxSizing: 'border-box' as const, border: `1px solid ${BORDER_FIELD}`, borderRadius: R_MD, padding: '8px 10px', fontSize: compact ? 16 : T_BASE, color: SLATE, background: SURFACE, fontFamily: 'inherit' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: SLATE }}>{detail.student?.name ?? 'Student'}</p>
          <span style={{ fontSize: T_XS, fontWeight: 700, padding: '3px 8px', borderRadius: R_PILL, color: statusChip[1], background: statusChip[2] }}>{statusChip[0]}</span>
        </div>
        <p style={{ margin: '2px 0 0', fontSize: T_XS, color: MUTED }}>
          {series.essayCount > 1 ? `Essay ${detail.essayIndex} · ` : ''}submitted {fmtDhaka(new Date(detail.submittedAt).getTime())}{detail.attempt > 1 ? ` · attempt ${detail.attempt}` : ''}
        </p>
        {detail.gradedBy && <p style={{ margin: '2px 0 0', fontSize: T_XS, color: MUTED }}>Graded by {detail.gradedBy.name}{detail.gradedAt ? ` · ${fmtDhaka(new Date(detail.gradedAt).getTime())}` : ''}</p>}
        {detail.status === 'rejected' && detail.rejectReason && (
          <p style={{ margin: '8px 0 0', fontSize: T_SM, color: RED, background: `${RED}0D`, borderRadius: R_MD, padding: 8 }}>Rejected: {detail.rejectReason} — waiting for the student to resubmit.</p>
        )}
      </div>

      {detail.prompt && (
        <div style={{ padding: '0 14px 12px' }}>
          <p style={{ margin: '0 0 2px', fontSize: T_XS, color: MUTED }}>Prompt</p>
          <p style={{ margin: 0, fontSize: T_SM, color: SLATE, whiteSpace: 'pre-wrap' }}>{detail.prompt}</p>
        </div>
      )}

      <Section title="Mark" open={open.marks} onToggle={() => setOpen(o => ({ ...o, marks: !o.marks }))}
        right={<span style={{ fontSize: T_SM, color: total === null ? MUTED : RED }}>{total ?? '—'} / {max}</span>}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="mk-mark" style={{ flex: 1, fontSize: T_SM, fontWeight: 600, color: SLATE }}>Mark (out of {max})</label>
          <input
            id="mk-mark"
            type="number" inputMode="decimal" min={0} max={max} step="any"
            disabled={readOnly}
            value={total ?? ''}
            onChange={e => {
              const raw = e.target.value;
              if (raw === '') { setMark(null); return; }
              const n = Math.round(Number(raw) * 100) / 100;
              if (Number.isFinite(n)) setMark(Math.min(max, Math.max(0, n)));
            }}
            style={{ ...input, width: 76, textAlign: 'right', fontWeight: 700 }}
          />
          <span style={{ fontSize: T_SM, color: MUTED, width: 34 }}>/ {max}</span>
        </div>
        {max <= 20 && !readOnly && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {Array.from({ length: Math.floor(max) + 1 }, (_, i) => i).map(i => (
              <button key={i} type="button" onClick={() => setMark(half && i + 0.5 <= max ? i + 0.5 : i)}
                style={{ minWidth: compact ? 44 : 30, height: compact ? 44 : 30, borderRadius: R_MD, border: `1px solid ${whole === i ? RED : BORDER}`, background: whole === i ? `${RED}14` : SURFACE, color: whole === i ? RED : INK_SOFT, fontSize: T_SM, fontWeight: 700, cursor: 'pointer' }}>
                {i}
              </button>
            ))}
            <button type="button" disabled={total === null || (!half && total + 0.5 > max)}
              onClick={() => total !== null && setMark(half ? Math.floor(total) : total + 0.5)}
              style={{ minWidth: compact ? 44 : 30, height: compact ? 44 : 30, borderRadius: R_MD, border: `1px solid ${half ? RED : BORDER}`, background: half ? `${RED}14` : SURFACE, color: half ? RED : INK_SOFT, fontSize: T_SM, fontWeight: 700, cursor: 'pointer' }}>
              +½
            </button>
          </div>
        )}
      </Section>

      <Section title="Feedback" open={open.feedback} onToggle={() => setOpen(o => ({ ...o, feedback: !o.feedback }))}>
        <label htmlFor="mk-overall" style={{ fontSize: T_XS, color: MUTED }}>Overall feedback (the student sees this at the top)</label>
        <textarea id="mk-overall" disabled={readOnly} rows={4} value={draft.overallFeedback} onChange={e => onDraft({ ...draft, overallFeedback: e.target.value })} style={{ ...input, marginTop: 4, resize: 'vertical' }} />
        {!readOnly && bank.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {bank.slice(0, 12).map(b => (
              <button key={b.id} type="button" title="Add to feedback"
                onClick={() => onDraft({ ...draft, overallFeedback: draft.overallFeedback ? `${draft.overallFeedback.trimEnd()}\n${b.text}` : b.text })}
                style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: `1px solid ${BORDER}`, background: BG, borderRadius: R_PILL, padding: '3px 8px', fontSize: T_XS, color: INK_SOFT, cursor: 'pointer' }}>
                {b.text}
              </button>
            ))}
          </div>
        )}
        <label htmlFor="mk-private" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: T_XS, color: MUTED, marginTop: 12 }}>
          <Lock size={11} aria-hidden /> Private note — staff only, never shown to the student
        </label>
        <textarea id="mk-private" disabled={readOnly} rows={2} value={draft.privateNote} onChange={e => onDraft({ ...draft, privateNote: e.target.value })} style={{ ...input, marginTop: 4, resize: 'vertical', background: WARN_BG }} />
      </Section>

      {!readOnly && detail.status !== 'rejected' && (
        <div style={{ padding: 14, borderTop: `1px solid ${BORDER}`, display: 'grid', gap: 8 }}>
          {graded ? (
            <>
              {series.publishedAt && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T_SM, color: SLATE }}>
                  <input type="checkbox" checked={notify} onChange={e => onNotify(e.target.checked)} /> Notify the student about this change
                </label>
              )}
              <PrimaryBtn onClick={onSaveDraft} loading={saving} disabled={!draftDirty || total === null}>Save changes</PrimaryBtn>
            </>
          ) : (
            <>
              <PrimaryBtn onClick={onGrade} loading={saving} disabled={total === null}>Mark as graded → next</PrimaryBtn>
              <GhostBtn onClick={onSaveDraft} disabled={saving || !draftDirty}>Save draft</GhostBtn>
            </>
          )}
          <DangerBtn onClick={onReject} disabled={saving}>Reject script…</DangerBtn>
          {graded && (
            <GhostBtn onClick={onToggleReference}>
              <Star size={13} aria-hidden fill={detail.isReference ? 'currentColor' : 'none'} /> {detail.isReference ? `Reference: ${detail.referenceLabel ?? 'pinned'} (unpin)` : 'Pin as reference script'}
            </GhostBtn>
          )}
          {!graded && total === null && <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>Enter a mark to grade.</p>}
        </div>
      )}

      <Section title={`Comments on this page (${comments.length})`} open={open.comments} onToggle={() => setOpen(o => ({ ...o, comments: !o.comments }))}>
        {comments.length === 0 ? (
          <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>Use the comment tool and tap the page to pin a typed comment.</p>
        ) : (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {comments.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpenComment(c.id)} style={{ width: '100%', display: 'flex', gap: 8, textAlign: 'left', border: `1px solid ${BORDER}`, background: SURFACE, borderRadius: R_MD, padding: 8, cursor: 'pointer' }}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: R_PILL, background: c.color, color: SURFACE, fontSize: T_XS, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.n}</span>
                  <span style={{ fontSize: T_SM, color: SLATE, whiteSpace: 'pre-wrap' }}>{c.text || <em style={{ color: MUTED }}>empty</em>}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Grading standard" open={open.standard} onToggle={() => setOpen(o => ({ ...o, standard: !o.standard }))}
        right={stats?.average !== null && stats?.average !== undefined ? <span style={{ fontSize: T_SM, color: MUTED }}>avg {stats.average}</span> : null}>
        {!stats || stats.count === 0 ? (
          <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>No scripts graded yet in this series.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
              {[['Average', stats.average], ['Highest', stats.highest], ['Lowest', stats.lowest]].map(([k, v]) => (
                <div key={k as string} style={{ background: BG, borderRadius: R_MD, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: T_XS, color: MUTED }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: SLATE }}>{v ?? '—'}</div>
                </div>
              ))}
            </div>
            <p style={{ margin: '0 0 4px', fontSize: T_XS, color: MUTED }}>{stats.count} graded · this script{total !== null ? ` (${total})` : ''} highlighted</p>
            <ScoreHistogram bins={stats.histogram} highlight={total} tone="light" height={150} />
          </>
        )}
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 4, fontSize: T_XS, fontWeight: 700, color: SLATE }}><BookMarked size={12} aria-hidden /> Reference scripts</p>
          {references.length === 0 ? (
            <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>None pinned. Pin a graded script as a reference to compare side by side.</p>
          ) : references.filter(r => r.id !== detail.id).map(r => (
            <button key={r.id} type="button" onClick={() => onOpenReference(r.id)} style={{ display: 'block', width: '100%', textAlign: 'left', border: `1px solid ${BORDER}`, background: INFO_BG, color: INFO, borderRadius: R_MD, padding: '6px 8px', marginBottom: 4, fontSize: T_XS, cursor: 'pointer' }}>
              {r.label ?? 'Reference'} — {r.name}{series.essayCount > 1 ? ` (essay ${r.essayIndex})` : ''} · {r.total}/{essays[r.essayIndex - 1]?.max ?? '—'}
            </button>
          ))}
        </div>
      </Section>

      <Section title="History" open={open.history} onToggle={() => setOpen(o => ({ ...o, history: !o.history }))}>
        {detail.history.length === 0 ? (
          <p style={{ margin: 0, fontSize: T_XS, color: MUTED }}>Nothing yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {detail.history.map(h => {
              const after = h.after as { total?: number; reason?: string } | null;
              const before = h.before as { total?: number } | null;
              return (
                <li key={h.id} style={{ fontSize: T_XS, color: SLATE }}>
                  <strong>{HISTORY_LABEL[h.action] ?? h.action}</strong>{h.actor ? ` by ${h.actor}` : ''} · <span style={{ color: MUTED }}>{fmtDhaka(new Date(h.at).getTime())}</span>
                  {h.action === 'essay.marks_changed' && before?.total !== undefined && <div style={{ color: MUTED }}>{before.total} → {after?.total}</div>}
                  {h.action === 'essay.graded' && after?.total !== undefined && <div style={{ color: MUTED }}>Total {after.total}</div>}
                  {h.action === 'essay.rejected' && after?.reason && <div style={{ color: MUTED }}>{after.reason}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
