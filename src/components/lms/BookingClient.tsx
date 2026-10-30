'use client';

/**
 * Student 1-on-1 session page.
 *   1. Ask: subject / topic / length / mode + a few times that suit you
 *   2. The instructor accepts one, or offers other times / ranges
 *   3. You pick → confirmed; online sessions get a Meet link, in-person ones a calendar event
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CalendarClock, Video, MapPin, Clock, CheckCircle2, XCircle,
  ExternalLink, Send, Loader2, AlertCircle, Plus, X,
} from 'lucide-react';
import { SUBJECT_LABELS } from '@/lib/lms/subject-constants';
import type { LmsSubject } from '@/lib/db/schema';
import type { RequestView } from '@/lib/booking/service';
import { dhakaLocalToEpoch, epochToDhakaLocal, fmtDhaka, fmtRange } from '@/lib/booking/dhaka';

interface Props {
  initialRequests: RequestView[];
  subjects: string[];
}

const DURATIONS = [15, 30, 45, 60, 90, 120] as const;
const MODES: Array<{ value: string; label: string }> = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'In person' },
  { value: 'either', label: 'Either' },
];
const MAX_TIMES = 4;
const HOUR = 3_600_000;

const subjectLabel = (s: string) => SUBJECT_LABELS[s as LmsSubject] ?? s;

const card = 'bg-white rounded-2xl border border-[#E8DDD5] overflow-hidden';
const cardShadow = { boxShadow: '0 1px 3px rgba(90,11,15,0.06)' };
const field = 'w-full rounded-lg border border-[#E1D4CB] bg-[#FAF5EF] px-3 py-2 text-sm text-[#1A0507] focus:outline-none focus:border-[#760F13]';
const primaryBtn = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#760F13] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50';
const ghostBtn = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E1D4CB] px-3.5 py-2 text-xs font-semibold text-[#760F13] disabled:opacity-50';

// ─── A list of datetime inputs (up to 4) ─────────────────────────────────────

function TimesField({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const min = epochToDhakaLocal(Date.now() + HOUR);
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="datetime-local"
            className={field}
            min={min}
            value={v}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            aria-label={`Preferred time ${i + 1}`}
          />
          {values.length > 1 && (
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="p-1.5 text-[#A86E58]" aria-label="Remove time">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      ))}
      {values.length < MAX_TIMES && (
        <button type="button" onClick={() => onChange([...values, ''])} className="inline-flex items-center gap-1 text-xs font-semibold text-[#760F13]">
          <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add another time
        </button>
      )}
      <p className="text-[11px] text-[#A86E58]">All times are Dhaka time.</p>
    </div>
  );
}

function toEpochs(values: string[]): number[] {
  return values.filter(Boolean).map(dhakaLocalToEpoch);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BookingClient({ initialRequests, subjects }: Props) {
  const [requests, setRequests] = useState<RequestView[]>(initialRequests);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // new-request form
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('online');
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState('');
  const [times, setTimes] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);

  // per-request UI state
  const [rangePick, setRangePick] = useState<Record<string, string>>({});
  const [countering, setCountering] = useState<number | null>(null);
  const [counterTimes, setCounterTimes] = useState<string[]>(['']);

  function upsert(v: RequestView) {
    setRequests((prev) => (prev.some((r) => r.id === v.id) ? prev.map((r) => (r.id === v.id ? v : r)) : [v, ...prev]));
  }

  async function call<T>(url: string, body: unknown): Promise<T | null> {
    setError(null);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError((data as { error?: string }).error ?? 'Something went wrong.'); return null; }
      return data as T;
    } catch {
      setError('Network problem. Please try again.');
      return null;
    }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) { setError('Tell the instructor what you need help with.'); return; }
    const epochs = toEpochs(times);
    if (epochs.length === 0) { setError('Add at least one time that works for you.'); return; }
    setSubmitting(true);
    const v = await call<RequestView>('/api/lms/booking/requests', {
      subject, topic, preferredMode: mode, durationMinutes: duration, notes, preferredTimes: epochs,
    });
    setSubmitting(false);
    if (v) { upsert(v); setTopic(''); setNotes(''); setTimes(['']); }
  }

  async function respond(id: number, body: Record<string, unknown>) {
    setBusyId(id);
    const v = await call<RequestView>(`/api/lms/booking/requests/${id}`, body);
    setBusyId(null);
    if (v) { upsert(v); setCountering(null); setCounterTimes(['']); }
  }

  const needsReply = requests.filter((r) => r.status === 'proposed');
  const waiting = requests.filter((r) => r.status === 'pending');
  const upcoming = requests
    .filter((r) => r.status === 'scheduled' && r.endAt && r.endAt + 30 * 60_000 > Date.now())
    .sort((a, b) => (a.startAt ?? 0) - (b.startAt ?? 0));
  const history = requests.filter((r) => !needsReply.includes(r) && !waiting.includes(r) && !upcoming.includes(r));

  return (
    <div className="min-h-screen bg-[#FAF5EF] pb-16">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#E8DDD5] px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="p-1.5 -ml-1.5 text-[#760F13]" aria-label="Back to dashboard">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </Link>
        <div>
          <h1 className="text-sm font-semibold text-[#1A0507]">1-on-1 Sessions</h1>
          <p className="text-xs text-[#A86E58]">Ask an instructor for a session</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-5 space-y-5">
        {error && (
          <div role="alert" className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss"><XCircle className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
          </div>
        )}

        {/* ── Needs your reply ─────────────────────────────────────────────── */}
        {needsReply.length > 0 && (
          <section className={card} style={cardShadow}>
            <SectionHead icon={<Clock className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />} title="Pick a time" count={needsReply.length} />
            <div className="divide-y divide-[#F0E8E0]">
              {needsReply.map((r) => (
                <div key={r.id} className="px-5 py-4 space-y-3">
                  <Summary r={r} />
                  <p className="text-xs text-[#3D1A0E]">
                    {r.instructorName ?? 'Your instructor'} offered {r.mode === 'offline' ? `an in-person session${r.location ? ` at ${r.location}` : ''}` : 'an online session'}. Choose one:
                  </p>
                  <div className="space-y-2">
                    {r.proposals.map((p, i) => {
                      if (p.endAt === undefined) {
                        return (
                          <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-[#E8DDD5] px-3 py-2">
                            <span className="text-sm text-[#1A0507]">{fmtDhaka(p.startAt)}</span>
                            <button className={primaryBtn} disabled={busyId === r.id} onClick={() => void respond(r.id, { action: 'accept', startAt: p.startAt })}>
                              Confirm
                            </button>
                          </div>
                        );
                      }
                      const key = `${r.id}-${i}`;
                      const lastStart = p.endAt - r.durationMinutes * 60_000;
                      const picked = rangePick[key] ?? epochToDhakaLocal(p.startAt);
                      return (
                        <div key={i} className="rounded-lg border border-[#E8DDD5] px-3 py-2 space-y-2">
                          <p className="text-sm text-[#1A0507]">{fmtRange(p.startAt, p.endAt)}</p>
                          <p className="text-[11px] text-[#A86E58]">Any start between {fmtDhaka(p.startAt)} and {fmtDhaka(lastStart)} works for a {r.durationMinutes}-minute session.</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local" className={field} value={picked}
                              min={epochToDhakaLocal(p.startAt)} max={epochToDhakaLocal(lastStart)}
                              onChange={(e) => setRangePick((s) => ({ ...s, [key]: e.target.value }))}
                              aria-label="Start time inside the range"
                            />
                            <button
                              className={primaryBtn} disabled={busyId === r.id}
                              onClick={() => void respond(r.id, { action: 'accept', startAt: dhakaLocalToEpoch(picked) })}
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {countering === r.id ? (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-semibold text-[#1A0507]">None of these work? Suggest other times:</p>
                      <TimesField values={counterTimes} onChange={setCounterTimes} />
                      <div className="flex gap-2">
                        <button className={primaryBtn} disabled={busyId === r.id} onClick={() => void respond(r.id, { action: 'counter', preferredTimes: toEpochs(counterTimes) })}>
                          {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={1.5} />} Send
                        </button>
                        <button className={ghostBtn} onClick={() => setCountering(null)}>Back</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <button className={ghostBtn} onClick={() => { setCountering(r.id); setCounterTimes(['']); }}>None of these work</button>
                      <button className={ghostBtn} disabled={busyId === r.id} onClick={() => void respond(r.id, { action: 'cancel' })}>Cancel request</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Upcoming (confirmed) ─────────────────────────────────────────── */}
        {upcoming.length > 0 && (
          <section className={card} style={cardShadow}>
            <SectionHead icon={<CalendarClock className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />} title="Confirmed sessions" count={upcoming.length} />
            <div className="divide-y divide-[#F0E8E0]">
              {upcoming.map((r) => {
                const joinOpen = !!r.startAt && !!r.endAt && Date.now() >= r.startAt - 15 * 60_000 && Date.now() <= r.endAt + 30 * 60_000;
                const canCancel = !!r.startAt && r.startAt - Date.now() > 2 * HOUR;
                return (
                  <div key={r.id} className="px-5 py-4 space-y-2">
                    <Summary r={r} />
                    <p className="text-sm font-medium text-[#1A0507]">{r.startAt ? fmtDhaka(r.startAt) : ''} <span className="text-[#A86E58] font-normal">with {r.instructorName ?? 'your instructor'}</span></p>
                    {r.mode === 'online' ? (
                      r.meetLink && (
                        joinOpen ? (
                          <a href={r.meetLink} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
                            <Video className="w-3.5 h-3.5" strokeWidth={1.5} /> Join Meet <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                          </a>
                        ) : (
                          <p className="text-xs text-[#A86E58]">The Meet link is in your email and calendar invite; Join appears here 15 minutes before.</p>
                        )
                      )
                    ) : (
                      <p className="flex items-center gap-1.5 text-xs text-[#3D1A0E]"><MapPin className="w-3.5 h-3.5" strokeWidth={1.5} /> {r.location ?? 'In person'}</p>
                    )}
                    {canCancel && (
                      <button className={ghostBtn} disabled={busyId === r.id} onClick={() => void respond(r.id, { action: 'cancel' })}>
                        Cancel session
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Waiting on the instructor ────────────────────────────────────── */}
        {waiting.length > 0 && (
          <section className={card} style={cardShadow}>
            <SectionHead icon={<Clock className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />} title="Waiting for an instructor" count={waiting.length} />
            <div className="divide-y divide-[#F0E8E0]">
              {waiting.map((r) => (
                <div key={r.id} className="px-5 py-4 space-y-2">
                  <Summary r={r} />
                  <ul className="text-xs text-[#3D1A0E] space-y-0.5">
                    {r.preferredTimes.map((t) => <li key={t}>{fmtDhaka(t)}</li>)}
                  </ul>
                  <button className={ghostBtn} disabled={busyId === r.id} onClick={() => void respond(r.id, { action: 'cancel' })}>Cancel request</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── New request ──────────────────────────────────────────────────── */}
        <section className={card} style={cardShadow}>
          <SectionHead icon={<Send className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />} title="Request a session" />
          <form onSubmit={submitRequest} className="px-5 py-4 space-y-3.5">
            <Labeled label="Subject">
              <select className={field} value={subject} onChange={(e) => setSubject(e.target.value)}>
                {subjects.map((s) => <option key={s} value={s}>{subjectLabel(s)}</option>)}
              </select>
            </Labeled>
            <Labeled label="What do you need help with?">
              <input className={field} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="e.g. Sentence correction, ratio questions" />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="How long">
                <select className={field} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </Labeled>
              <Labeled label="Where">
                <select className={field} value={mode} onChange={(e) => setMode(e.target.value)}>
                  {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Labeled>
            </div>
            <Labeled label="Times that work for you (up to 4)">
              <TimesField values={times} onChange={setTimes} />
            </Labeled>
            <Labeled label="Anything else? (optional)">
              <textarea className={field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </Labeled>
            <button type="submit" className={primaryBtn} disabled={submitting || subjects.length === 0}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={1.5} />} Send request
            </button>
          </form>
        </section>

        {/* ── History ──────────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <section className={card} style={cardShadow}>
            <SectionHead icon={<CheckCircle2 className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />} title="Earlier" />
            <div className="divide-y divide-[#F0E8E0]">
              {history.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#1A0507] truncate">{subjectLabel(r.subject)} · {r.topic}</span>
                  <span className="text-[#A86E58] flex-shrink-0 capitalize">
                    {r.status === 'scheduled' ? 'Done' : r.status}{r.status === 'declined' && r.staffNote ? ` — ${r.staffNote}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function SectionHead({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="px-5 py-4 border-b border-[#F0E8E0] flex items-center gap-2">
      {icon}
      <p className="text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold">{title}</p>
      {count !== undefined && <span className="ml-auto text-xs font-medium text-[#760F13] bg-[#F5EDE3] px-2 py-0.5 rounded-full">{count}</span>}
    </div>
  );
}

function Summary({ r }: { r: RequestView }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#1A0507]">{subjectLabel(r.subject)} <span className="font-normal text-[#A86E58]">· {r.durationMinutes} min</span></p>
      <p className="text-xs text-[#3D1A0E]">{r.topic}</p>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#A86E58]">{label}</span>
      {children}
    </label>
  );
}
