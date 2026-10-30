'use client';

/**
 * Admin / instructor side of 1-on-1 session requests — /admin/bookings.
 * A student asks with a few times; here the instructor either accepts one,
 * or proposes other times / ranges for the student to choose from.
 */

import React, { useState, useMemo } from 'react';
import { CalendarClock, Video, MapPin, ExternalLink, Plus, X } from 'lucide-react';
import {
  BORDER, MUTED, RED, SLATE, SURFACE, BG, OK, OK_BG, WARN, WARN_BG, INFO, INFO_BG,
  R_SM, R_MD, R_LG, R_PILL, SHADOW_SM, SPIN_CSS, T_XS, T_SM, T_BASE,
  PageHeader, TabBar, Toast, EmptyState, PrimaryBtn, DangerBtn, GhostBtn,
  FieldLabel, FieldInput, FieldSelect,
} from './lms-shared';
import type { RequestView } from '@/lib/booking/service';
import { dhakaLocalToEpoch, epochToDhakaLocal, fmtDhaka, fmtRange } from '@/lib/booking/dhaka';

interface Props {
  initialRequests: RequestView[];
  /** The signed-in staff member, to show "yours" and gate cancel. */
  meId: number;
  isSuperAdmin: boolean;
}

type Tab = 'reply' | 'waiting' | 'upcoming' | 'history';

interface OfferRow {
  kind: 'time' | 'range';
  start: string;
  end: string;
}

const MAX_OPTIONS = 4;

const MODE_LABEL: Record<string, string> = { online: 'Online', offline: 'In person', either: 'Online or in person' };

function chip(label: string, color: string, bg: string): React.ReactNode {
  return (
    <span style={{
      fontSize: T_XS, fontWeight: 600, padding: '2px 8px', borderRadius: R_PILL,
      color, background: bg, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ─── One request ─────────────────────────────────────────────────────────────

function RequestCard({
  r, tab, canAct, onResult, onError,
}: {
  r: RequestView;
  tab: Tab;
  canAct: boolean;
  onResult: (v: RequestView) => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'online' | 'offline'>(r.preferredMode === 'offline' ? 'offline' : 'online');
  const [location, setLocation] = useState('');
  const [proposing, setProposing] = useState(false);
  const [offers, setOffers] = useState<OfferRow[]>([{ kind: 'time', start: '', end: '' }]);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');

  const effectiveMode = r.preferredMode === 'either' ? mode : (r.preferredMode as 'online' | 'offline');
  const min = epochToDhakaLocal(Date.now() + 3_600_000);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/lms/admin/booking/requests/${r.id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) onError((data as { error?: string }).error ?? 'Something went wrong.');
      else onResult(data as RequestView);
    } catch {
      onError('Network problem. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const modeFields = {
    ...(r.preferredMode === 'either' ? { mode } : {}),
    ...(effectiveMode === 'offline' ? { location } : {}),
  };

  function sendProposal() {
    const proposals = offers
      .filter((o) => o.start && (o.kind === 'time' || o.end))
      .map((o) => (o.kind === 'time'
        ? { startAt: dhakaLocalToEpoch(o.start) }
        : { startAt: dhakaLocalToEpoch(o.start), endAt: dhakaLocalToEpoch(o.end) }));
    void act({ action: 'propose', proposals, ...modeFields });
  }

  const statusChip =
    r.status === 'pending' ? chip('Needs reply', WARN, WARN_BG)
    : r.status === 'proposed' ? chip('Waiting on student', INFO, INFO_BG)
    : r.status === 'scheduled' ? chip('Confirmed', OK, OK_BG)
    : chip(r.status.charAt(0).toUpperCase() + r.status.slice(1), MUTED, BG);

  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_LG, boxShadow: SHADOW_SM, padding: 16, display: 'grid', gap: 12 }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: T_BASE, fontWeight: 700, color: SLATE }}>{r.studentName}</div>
          <div style={{ fontSize: T_SM, color: MUTED }}>
            {r.subjectLabel} · {r.durationMinutes} min · {MODE_LABEL[r.preferredMode] ?? r.preferredMode} · {r.product.toUpperCase()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {r.instructorName && <span style={{ fontSize: T_XS, color: MUTED }}>{r.instructorName}</span>}
          {statusChip}
        </div>
      </div>
      <div style={{ fontSize: T_BASE, color: SLATE }}>{r.topic}</div>
      {r.notes && <div style={{ fontSize: T_SM, color: MUTED }}>“{r.notes}”</div>}

      {/* ── needs reply ─────────────────────────────────────────────────── */}
      {tab === 'reply' && canAct && (
        <>
          {r.preferredTimes.length === 0 && (
            <p style={{ margin: 0, fontSize: T_SM, color: MUTED }}>
              This older request has no times from the student. Propose some below.
            </p>
          )}

          {(r.preferredMode === 'either' || effectiveMode === 'offline') && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              {r.preferredMode === 'either' && (
                <div>
                  <FieldLabel>Session type</FieldLabel>
                  <FieldSelect value={mode} onChange={(e) => setMode(e.target.value as 'online' | 'offline')}>
                    <option value="online">Online (Meet link)</option>
                    <option value="offline">In person</option>
                  </FieldSelect>
                </div>
              )}
              {effectiveMode === 'offline' && (
                <div>
                  <FieldLabel>Location</FieldLabel>
                  <FieldInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where will you meet?" />
                </div>
              )}
            </div>
          )}

          {r.preferredTimes.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <FieldLabel>Student&apos;s times (Dhaka)</FieldLabel>
              {r.preferredTimes.map((t) => (
                <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, border: `1px solid ${BORDER}`, borderRadius: R_MD, padding: '8px 12px' }}>
                  <span style={{ fontSize: T_BASE, color: SLATE }}>{fmtDhaka(t)}</span>
                  <PrimaryBtn small loading={busy} onClick={() => void act({ action: 'accept', startAt: t, ...modeFields })}>
                    Accept
                  </PrimaryBtn>
                </div>
              ))}
            </div>
          )}

          {proposing ? (
            <div style={{ display: 'grid', gap: 10, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
              <FieldLabel>Your times — a specific time, or a range the student picks from</FieldLabel>
              {offers.map((o, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                  <FieldSelect
                    value={o.kind}
                    onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, kind: e.target.value as 'time' | 'range' } : x)))}
                    aria-label="Offer type"
                  >
                    <option value="time">Specific</option>
                    <option value="range">Range</option>
                  </FieldSelect>
                  <FieldInput
                    type="datetime-local" min={min} value={o.start} aria-label="Start"
                    onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                  />
                  {o.kind === 'range' ? (
                    <FieldInput
                      type="datetime-local" min={o.start || min} value={o.end} aria-label="End of range"
                      onChange={(e) => setOffers(offers.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                    />
                  ) : <span />}
                  {offers.length > 1 ? (
                    <button type="button" aria-label="Remove" onClick={() => setOffers(offers.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
                      <X size={14} aria-hidden />
                    </button>
                  ) : <span />}
                </div>
              ))}
              {offers.length < MAX_OPTIONS && (
                <div>
                  <GhostBtn small onClick={() => setOffers([...offers, { kind: 'time', start: '', end: '' }])}>
                    <Plus size={12} aria-hidden /> Add option
                  </GhostBtn>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <PrimaryBtn small loading={busy} onClick={sendProposal}>Send to student</PrimaryBtn>
                <GhostBtn small onClick={() => setProposing(false)}>Back</GhostBtn>
              </div>
            </div>
          ) : declining ? (
            <div style={{ display: 'grid', gap: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
              <FieldLabel>Note for the student (optional)</FieldLabel>
              <FieldInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Not available this week" />
              <div style={{ display: 'flex', gap: 8 }}>
                <DangerBtn small loading={busy} onClick={() => void act({ action: 'decline', note })}>Decline request</DangerBtn>
                <GhostBtn small onClick={() => setDeclining(false)}>Back</GhostBtn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <GhostBtn small onClick={() => setProposing(true)}>Propose other times</GhostBtn>
              <GhostBtn small onClick={() => setDeclining(true)}>Decline</GhostBtn>
            </div>
          )}
        </>
      )}

      {tab === 'reply' && !canAct && (
        <p style={{ margin: 0, fontSize: T_SM, color: MUTED }}>You can see this request but it belongs to another instructor.</p>
      )}

      {/* ── waiting on the student ──────────────────────────────────────── */}
      {tab === 'waiting' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <FieldLabel>You offered</FieldLabel>
          {r.proposals.map((p, i) => (
            <div key={i} style={{ fontSize: T_BASE, color: SLATE }}>
              {p.endAt ? `${fmtRange(p.startAt, p.endAt)} (range)` : fmtDhaka(p.startAt)}
            </div>
          ))}
        </div>
      )}

      {/* ── confirmed ───────────────────────────────────────────────────── */}
      {tab === 'upcoming' && r.startAt && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: T_BASE, fontWeight: 600, color: SLATE }}>{fmtDhaka(r.startAt)}</div>
          {r.mode === 'online' && r.meetLink ? (
            <a href={r.meetLink} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T_SM, color: RED, borderRadius: R_SM }}>
              <Video size={13} aria-hidden /> {r.meetLink} <ExternalLink size={11} aria-hidden />
            </a>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T_SM, color: MUTED }}>
              <MapPin size={13} aria-hidden /> {r.location ?? 'In person'}
            </span>
          )}
          {canAct && (
            <div>
              <DangerBtn small loading={busy} onClick={() => {
                if (window.confirm('Cancel this session? The student will be emailed.')) void act({ action: 'cancel' });
              }}>
                Cancel session
              </DangerBtn>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && r.status === 'declined' && r.staffNote && (
        <div style={{ fontSize: T_SM, color: MUTED }}>Note: {r.staffNote}</div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BookingsClient({ initialRequests, meId, isSuperAdmin }: Props) {
  const [requests, setRequests] = useState<RequestView[]>(initialRequests);
  const [tab, setTab] = useState<Tab>('reply');
  const [toast, setToast] = useState<string | null>(null);

  const groups = useMemo(() => {
    const now = Date.now();
    const upcoming = requests.filter((r) => r.status === 'scheduled' && r.endAt && r.endAt >= now)
      .sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0));
    return {
      reply: requests.filter((r) => r.status === 'pending'),
      waiting: requests.filter((r) => r.status === 'proposed'),
      upcoming,
      history: requests.filter((r) => r.status !== 'pending' && r.status !== 'proposed' && !upcoming.includes(r)),
    } satisfies Record<Tab, RequestView[]>;
  }, [requests]);

  function onResult(v: RequestView) {
    setRequests((prev) => prev.map((r) => (r.id === v.id ? v : r)));
    setToast(
      v.status === 'scheduled' ? 'Confirmed. The student and you have been emailed the details.'
      : v.status === 'proposed' ? 'Sent. The student will pick a time.'
      : v.status === 'declined' ? 'Declined. The student was told.'
      : 'Updated.',
    );
  }

  const tabs = [
    { id: 'reply', label: `Needs reply${groups.reply.length ? ` (${groups.reply.length})` : ''}` },
    { id: 'waiting', label: `Waiting on student${groups.waiting.length ? ` (${groups.waiting.length})` : ''}` },
    { id: 'upcoming', label: `Upcoming${groups.upcoming.length ? ` (${groups.upcoming.length})` : ''}` },
    { id: 'history', label: 'History' },
  ];
  const shown = groups[tab];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 0 48px' }}>
      <style>{SPIN_CSS}</style>
      <PageHeader title="1-on-1 Requests" subtitle="Students ask with a few times. Accept one, or propose your own." />
      <TabBar tabs={tabs} active={tab} onChange={(id) => setTab(id as Tab)} />

      {shown.length === 0 ? (
        <EmptyState icon={CalendarClock} message={
          tab === 'reply' ? 'No requests waiting for you.'
          : tab === 'waiting' ? 'Nothing is waiting on a student.'
          : tab === 'upcoming' ? 'No confirmed sessions coming up.'
          : 'Nothing here yet.'
        } />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {shown.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              tab={tab}
              canAct={isSuperAdmin || r.instructorId === null || r.instructorId === meId}
              onResult={onResult}
              onError={setToast}
            />
          ))}
        </div>
      )}
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
