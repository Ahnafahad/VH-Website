'use client';

/**
 * Admin Bookings UI — Slots + Requests tabs
 * Lives under /admin/bookings
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarPlus,
  Trash2,
  CheckCircle,
  XCircle,
  CalendarClock,
  ExternalLink,
  RefreshCw,
  Video,
  MapPin,
} from 'lucide-react';
import {
  BORDER, MUTED, RED, SLATE, BG,
  SURFACE, OK, OK_BG, WARN, WARN_BG, INFO, INFO_BG,
  R_SM, R_MD, R_LG, R_PILL, SHADOW_SM, RED_DARK, INK_SOFT,
  rowV, SPIN_CSS,
  PageHeader, TabBar, Modal, ConfirmDialog, FieldLabel, FieldInput, FieldTextarea, FieldSelect,
  PrimaryBtn, DangerBtn, GhostBtn, Toast, EmptyState, StatusBadge, SubjectBadge,
  FormActions,
  fmtDhaka, dhakaLocalToISO, epochToDhakaLocal,
} from './lms-shared';

// Local hover/focus CSS for the meet-link anchor (inline style can't do :hover/:focus-visible).
const LINK_CSS = `
.vh-meet-link:hover { text-decoration: underline; }
.vh-meet-link:focus-visible { outline: 2px solid ${RED}; outline-offset: 2px; border-radius: ${R_SM}px; }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Slot {
  id: number;
  instructorId: number;
  instructorName: string;
  subject: string;
  product: string;
  batch: string | null;
  startAt: number;
  endAt: number;
  mode: string;
  topic: string | null;
  status: string;
  meetLink: string | null;
  bookedByUserId: number | null;
  bookedByName: string | null;
  bookedAt: number | null;
  createdAt: number;
}

interface Request {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  subject: string;
  topic: string;
  preferredMode: string;
  durationMinutes: number;
  notes: string | null;
  status: string;
  resolvedSlotId: number | null;
  staffNote: string | null;
  createdAt: number;
}

interface BookingsClientProps {
  initialSlots: Slot[];
  initialRequests: Request[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Destructive (cancelled/declined) tint derived from the RED token itself —
// mirrors the rgba-from-RED technique lms-shared's DangerBtn already uses.
const NEG_BG     = `${RED}14`;
const NEG_BORDER = `${RED}40`;

function ModeBadge({ mode }: { mode: string }) {
  const online = mode === 'online';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: R_PILL, fontSize: 11, fontWeight: 600,
      background: online ? INFO_BG : OK_BG,
      color: online ? INFO : OK,
      border: `1px solid ${online ? `${INFO}33` : `${OK}33`}`,
    }}>
      {online ? <Video size={9} aria-hidden /> : <MapPin size={9} aria-hidden />}
      {mode}
    </span>
  );
}

function SlotStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    open:      { bg: OK_BG,   color: OK,       border: `${OK}33`   },
    booked:    { bg: WARN_BG, color: WARN,     border: `${WARN}33` },
    cancelled: { bg: NEG_BG,  color: RED_DARK, border: NEG_BORDER  },
  };
  const s = colors[status] ?? colors.open;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: R_PILL, fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {status}
    </span>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    pending:   { bg: WARN_BG, color: WARN,     border: `${WARN}33` },
    approved:  { bg: OK_BG,   color: OK,       border: `${OK}33`   },
    declined:  { bg: NEG_BG,  color: RED_DARK, border: NEG_BORDER  },
    scheduled: { bg: INFO_BG, color: INFO,     border: `${INFO}33` },
  };
  const s = colors[status] ?? colors.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: R_PILL, fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingsClient({ initialSlots, initialRequests }: BookingsClientProps) {
  const [tab, setTab]             = useState<'slots' | 'requests'>('slots');
  const [slots, setSlots]         = useState<Slot[]>(initialSlots);
  const [requests, setRequests]   = useState<Request[]>(initialRequests);
  const [toast, setToast]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  // Create slot modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    startAt: '', endAt: '', mode: 'online', topic: '', subject: 'english',
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Resolve request
  const [resolveTarget, setResolveTarget] = useState<Request | null>(null);
  const [resolveAction, setResolveAction] = useState<'approve' | 'decline' | 'schedule'>('approve');
  const [resolveNote, setResolveNote]     = useState('');
  const [scheduleForm, setScheduleForm]   = useState({ startAt: '', endAt: '', mode: 'online' });
  const [resolveLoading, setResolveLoading] = useState(false);

  // Cancel confirm
  const [cancelTarget, setCancelTarget] = useState<Slot | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Refresh ───────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([
        fetch('/api/lms/admin/booking/slots'),
        fetch('/api/lms/admin/booking/requests'),
      ]);
      if (sRes.ok) setSlots(await sRes.json() as Slot[]);
      if (rRes.ok) setRequests(await rRes.json() as Request[]);
      if (!sRes.ok || !rRes.ok) showToast('Could not load bookings — showing the last known state');
    } catch {
      showToast('Could not reach the server. Check your connection and refresh.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // ── Create slot ────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!createForm.startAt || !createForm.endAt) {
      showToast('Start and end time are required');
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch('/api/lms/admin/booking/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: dhakaLocalToISO(createForm.startAt),
          endAt:   dhakaLocalToISO(createForm.endAt),
          mode:    createForm.mode,
          topic:   createForm.topic || undefined,
          subject: createForm.subject,
        }),
      });
      const data = await res.json() as Slot & { calendarWarning?: string };
      if (!res.ok) {
        showToast((data as { error?: string }).error ?? 'Failed to create slot');
        return;
      }
      setSlots((prev) => [data as Slot, ...prev]);
      setShowCreate(false);
      setCreateForm({ startAt: '', endAt: '', mode: 'online', topic: '', subject: 'english' });
      showToast(data.calendarWarning ?? 'Slot created');
    } catch {
      // Reached when fetch rejects (offline) or the body isn't JSON — a 502
      // returns HTML, and res.json() throws on it. Without this the spinner
      // just stops and the slot silently never appears.
      showToast('Could not create the slot. Check your connection and try again.');
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, showToast]);

  // ── Cancel slot ────────────────────────────────────────────────────────────

  const handleCancel = useCallback(async (slot: Slot) => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/lms/admin/booking/slots/${slot.id}`, { method: 'DELETE' });
      const data = await res.json() as { success?: boolean; wasBooked?: boolean; bookedByEmail?: string | null; error?: string };
      if (!res.ok) {
        showToast(data.error ?? 'Failed to cancel slot');
        return;
      }
      setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, status: 'cancelled' } : s));
      const msg = data.wasBooked && data.bookedByEmail
        ? `Slot cancelled. Student email: ${data.bookedByEmail}`
        : 'Slot cancelled';
      showToast(msg);
    } catch {
      showToast('Could not cancel the slot. Check your connection and try again.');
    } finally {
      setCancelLoading(false);
      setCancelTarget(null);
    }
  }, [showToast]);

  // ── Resolve request ────────────────────────────────────────────────────────

  const handleResolve = useCallback(async () => {
    if (!resolveTarget) return;
    setResolveLoading(true);
    try {
      const body: Record<string, unknown> = { action: resolveAction, staffNote: resolveNote || undefined };
      if (resolveAction === 'schedule') {
        if (!scheduleForm.startAt || !scheduleForm.endAt) {
          showToast('Start and end time are required for scheduling');
          return;
        }
        body.slot = {
          startAt: dhakaLocalToISO(scheduleForm.startAt),
          endAt:   dhakaLocalToISO(scheduleForm.endAt),
          mode:    scheduleForm.mode,
        };
      }
      const res = await fetch(`/api/lms/admin/booking/requests/${resolveTarget.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success?: boolean; status?: string; meetWarning?: string; error?: string };
      if (!res.ok) {
        showToast(data.error ?? 'Failed to resolve request');
        return;
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === resolveTarget.id
            ? { ...r, status: data.status ?? resolveAction, staffNote: resolveNote || null }
            : r,
        ),
      );
      if (resolveAction === 'schedule') {
        // Refresh slots to show new pre-booked slot
        await refresh();
      }
      setResolveTarget(null);
      setResolveNote('');
      setScheduleForm({ startAt: '', endAt: '', mode: 'online' });
      showToast(data.meetWarning ?? `Request ${data.status}`);
    } catch {
      showToast('Could not resolve the request. Check your connection and try again.');
    } finally {
      setResolveLoading(false);
    }
  }, [resolveTarget, resolveAction, resolveNote, scheduleForm, showToast, refresh]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{SPIN_CSS + LINK_CSS}</style>

      <PageHeader
        title="Bookings"
        subtitle="Manage 1-on-1 session slots and student requests"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostBtn onClick={refresh} disabled={loading} small>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} aria-hidden />
              Refresh
            </GhostBtn>
            {tab === 'slots' && (
              <PrimaryBtn onClick={() => setShowCreate(true)} small>
                <CalendarPlus size={13} aria-hidden />
                Add Slot
              </PrimaryBtn>
            )}
          </div>
        }
      />

      <TabBar
        tabs={[
          { id: 'slots',    label: `Slots (${slots.length})` },
          { id: 'requests', label: `Requests (${requests.filter(r => r.status === 'pending').length} pending)` },
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'slots' | 'requests')}
      />

      {/* ── Slots tab ─────────────────────────────────────────────────────── */}
      {tab === 'slots' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slots.length === 0 ? (
            <EmptyState icon={CalendarClock} message="No booking slots yet. Create one to get started." />
          ) : (
            slots.map((slot, i) => (
              <motion.div
                key={slot.id}
                custom={i}
                variants={rowV}
                initial="hidden"
                animate="visible"
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: R_LG,
                  boxShadow: SHADOW_SM,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {/* Date/time block */}
                <div style={{ minWidth: 140 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE }}>
                    {fmtDhaka(slot.startAt, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>
                    {fmtDhaka(slot.startAt, { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {fmtDhaka(slot.endAt,   { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    <SlotStatusBadge status={slot.status} />
                    <ModeBadge mode={slot.mode} />
                    <SubjectBadge subject={slot.subject} />
                  </div>
                  {slot.topic && (
                    <p style={{ margin: 0, fontSize: 12, color: INK_SOFT, wordBreak: 'break-word' }}>{slot.topic}</p>
                  )}
                  {slot.status === 'booked' && slot.bookedByName && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, wordBreak: 'break-word' }}>
                      Booked by: <strong style={{ color: SLATE }}>{slot.bookedByName}</strong>
                    </p>
                  )}
                  {slot.meetLink && (
                    <a href={slot.meetLink} target="_blank" rel="noopener noreferrer" className="vh-meet-link"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: INFO }}>
                      <ExternalLink size={10} aria-hidden /> Meet link
                    </a>
                  )}
                </div>

                {/* Actions */}
                {slot.status !== 'cancelled' && (
                  <DangerBtn
                    small
                    onClick={() => setCancelTarget(slot)}
                    disabled={cancelLoading}
                  >
                    <Trash2 size={12} aria-hidden />
                    Cancel
                  </DangerBtn>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ── Requests tab ──────────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.length === 0 ? (
            <EmptyState icon={CalendarClock} message="No session requests yet." />
          ) : (
            requests.map((req, i) => (
              <motion.div
                key={req.id}
                custom={i}
                variants={rowV}
                initial="hidden"
                animate="visible"
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: R_LG,
                  boxShadow: SHADOW_SM,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <RequestStatusBadge status={req.status} />
                    <SubjectBadge subject={req.subject} />
                    <span style={{ fontSize: 11, color: MUTED }}>{req.durationMinutes} min · {req.preferredMode} preferred</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE, wordBreak: 'break-word' }}>{req.topic}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: MUTED, wordBreak: 'break-word' }}>
                    {req.userName} · {req.userEmail}
                  </p>
                  {req.notes && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: INK_SOFT, background: BG, padding: '6px 10px', borderRadius: R_SM, border: `1px solid ${BORDER}`, wordBreak: 'break-word' }}>
                      {req.notes}
                    </p>
                  )}
                  {req.staffNote && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED }}>Staff note: {req.staffNote}</p>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED }}>
                    {fmtDhaka(req.createdAt)}
                  </p>
                </div>

                {req.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <GhostBtn small onClick={() => { setResolveTarget(req); setResolveAction('approve'); }}>
                      <CheckCircle size={12} style={{ color: OK }} aria-hidden />
                      Approve
                    </GhostBtn>
                    <GhostBtn small onClick={() => { setResolveTarget(req); setResolveAction('decline'); }}>
                      <XCircle size={12} style={{ color: RED }} aria-hidden />
                      Decline
                    </GhostBtn>
                    <PrimaryBtn small onClick={() => { setResolveTarget(req); setResolveAction('schedule'); }}>
                      <CalendarClock size={12} aria-hidden />
                      Schedule
                    </PrimaryBtn>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ── Create Slot Modal ─────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Booking Slot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <FieldLabel>Subject</FieldLabel>
            <FieldSelect value={createForm.subject} onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))}>
              <option value="english">English</option>
              <option value="math">Math</option>
              <option value="analytical">Analytical</option>
            </FieldSelect>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <FieldLabel>Start (Dhaka time)</FieldLabel>
              <FieldInput
                type="datetime-local"
                value={createForm.startAt}
                onChange={e => setCreateForm(f => ({ ...f, startAt: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>End (Dhaka time)</FieldLabel>
              <FieldInput
                type="datetime-local"
                value={createForm.endAt}
                onChange={e => setCreateForm(f => ({ ...f, endAt: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Mode</FieldLabel>
            <FieldSelect value={createForm.mode} onChange={e => setCreateForm(f => ({ ...f, mode: e.target.value }))}>
              <option value="online">Online (Google Meet)</option>
              <option value="offline">Offline / In-person</option>
            </FieldSelect>
          </div>
          <div>
            <FieldLabel>Topic (optional)</FieldLabel>
            <FieldInput
              placeholder="e.g. Reading comprehension"
              value={createForm.topic}
              onChange={e => setCreateForm(f => ({ ...f, topic: e.target.value }))}
            />
          </div>
          <FormActions>
            <GhostBtn onClick={() => setShowCreate(false)}>Cancel</GhostBtn>
            <PrimaryBtn onClick={handleCreate} loading={createLoading}>Create Slot</PrimaryBtn>
          </FormActions>
        </div>
      </Modal>

      {/* ── Resolve Request Modal ─────────────────────────────────────────── */}
      <Modal
        open={!!resolveTarget}
        onClose={() => { setResolveTarget(null); setResolveNote(''); setScheduleForm({ startAt: '', endAt: '', mode: 'online' }); }}
        title={`${resolveAction === 'approve' ? 'Approve' : resolveAction === 'decline' ? 'Decline' : 'Schedule'} Request`}
        width={480}
      >
        {resolveTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R_MD, padding: '12px 14px' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: SLATE }}>{resolveTarget.topic}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: MUTED }}>
                {resolveTarget.userName} · {resolveTarget.subject} · {resolveTarget.durationMinutes} min · {resolveTarget.preferredMode} preferred
              </p>
            </div>

            {/* Action selector */}
            <div>
              <FieldLabel>Action</FieldLabel>
              <FieldSelect value={resolveAction} onChange={e => setResolveAction(e.target.value as typeof resolveAction)}>
                <option value="approve">Approve</option>
                <option value="decline">Decline</option>
                <option value="schedule">Schedule (create booked slot)</option>
              </FieldSelect>
            </div>

            {/* Schedule form */}
            {resolveAction === 'schedule' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <FieldLabel>Start (Dhaka time)</FieldLabel>
                    <FieldInput
                      type="datetime-local"
                      value={scheduleForm.startAt}
                      onChange={e => setScheduleForm(f => ({ ...f, startAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FieldLabel>End (Dhaka time)</FieldLabel>
                    <FieldInput
                      type="datetime-local"
                      value={scheduleForm.endAt}
                      onChange={e => setScheduleForm(f => ({ ...f, endAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Mode</FieldLabel>
                  <FieldSelect value={scheduleForm.mode} onChange={e => setScheduleForm(f => ({ ...f, mode: e.target.value }))}>
                    <option value="online">Online (Google Meet)</option>
                    <option value="offline">Offline / In-person</option>
                  </FieldSelect>
                </div>
              </>
            )}

            {/* Staff note */}
            <div>
              <FieldLabel>Staff note (optional)</FieldLabel>
              <FieldTextarea
                placeholder="Visible to student"
                value={resolveNote}
                onChange={e => setResolveNote(e.target.value)}
                style={{ minHeight: 60 }}
              />
            </div>

            <FormActions>
              <GhostBtn onClick={() => { setResolveTarget(null); setResolveNote(''); }}>Cancel</GhostBtn>
              <PrimaryBtn onClick={handleResolve} loading={resolveLoading}>
                {resolveAction === 'approve' ? 'Approve' : resolveAction === 'decline' ? 'Decline' : 'Schedule'}
              </PrimaryBtn>
            </FormActions>
          </div>
        )}
      </Modal>

      {/* ── Cancel Slot Confirm ───────────────────────────────────────────────
          Was a hand-rolled backdrop + panel that duplicated ConfirmDialog's
          markup. Same dialog, so it now shares the component — and with it the
          Escape key, focus trap and focus restore the local copy never had. */}
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel this slot?"
        message={cancelTarget
          ? `${fmtDhaka(cancelTarget.startAt)} — ${cancelTarget.mode} ${cancelTarget.subject}.`
            + (cancelTarget.status === 'booked' && cancelTarget.bookedByName
                ? ` Currently booked by ${cancelTarget.bookedByName}.`
                : '')
          : ''}
        confirmLabel="Cancel Slot"
        cancelLabel="Keep"
        destructive
        loading={cancelLoading}
        onConfirm={() => { if (cancelTarget) void handleCancel(cancelTarget); }}
        onCancel={() => setCancelTarget(null)}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
