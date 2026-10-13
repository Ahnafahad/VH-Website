'use client';

/**
 * Today cockpit: one class at a time, every operating job inline.
 * Persistent recorder strip + collapsible rows (Materials, Homework,
 * Attendance, Wrap up). Other classes today are one-line rows below.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarX, ChevronRight, Loader2, Video, ExternalLink, Paperclip, Users, BookOpen, CheckCircle } from 'lucide-react';
import {
  Toast, ConfirmDialog, SubjectBadge, SPIN_CSS,
  RED, SLATE, MUTED, BG, BORDER, FONT_HEADING, R_LG, R_MD, T_XS, T_SM, T_BASE, T_LG, fmtDhaka,
} from './lms-shared';
import { useAdminProduct } from '@/components/admin/AdminProductContext';
import {
  deriveClockPhase, defaultOpenSection, phaseLabel, pickActiveSessionId,
  type ClockPhase, type SectionId,
} from '@/lib/lms/today-cockpit';
import { AccordionRow, Btn, COCKPIT_CSS, Stamp, apiJson, cardStyle, mutedText, useToast } from './today/cockpit-ui';
import RecorderStrip from './today/RecorderStrip';
import AttendanceSection from './today/AttendanceSection';
import MaterialsSection, { type ClassMaterial } from './today/MaterialsSection';
import HomeworkSection from './today/HomeworkSection';
import WrapUpSection from './today/WrapUpSection';
import { useRoster } from './today/useRoster';
import type { BatchOption, SessionPatch, TodaySession } from './today/types';

export type { BatchOption, OfflineShowcaseEntry, TodaySession } from './today/types';

interface TodayData {
  sessions: TodaySession[];
  assignmentsDue48h: number;
}

interface Props {
  initial: TodayData;
  /** The server-side fetch failed, so `initial` is empty rather than genuinely "no classes". */
  loadFailed?: boolean;
  batches: BatchOption[];
  /** Signed-in user's name, prefilled into "Added by" on new materials. */
  adminName?: string;
}

const TICK_MS = 30_000;

function PhaseStamp({ phase, text }: { phase: ClockPhase; text: string }) {
  const tone = phase === 'live' ? 'ok' : phase === 'before' ? 'info' : phase === 'cancelled' ? 'bad' : 'muted';
  return <Stamp tone={tone}>{phase === 'live' ? '● ' : ''}{text}</Stamp>;
}

// ─── Cockpit for one class ────────────────────────────────────────────────────

function Cockpit({
  session, now, batches, adminName, patchSession, notify,
}: {
  session: TodaySession;
  now: number;
  batches: BatchOption[];
  adminName: string;
  patchSession: (id: number, patch: SessionPatch) => void;
  notify: (m: string) => void;
}) {
  const phase = deriveClockPhase(session, now);
  const [open, setOpen] = useState<Set<SectionId>>(() => {
    const d = defaultOpenSection(phase);
    return new Set(d ? [d] : []);
  });
  const [materials, setMaterials] = useState<ClassMaterial[] | null>(null);
  const [confirmDone, setConfirmDone] = useState(false);
  const [completing, setCompleting] = useState(false);
  const roster = useRoster(phase === 'cancelled' ? null : session.id, notify);
  const patch = useCallback((p: SessionPatch) => patchSession(session.id, p), [patchSession, session.id]);

  useEffect(() => {
    let cancelled = false;
    apiJson<ClassMaterial[]>(`/api/lms/admin/classes/${session.id}/materials`)
      .then(m => { if (!cancelled) setMaterials(m); })
      .catch(() => { if (!cancelled) setMaterials([]); });
    return () => { cancelled = true; };
  }, [session.id]);

  // Warn before closing the tab with attendance still on its way to the server.
  useEffect(() => {
    if (roster.unsaved === 0) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [roster.unsaved]);

  const toggle = (id: SectionId) => setOpen(p => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const openAndScroll = (id: SectionId) => {
    setOpen(p => new Set(p).add(id));
    setTimeout(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(`tdy-h-${id}`)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }, 0);
  };

  const markCompleted = async () => {
    const previous = session.status;
    setCompleting(true);
    patch({ status: 'completed' });
    try {
      const r = await apiJson<{ recordingWarning?: string; calendarWarning?: string }>(
        `/api/lms/admin/classes/${session.id}`, { method: 'PATCH', json: { status: 'completed' } },
      );
      notify(r.recordingWarning ?? r.calendarWarning ?? 'Marked as completed.');
    } catch (e) {
      patch({ status: previous });
      notify(e instanceof Error ? e.message : 'Could not update the class.');
    } finally {
      setCompleting(false);
      setConfirmDone(false);
    }
  };

  const isDone = session.status === 'completed';
  const toCheck = session.offlineShowcase.filter(r => !r.checked).length;
  const matCount = materials?.length ?? session.materialsCount;
  const c = roster.counts;
  const end = session.scheduledAt + session.durationMinutes * 60_000;

  const attendanceSummary = roster.students
    ? `${c.here} of ${c.total} here${c.none > 0 ? ` · ${c.none} not marked` : ''}`
    : `${session.attendanceCount} attended`;
  const wrapSummary = isDone
    ? `Completed${toCheck > 0 ? ` · ${toCheck} offline to check` : ''}`
    : `${toCheck > 0 ? `${toCheck} offline to check · ` : ''}${session.description ? 'note added' : 'no note'} · not completed`;

  return (
    <section style={cardStyle} aria-label={`Class cockpit: ${session.title}`}>
      <div style={{ padding: '14px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <PhaseStamp phase={phase} text={phaseLabel(session, now)} />
          <h2 style={{ margin: '8px 0 4px', fontFamily: FONT_HEADING, fontSize: 20, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {session.title}
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: T_SM, color: MUTED }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtDhaka(session.scheduledAt, { timeStyle: 'short' })} to {fmtDhaka(end, { timeStyle: 'short' })}
            </span>
            <SubjectBadge subject={session.subject} />
            {session.batch && <span>Batch {session.batch}</span>}
            {roster.students && <span>{roster.students.length} enrolled</span>}
            {session.pendingReviewCount > 0 && <span style={{ fontWeight: 600 }}>{session.pendingReviewCount} homework to review</span>}
          </div>
        </div>
        <Btn href={`/admin/classes/${session.id}`} ariaLabel="Open the full class page in a new tab">
          <ExternalLink size={13} aria-hidden />Class page
        </Btn>
      </div>

      <RecorderStrip session={session} phase={phase} onPatch={p => patch(p)} notify={notify} />

      {phase !== 'cancelled' && (
        <>
          <AccordionRow id="materials" label="Materials" summary={matCount === 0 ? 'None attached' : `${matCount} attached`}
            open={open.has('materials')} onToggle={() => toggle('materials')} attention={matCount === 0 && phase === 'before'}>
            <MaterialsSection
              sessionId={session.id} materials={materials} adminName={adminName}
              onAdded={m => setMaterials(p => [m, ...(p ?? [])])}
              onRemoved={id => setMaterials(p => (p ?? []).filter(m => m.id !== id))}
              notify={notify}
            />
          </AccordionRow>
          <AccordionRow id="homework" label="Homework" summary={session.homework.length === 0 ? 'None posted' : `${session.homework.length} posted`}
            open={open.has('homework')} onToggle={() => toggle('homework')} attention={session.homework.length === 0 && phase === 'after' && !isDone}>
            <HomeworkSection
              session={session} homework={session.homework} batches={batches}
              onPosted={h => patch(s => ({ homework: [...s.homework, h] }))}
              notify={notify}
            />
          </AccordionRow>
          <AccordionRow id="attendance" label="Attendance" summary={attendanceSummary}
            open={open.has('attendance')} onToggle={() => toggle('attendance')} attention={phase === 'live' && c.none > 0}>
            <AttendanceSection session={session} roster={roster} notify={notify} />
          </AccordionRow>
          <AccordionRow id="wrapup" label="Wrap up" summary={wrapSummary}
            open={open.has('wrapup')} onToggle={() => toggle('wrapup')} attention={phase === 'after' && !isDone}>
            <WrapUpSection session={session} onPatch={patch} notify={notify} onRequestComplete={() => setConfirmDone(true)} completing={completing} />
          </AccordionRow>

          {/* Phone: the one action that matters for the clock */}
          <div className="tdy-bottom-bar">
            {phase === 'before' && (
              <>
                {session.meetLink && <Btn href={session.meetLink}><Video size={14} aria-hidden />Open Meet</Btn>}
                <Btn variant="primary" onClick={() => openAndScroll('materials')}><Paperclip size={14} aria-hidden />Add material</Btn>
              </>
            )}
            {phase === 'live' && (
              <>
                {session.meetLink && <Btn href={session.meetLink}><Video size={14} aria-hidden />Open Meet</Btn>}
                <Btn variant="primary" onClick={() => { openAndScroll('attendance'); void roster.markAllPresent(); }}><Users size={14} aria-hidden />Mark all present</Btn>
              </>
            )}
            {phase === 'after' && !isDone && (
              <>
                <Btn onClick={() => openAndScroll('homework')}><BookOpen size={14} aria-hidden />Homework</Btn>
                <Btn variant="primary" onClick={() => setConfirmDone(true)} loading={completing}><CheckCircle size={14} aria-hidden />Mark completed</Btn>
              </>
            )}
            {phase === 'after' && isDone && <Btn onClick={() => openAndScroll('wrapup')}>Wrap up</Btn>}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDone}
        title="Mark class as completed?"
        message={`"${session.title}" will be marked completed and students will see it in their history.`}
        confirmLabel="Mark completed"
        onConfirm={() => void markCompleted()}
        onCancel={() => setConfirmDone(false)}
        loading={completing}
      />
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TodayClient({ initial, batches, loadFailed = false, adminName = '' }: Props) {
  const { product } = useAdminProduct();
  const [data, setData] = useState(initial);
  const [failed, setFailed] = useState(loadFailed);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, notify] = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(iv);
  }, []);

  const sessions = data.sessions.filter(s => s.product === product).sort((a, b) => a.scheduledAt - b.scheduledAt);
  const activeId = sessions.some(s => s.id === selectedId) ? selectedId : pickActiveSessionId(sessions, now);
  const active = sessions.find(s => s.id === activeId) ?? null;
  const others = sessions.filter(s => s.id !== activeId);

  const patchSession = useCallback((id: number, patch: SessionPatch) => {
    setData(d => ({
      ...d,
      sessions: d.sessions.map(s => s.id === id ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s),
    }));
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await apiJson<TodayData>('/api/lms/admin/today'));
      setFailed(false);
    } catch {
      setFailed(true);
      notify('Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }, [notify]);

  const dateLabel = new Intl.DateTimeFormat('en-BD', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' }).format(new Date(now));

  return (
    <div className="tdy-page">
      <style>{SPIN_CSS + COCKPIT_CSS}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: SLATE, letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: FONT_HEADING }}>Today</h1>
          <p style={{ margin: '4px 0 0', fontSize: T_BASE, color: MUTED }}>{dateLabel}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {data.assignmentsDue48h > 0 && <Stamp tone="warn">{data.assignmentsDue48h} homework due in 48h</Stamp>}
          <Btn onClick={() => void refresh()} disabled={refreshing}>
            <Loader2 size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} aria-hidden />Refresh
          </Btn>
        </div>
      </div>

      {failed && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16, padding: '12px 16px', borderRadius: R_MD, border: `1px solid ${RED}`, background: BG, color: RED, fontSize: T_BASE }}>
          Could not load today&apos;s classes, so the list below may be incomplete.
          <Btn onClick={() => void refresh()} disabled={refreshing}>Retry</Btn>
        </div>
      )}

      {!active && !failed ? (
        <div style={{ background: BG, border: `1px dashed ${BORDER}`, borderRadius: R_LG, padding: '48px 24px', textAlign: 'center' }}>
          <CalendarX size={32} style={{ color: MUTED, margin: '0 auto 12px', display: 'block' }} aria-hidden />
          <p style={{ margin: '0 0 8px', fontSize: T_LG, fontWeight: 600, color: SLATE, fontFamily: FONT_HEADING }}>No class today</p>
          <p style={{ ...mutedText, fontSize: T_BASE, marginBottom: 16 }}>No sessions scheduled for today in Dhaka time.</p>
          <Link href="/admin/classes" className="tdy-btn lms-btn lms-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: R_MD, background: RED, color: BG, fontSize: T_BASE, fontWeight: 600, textDecoration: 'none' }}>
            Go to Classes<ChevronRight size={14} aria-hidden />
          </Link>
        </div>
      ) : active && (
        <>
          <Cockpit key={active.id} session={active} now={now} batches={batches} adminName={adminName} patchSession={patchSession} notify={notify} />
          {others.length > 0 && (
            <section aria-label="Other classes today" style={{ ...cardStyle, marginTop: 16 }}>
              <h2 style={{ margin: 0, padding: '10px 16px', fontFamily: FONT_HEADING, fontStyle: 'italic', fontSize: T_BASE + 2, fontWeight: 600, color: SLATE }}>Other classes today</h2>
              {others.map(s => (
                <button key={s.id} type="button" className="tdy-other" onClick={() => { setSelectedId(s.id); window.scrollTo({ top: 0 }); }} aria-label={`Open cockpit for ${s.title}`}>
                  <span style={{ fontSize: T_SM, fontVariantNumeric: 'tabular-nums', color: MUTED, flexShrink: 0 }}>{fmtDhaka(s.scheduledAt, { timeStyle: 'short' })}</span>
                  <span style={{ fontSize: T_BASE, fontWeight: 600, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                  <span style={{ fontSize: T_XS, color: MUTED, flexShrink: 0 }}>{phaseLabel(s, now)}</span>
                  <ChevronRight size={14} style={{ color: MUTED, flexShrink: 0 }} aria-hidden />
                </button>
              ))}
            </section>
          )}
        </>
      )}

      <Toast message={toast} />
    </div>
  );
}
