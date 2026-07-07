'use client';

/**
 * Admin class detail — attendance table, recording status, watch progress,
 * access grants management.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  Video,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  Plus,
  MessageSquare,
  Send,
} from 'lucide-react';
import { formatDhaka } from '@/lib/lms/time';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassSessionInfo {
  id: number;
  title: string;
  subject: string;
  product: string;
  batch: string | null;
  scheduledAt: number;
  durationMinutes: number;
  status: string;
  meetLink: string | null;
  recallBotId: string | null;
}

interface RecordingInfo {
  id: number;
  status: string;
  durationSeconds: number | null;
  fileSize: number | null;
  errorMessage: string | null;
  createdAt: number;
}

interface AttendeeRow {
  userId: number;
  name: string;
  email: string;
  joinedAt: number;
  watchProgress: { secondsWatched: number; completedPercent: number } | null;
}

interface GrantRow {
  id: number;
  userId: number | null;
  expiresAt: number;
  grantedBy: number;
  createdAt: number;
}

interface UserOption {
  id: number;
  name: string;
  email: string;
}

interface AnswerRow {
  id: number;
  body: string;
  createdAt: number;
  userId: number;
  userName: string;
  isStaff: boolean;
  isOwn: boolean;
}

interface QuestionThread {
  id: number;
  body: string;
  createdAt: number;
  userId: number;
  userName: string;
  isStaff: boolean;
  isOwn: boolean;
  answers: AnswerRow[];
}

interface Props {
  classSession: ClassSessionInfo;
  recording: RecordingInfo | null;
  attendance: AttendeeRow[];
  grants: GrantRow[];
  allUsers: UserOption[];
  initialThreads: QuestionThread[];
  currentUserId: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft:     'bg-stone-100 text-stone-500',
    scheduled: 'bg-blue-50 text-blue-600',
    live:      'bg-green-50 text-green-600',
    completed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-600',
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${map[status] ?? 'bg-stone-100 text-stone-500'}`}
    >
      {status}
    </span>
  );
}

function recordingStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending:    'bg-amber-50 text-amber-700',
    processing: 'bg-blue-50 text-blue-600',
    available:  'bg-emerald-50 text-emerald-700',
    failed:     'bg-red-50 text-red-600',
    expired:    'bg-stone-100 text-stone-500',
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${map[status] ?? 'bg-stone-100 text-stone-500'}`}
    >
      {status}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClassDetailClient({
  classSession,
  recording,
  attendance,
  grants: initialGrants,
  allUsers,
  initialThreads,
  currentUserId,
}: Props) {
  const [grants, setGrants] = useState<GrantRow[]>(initialGrants);
  const [grantUserId, setGrantUserId] = useState<string>('');     // '' = batch-wide
  const [grantExpiry, setGrantExpiry] = useState<string>('');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Q&A state
  const [threads, setThreads] = useState<QuestionThread[]>(initialThreads);
  const [answerText, setAnswerText] = useState<Record<number, string>>({});
  const [postingAnswer, setPostingAnswer] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const scheduledDate = new Date(classSession.scheduledAt);

  // ── Grant submission ────────────────────────────────────────────────────────
  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!recording) return;
    setGrantError(null);

    if (!grantExpiry) {
      setGrantError('Expiry date is required');
      return;
    }
    // Convert local datetime-local string to UTC
    const localDate = new Date(grantExpiry);
    if (isNaN(localDate.getTime())) {
      setGrantError('Invalid date');
      return;
    }
    if (localDate.getTime() <= Date.now()) {
      setGrantError('Expiry must be in the future');
      return;
    }

    const body: Record<string, unknown> = {
      expiresAt: localDate.toISOString(),
    };
    if (grantUserId !== '') {
      body.userId = parseInt(grantUserId, 10);
    } else {
      body.userId = null;
    }

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/lms/admin/recordings/${recording.id}/grant`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const json = await res.json() as { error?: string };
          setGrantError(json.error ?? 'Failed to create grant');
          return;
        }
        const newGrant = await res.json() as GrantRow;
        setGrants((prev) => [...prev, newGrant]);
        setGrantUserId('');
        setGrantExpiry('');
      } catch {
        setGrantError('Network error — please try again');
      }
    });
  }

  // ── Grant revocation ────────────────────────────────────────────────────────
  async function handleRevoke(grantId: number) {
    if (!confirm('Revoke this access grant?')) return;
    try {
      const res = await fetch(`/api/lms/admin/grants/${grantId}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      setGrants((prev) => prev.filter((g) => g.id !== grantId));
    } catch {
      // non-fatal
    }
  }

  // ── Q&A: post answer ────────────────────────────────────────────────────────
  async function handlePostAnswer(questionId: number) {
    const text = (answerText[questionId] ?? '').trim();
    if (!text) return;
    setPostingAnswer(questionId);
    try {
      const res = await fetch(`/api/lms/questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) return;
      const newAnswer = await res.json() as AnswerRow;
      setThreads((prev) =>
        prev.map((t) =>
          t.id === questionId
            ? { ...t, answers: [...t.answers, { ...newAnswer, isOwn: newAnswer.userId === currentUserId }] }
            : t,
        ),
      );
      setAnswerText((prev) => ({ ...prev, [questionId]: '' }));
    } finally {
      setPostingAnswer(null);
    }
  }

  // ── Q&A: delete ─────────────────────────────────────────────────────────────
  async function handleDeleteQA(id: number, parentId?: number) {
    if (!confirm('Delete this message?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/lms/questions/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      if (parentId !== undefined) {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === parentId ? { ...t, answers: t.answers.filter((a) => a.id !== id) } : t,
          ),
        );
      } else {
        setThreads((prev) => prev.filter((t) => t.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F4F0] pb-16" style={{ colorScheme: 'light' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <Link
          href="/admin/classes"
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Back to classes"
        >
          <ArrowLeft className="w-4 h-4 text-gray-700" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-gray-900 truncate">{classSession.title}</h1>
          <p className="text-xs text-gray-500 capitalize">
            {classSession.subject} · {classSession.product}
            {classSession.batch ? ` · Batch ${classSession.batch}` : ''}
          </p>
        </div>
        {statusBadge(classSession.status)}
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-5 space-y-5">
        {/* ── Session Info ───────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">
            Class Info
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Scheduled</dt>
            <dd className="font-medium text-gray-900">
              {formatDhaka(scheduledDate, 'datetime')}
            </dd>
            <dt className="text-gray-500">Duration</dt>
            <dd className="font-medium text-gray-900">{classSession.durationMinutes} min</dd>
            {classSession.meetLink && (
              <>
                <dt className="text-gray-500">Meet link</dt>
                <dd>
                  <a
                    href={classSession.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline truncate block text-xs"
                  >
                    {classSession.meetLink}
                  </a>
                </dd>
              </>
            )}
            {classSession.recallBotId && (
              <>
                <dt className="text-gray-500">Bot ID</dt>
                <dd className="text-xs text-gray-500 font-mono truncate">
                  {classSession.recallBotId}
                </dd>
              </>
            )}
          </dl>
        </section>

        {/* ── Recording ─────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Video className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
              Recording
            </h2>
          </div>

          {!recording ? (
            <p className="text-sm text-gray-500">No recording for this session.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {recordingStatusBadge(recording.status)}
                {recording.durationSeconds && (
                  <span className="text-xs text-gray-500">
                    {Math.round(recording.durationSeconds / 60)} min
                  </span>
                )}
                {recording.fileSize && (
                  <span className="text-xs text-gray-500">
                    {(recording.fileSize / 1_000_000).toFixed(1)} MB
                  </span>
                )}
              </div>
              {recording.errorMessage && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                  {recording.errorMessage}
                </p>
              )}

              {/* ── Grants ─────────────────────────────────────────────────── */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">Access Grants</p>

                {grants.length === 0 ? (
                  <p className="text-xs text-gray-400">No active grants.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {grants.map((g) => {
                      const isExpired = g.expiresAt <= Date.now();
                      const userName =
                        g.userId !== null
                          ? (allUsers.find((u) => u.id === g.userId)?.name ?? `User #${g.userId}`)
                          : 'Whole batch';
                      return (
                        <li
                          key={g.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          {isExpired ? (
                            <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" strokeWidth={1.5} />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
                          )}
                          <span className={isExpired ? 'text-gray-400 line-through' : 'text-gray-700'}>
                            {userName}
                          </span>
                          <span className="text-gray-400">until</span>
                          <span className={isExpired ? 'text-gray-400' : 'text-gray-700'}>
                            {formatDhaka(new Date(g.expiresAt), 'datetime')}
                          </span>
                          {!isExpired && (
                            <button
                              onClick={() => handleRevoke(g.id)}
                              className="ml-auto text-red-400 hover:text-red-600 transition-colors"
                              aria-label="Revoke grant"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Grant form */}
                <form onSubmit={(e) => { void handleGrant(e); }} className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" strokeWidth={2} /> Add Extension Grant
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={grantUserId}
                      onChange={(e) => setGrantUserId(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#D62B38]/30"
                    >
                      <option value="">Whole batch</option>
                      {allUsers.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>

                    <input
                      type="datetime-local"
                      value={grantExpiry}
                      onChange={(e) => setGrantExpiry(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#D62B38]/30"
                      required
                    />

                    <motion.button
                      type="submit"
                      disabled={isPending}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-1.5 text-xs font-medium bg-[#D62B38] text-white px-3 py-1.5 rounded-lg disabled:opacity-60 whitespace-nowrap"
                    >
                      {isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" strokeWidth={2} />
                      )}
                      Grant
                    </motion.button>
                  </div>

                  {grantError && (
                    <p className="text-xs text-red-600">{grantError}</p>
                  )}
                </form>
              </div>
            </div>
          )}
        </section>

        {/* ── Attendance ────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
              Attendance ({attendance.length})
            </h2>
          </div>

          {attendance.length === 0 ? (
            <div className="px-5 py-4">
              <p className="text-sm text-gray-500">No attendance recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Student</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">
                      Joined (Dhaka)
                    </th>
                    {recording && (
                      <>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500">
                          Watched
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-500">
                          Progress
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((row, i) => (
                    <tr
                      key={row.userId}
                      className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900">{row.name}</p>
                        <p className="text-gray-400 text-[10px]">{row.email}</p>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                          {formatDhaka(new Date(row.joinedAt), 'time')}
                        </span>
                      </td>
                      {recording && (
                        <>
                          <td className="px-4 py-2.5 text-right text-gray-600">
                            {row.watchProgress
                              ? `${Math.round(row.watchProgress.secondsWatched / 60)} min`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {row.watchProgress ? (
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${row.watchProgress.completedPercent}%` }}
                                  />
                                </div>
                                <span className="text-gray-600 w-8 text-right">
                                  {row.watchProgress.completedPercent}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {/* ── Q&A ──────────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
            <h2 className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
              Q&amp;A ({threads.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-50">
            {threads.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">No questions yet.</p>
            ) : (
              threads.map((thread) => (
                <div key={thread.id} className="px-5 py-4 space-y-2">
                  {/* Question row */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-gray-900">{thread.userName}</span>
                        {thread.isStaff && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#D62B38] text-white">
                            Staff
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {formatDhaka(new Date(thread.createdAt), 'datetime')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{thread.body}</p>
                    </div>
                    <button
                      onClick={() => void handleDeleteQA(thread.id)}
                      disabled={deletingId === thread.id}
                      className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                      aria-label="Delete question"
                    >
                      {deletingId === thread.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                        : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      }
                    </button>
                  </div>

                  {/* Answers */}
                  {thread.answers.length > 0 && (
                    <div className="ml-4 space-y-2 border-l-2 border-[#D62B38]/20 pl-3">
                      {thread.answers.map((ans) => (
                        <div key={ans.id} className={`rounded-lg p-2.5 ${ans.isStaff ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-xs font-semibold text-gray-900">{ans.userName}</span>
                            {ans.isStaff && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#D62B38] text-white">
                                Staff
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 ml-auto">
                              {formatDhaka(new Date(ans.createdAt), 'time')}
                            </span>
                            <button
                              onClick={() => void handleDeleteQA(ans.id, thread.id)}
                              disabled={deletingId === ans.id}
                              className="p-0.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                              aria-label="Delete answer"
                            >
                              {deletingId === ans.id
                                ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                                : <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                              }
                            </button>
                          </div>
                          <p className="text-xs text-gray-700 leading-relaxed">{ans.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Answer composer (staff) */}
                  <div className="ml-4 pl-3 border-l-2 border-gray-100 flex gap-2 mt-1">
                    <textarea
                      value={answerText[thread.id] ?? ''}
                      onChange={(e) => setAnswerText((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handlePostAnswer(thread.id);
                        }
                      }}
                      placeholder="Reply as instructor…"
                      rows={1}
                      maxLength={2000}
                      className="flex-1 text-xs text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#D62B38]/30 resize-none"
                    />
                    <motion.button
                      onClick={() => void handlePostAnswer(thread.id)}
                      disabled={postingAnswer === thread.id || !(answerText[thread.id] ?? '').trim()}
                      whileTap={{ scale: 0.93 }}
                      className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#D62B38] text-white disabled:opacity-50 self-end"
                      aria-label="Post answer"
                    >
                      {postingAnswer === thread.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                        : <Send className="w-3.5 h-3.5" strokeWidth={2} />
                      }
                    </motion.button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
