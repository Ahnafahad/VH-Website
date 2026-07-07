'use client';

/**
 * Student booking page client.
 * Sections:
 *   1. My booked sessions (with join link when online + within window)
 *   2. Open slots grid (Book button, 409 SLOT_TAKEN handling)
 *   3. Request form (subject / topic / mode / duration / notes)
 *   4. My requests list with status + staff note
 */

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import {
  ArrowLeft,
  CalendarClock,
  Video,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Send,
  Loader2,
  AlertCircle,
  CalendarPlus,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { formatDhaka } from '@/lib/lms/time';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingSlotInfo {
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
  bookedAt: number | null;
}

export interface SessionRequestInfo {
  id: number;
  userId: number;
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

interface Props {
  openSlots: BookingSlotInfo[];
  bookedSlots: BookingSlotInfo[];
  myRequests: SessionRequestInfo[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  english:    { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  math:       { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200'},
  analytical: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200'  },
};

const REQUEST_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  pending:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  approved:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  declined:  { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200'     },
  scheduled: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
};

function isJoinOpen(startAt: number, endAt: number): boolean {
  const now = Date.now();
  const windowStart = startAt - 15 * 60 * 1000;
  const windowEnd = endAt + 30 * 60 * 1000;
  return now >= windowStart && now <= windowEnd;
}

const cardV: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28, delay: i * 0.05 },
  }),
};

const SUBJECTS = ['english', 'math', 'analytical'] as const;
const MODES = ['online', 'offline', 'either'] as const;
const DURATIONS = [15, 30, 45, 60, 90, 120] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingClient({ openSlots: initialOpen, bookedSlots: initialBooked, myRequests: initialRequests }: Props) {
  const [openSlots, setOpenSlots] = useState<BookingSlotInfo[]>(initialOpen);
  const [bookedSlots, setBookedSlots] = useState<BookingSlotInfo[]>(initialBooked);
  const [myRequests, setMyRequests] = useState<SessionRequestInfo[]>(initialRequests);

  const [bookingId, setBookingId] = useState<number | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Request form state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqSubject, setReqSubject] = useState<string>('english');
  const [reqTopic, setReqTopic] = useState('');
  const [reqMode, setReqMode] = useState<string>('online');
  const [reqDuration, setReqDuration] = useState<number>(30);
  const [reqNotes, setReqNotes] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  // ── Refresh ──────────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [slotsRes, reqsRes] = await Promise.all([
        fetch('/api/lms/booking/slots'),
        fetch('/api/lms/booking/requests'),
      ]);
      if (slotsRes.ok) {
        const data = await slotsRes.json() as { open: BookingSlotInfo[]; booked: BookingSlotInfo[] };
        setOpenSlots(data.open ?? []);
        setBookedSlots(data.booked ?? []);
      }
      if (reqsRes.ok) {
        const data = await reqsRes.json() as SessionRequestInfo[];
        setMyRequests(data);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // ── Book slot ────────────────────────────────────────────────────────────────
  const handleBook = async (slotId: number) => {
    setBookingId(slotId);
    setBookError(null);
    try {
      const res = await fetch(`/api/lms/booking/slots/${slotId}/book`, { method: 'POST' });
      const data = await res.json() as BookingSlotInfo & { meetWarning?: string; error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          setBookError('This slot was just taken. Please choose another.');
          // Remove from open list
          setOpenSlots((prev) => prev.filter((s) => s.id !== slotId));
        } else {
          setBookError(data.error ?? 'Booking failed');
        }
        return;
      }
      // Move from open to booked
      const slot = openSlots.find((s) => s.id === slotId);
      if (slot) {
        setOpenSlots((prev) => prev.filter((s) => s.id !== slotId));
        setBookedSlots((prev) => [{ ...slot, ...data, status: 'booked' }, ...prev]);
      }
    } finally {
      setBookingId(null);
    }
  };

  // ── Cancel booked slot ────────────────────────────────────────────────────────
  const handleCancelBooking = async (slotId: number) => {
    if (!confirm('Cancel your booking for this session?')) return;
    try {
      const res = await fetch(`/api/lms/booking/slots/${slotId}/cancel-booking`, { method: 'POST' });
      if (res.ok) {
        const slot = bookedSlots.find((s) => s.id === slotId);
        setBookedSlots((prev) => prev.filter((s) => s.id !== slotId));
        if (slot) setOpenSlots((prev) => [{ ...slot, status: 'open', bookedByUserId: null, bookedAt: null }, ...prev]);
      }
    } catch {
      // non-fatal
    }
  };

  // ── Submit request ────────────────────────────────────────────────────────────
  const handleSubmitRequest = async () => {
    if (!reqTopic.trim()) { setReqError('Topic is required'); return; }
    setReqError(null);
    setSubmittingReq(true);
    try {
      const res = await fetch('/api/lms/booking/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: reqSubject,
          topic: reqTopic.trim(),
          preferredMode: reqMode,
          durationMinutes: reqDuration,
          notes: reqNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setReqError(err.error ?? 'Failed to submit request');
        return;
      }
      const created = await res.json() as SessionRequestInfo;
      setMyRequests((prev) => [created, ...prev]);
      setShowRequestForm(false);
      setReqTopic('');
      setReqNotes('');
    } catch {
      setReqError('Something went wrong. Please try again.');
    } finally {
      setSubmittingReq(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF5EF] pb-16">
      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8DDD5] px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#F5EDE3] transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4 text-[#5A0B0F]" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-[#1A0507]">Book a Session</h1>
          <p className="text-xs text-[#A86E58]">1-on-1 with your instructor</p>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#F5EDE3] transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-[#A86E58] ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-5 space-y-5">

        {/* ── Error banner ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {bookError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              {bookError}
              <button onClick={() => setBookError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── My booked sessions ────────────────────────────────────────────── */}
        {bookedSlots.length > 0 && (
          <motion.section
            custom={0} variants={cardV} initial="hidden" animate="visible"
            className="bg-white rounded-2xl border border-[#E8DDD5] overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
          >
            <div className="px-5 py-4 border-b border-[#F0E8E0] flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />
              <p className="text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold">
                My Sessions
              </p>
              <span className="ml-auto text-xs font-medium text-[#760F13] bg-[#F5EDE3] px-2 py-0.5 rounded-full">
                {bookedSlots.length}
              </span>
            </div>
            <div className="divide-y divide-[#F0E8E0]">
              {bookedSlots.map((slot) => {
                const subjectStyle = SUBJECT_COLORS[slot.subject] ?? { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };
                const joinOpen = isJoinOpen(slot.startAt, slot.endAt);
                const canCancel = slot.startAt - Date.now() > 2 * 3600 * 1000;

                return (
                  <div key={slot.id} className="px-5 py-4 space-y-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${subjectStyle.bg} ${subjectStyle.text} ${subjectStyle.border}`}>
                        {slot.subject}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${slot.mode === 'online' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                        {slot.mode === 'online' ? <Video className="w-2.5 h-2.5" strokeWidth={2} /> : <MapPin className="w-2.5 h-2.5" strokeWidth={2} />}
                        {slot.mode}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <dt className="text-[#A86E58]">Date &amp; time</dt>
                      <dd className="text-[#1A0507] font-medium">{formatDhaka(new Date(slot.startAt), 'datetime')}</dd>
                      <dt className="text-[#A86E58]">Instructor</dt>
                      <dd className="text-[#1A0507] font-medium">{slot.instructorName}</dd>
                      {slot.topic && (
                        <>
                          <dt className="text-[#A86E58]">Topic</dt>
                          <dd className="text-[#1A0507] font-medium">{slot.topic}</dd>
                        </>
                      )}
                    </dl>
                    <div className="flex gap-2 flex-wrap">
                      {joinOpen && slot.meetLink && (
                        <a
                          href={slot.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" strokeWidth={2} />
                          Join now
                        </a>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => void handleCancelBooking(slot.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A86E58] hover:text-red-600 border border-[#E8DDD5] hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Cancel booking
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* ── Open slots ────────────────────────────────────────────────────── */}
        <motion.section
          custom={1} variants={cardV} initial="hidden" animate="visible"
          className="bg-white rounded-2xl border border-[#E8DDD5] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
        >
          <div className="px-5 py-4 border-b border-[#F0E8E0] flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />
            <p className="text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold">
              Open Slots
            </p>
            {openSlots.length > 0 && (
              <span className="ml-auto text-xs font-medium text-[#760F13] bg-[#F5EDE3] px-2 py-0.5 rounded-full">
                {openSlots.length}
              </span>
            )}
          </div>

          {openSlots.length === 0 ? (
            <div className="px-5 py-6 flex flex-col items-center gap-2">
              <CalendarClock className="w-6 h-6 text-[#D4B094]" strokeWidth={1.25} />
              <p className="text-xs text-[#A86E58]/70">No open slots right now. Check back later or submit a request below.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F0E8E0]">
              {openSlots.map((slot, i) => {
                const subjectStyle = SUBJECT_COLORS[slot.subject] ?? { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };
                const isBooking = bookingId === slot.id;

                return (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.04, type: 'spring' as const, stiffness: 300, damping: 28 }}
                    className="px-5 py-4 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${subjectStyle.bg} ${subjectStyle.text} ${subjectStyle.border}`}>
                          {slot.subject}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${slot.mode === 'online' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                          {slot.mode === 'online' ? <Video className="w-2.5 h-2.5" strokeWidth={2} /> : <MapPin className="w-2.5 h-2.5" strokeWidth={2} />}
                          {slot.mode}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#1A0507]">
                        {formatDhaka(new Date(slot.startAt), 'datetime')}
                      </p>
                      <p className="text-[10px] text-[#A86E58]">
                        <Clock className="w-2.5 h-2.5 inline mr-0.5" strokeWidth={2} />
                        {Math.round((slot.endAt - slot.startAt) / 60000)} min · {slot.instructorName}
                      </p>
                      {slot.topic && (
                        <p className="text-xs text-[#5A0B0F]">{slot.topic}</p>
                      )}
                    </div>
                    <motion.button
                      onClick={() => void handleBook(slot.id)}
                      disabled={isBooking}
                      whileTap={!isBooking ? { scale: 0.96 } : {}}
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-[#760F13] text-white px-3 py-2 rounded-xl disabled:opacity-60"
                    >
                      {isBooking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                      )}
                      {isBooking ? 'Booking…' : 'Book'}
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* ── Request form ──────────────────────────────────────────────────── */}
        <motion.section
          custom={2} variants={cardV} initial="hidden" animate="visible"
          className="bg-white rounded-2xl border border-[#E8DDD5] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
        >
          <button
            onClick={() => setShowRequestForm(!showRequestForm)}
            className="w-full px-5 py-4 border-b border-[#F0E8E0] flex items-center gap-2 hover:bg-[#FAF5EF]/50 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />
            <p className="text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold flex-1 text-left">
              Request a Session
            </p>
            <span className="text-xs text-[#A86E58]">{showRequestForm ? '▲' : '▼'}</span>
          </button>

          <AnimatePresence>
            {showRequestForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 py-4 space-y-4">
                  {/* Subject */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold mb-1.5">Subject</label>
                    <div className="flex gap-2">
                      {SUBJECTS.map((s) => (
                        <button
                          key={s}
                          onClick={() => setReqSubject(s)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            reqSubject === s
                              ? 'bg-[#760F13] text-white border-[#760F13]'
                              : 'bg-[#FAF5EF] text-[#5A0B0F] border-[#E8DDD5] hover:border-[#D4B094]'
                          }`}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Topic */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold mb-1.5">Topic *</label>
                    <input
                      type="text"
                      value={reqTopic}
                      onChange={(e) => setReqTopic(e.target.value)}
                      placeholder="e.g. Reading comprehension, quadratic equations…"
                      className="w-full text-sm text-[#1A0507] border border-[#E8DDD5] rounded-xl px-3 py-2 bg-[#FAF5EF]/50 focus:outline-none focus:border-[#760F13]/50 transition-colors placeholder:text-[#C4A08A]"
                    />
                  </div>

                  {/* Mode & Duration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold mb-1.5">Mode</label>
                      <select
                        value={reqMode}
                        onChange={(e) => setReqMode(e.target.value)}
                        className="w-full text-xs text-[#1A0507] border border-[#E8DDD5] rounded-lg px-3 py-2 bg-[#FAF5EF]/50 focus:outline-none focus:border-[#760F13]/50 transition-colors"
                      >
                        {MODES.map((m) => (
                          <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold mb-1.5">Duration</label>
                      <select
                        value={reqDuration}
                        onChange={(e) => setReqDuration(parseInt(e.target.value, 10))}
                        className="w-full text-xs text-[#1A0507] border border-[#E8DDD5] rounded-lg px-3 py-2 bg-[#FAF5EF]/50 focus:outline-none focus:border-[#760F13]/50 transition-colors"
                      >
                        {DURATIONS.map((d) => (
                          <option key={d} value={d}>{d} min</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold mb-1.5">Notes (optional)</label>
                    <textarea
                      value={reqNotes}
                      onChange={(e) => setReqNotes(e.target.value)}
                      placeholder="Any additional context for your instructor…"
                      rows={3}
                      className="w-full text-sm text-[#1A0507] border border-[#E8DDD5] rounded-xl px-3 py-2 bg-[#FAF5EF]/50 focus:outline-none focus:border-[#760F13]/50 transition-colors resize-none placeholder:text-[#C4A08A]"
                    />
                  </div>

                  {reqError && (
                    <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      {reqError}
                    </div>
                  )}

                  <motion.button
                    onClick={() => void handleSubmitRequest()}
                    disabled={submittingReq}
                    whileTap={!submittingReq ? { scale: 0.97 } : {}}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-[#760F13] text-white hover:bg-[#5A0B0F] disabled:opacity-60 transition-colors"
                  >
                    {submittingReq ? (
                      <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> Submitting…</>
                    ) : (
                      <><Send className="w-4 h-4" strokeWidth={2} /> Submit Request</>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── My requests ────────────────────────────────────────────────────── */}
        {myRequests.length > 0 && (
          <motion.section
            custom={3} variants={cardV} initial="hidden" animate="visible"
            className="bg-white rounded-2xl border border-[#E8DDD5] overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
          >
            <div className="px-5 py-4 border-b border-[#F0E8E0] flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />
              <p className="text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold">
                My Requests
              </p>
              <span className="ml-auto text-xs font-medium text-[#760F13] bg-[#F5EDE3] px-2 py-0.5 rounded-full">
                {myRequests.length}
              </span>
            </div>
            <div className="divide-y divide-[#F0E8E0]">
              {myRequests.map((req) => {
                const statusStyle = REQUEST_STATUS_STYLES[req.status] ?? REQUEST_STATUS_STYLES.pending;
                const subjectStyle = SUBJECT_COLORS[req.subject] ?? { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };

                return (
                  <div key={req.id} className="px-5 py-4 space-y-2">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                        {req.status}
                      </span>
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${subjectStyle.bg} ${subjectStyle.text} ${subjectStyle.border}`}>
                        {req.subject}
                      </span>
                      <span className="text-[10px] text-[#A86E58] ml-auto">
                        {formatDhaka(new Date(req.createdAt), 'date')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#1A0507]">{req.topic}</p>
                    <p className="text-[10px] text-[#A86E58]">
                      {req.preferredMode} · {req.durationMinutes} min
                    </p>
                    {req.staffNote && (
                      <div className="border-l-2 border-[#760F13]/30 pl-3">
                        <p className="text-[10px] uppercase tracking-wider text-[#A86E58] font-semibold mb-0.5">Staff note</p>
                        <p className="text-xs text-[#3D1517]">{req.staffNote}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
