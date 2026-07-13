'use client';

/**
 * Student class detail page client component.
 * Shows class info, materials, recording link, and Q&A thread.
 */

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, Variants } from 'motion/react';
import {
  ArrowLeft,
  FileText,
  Link2,
  PlayCircle,
  MessageSquare,
  Send,
  Trash2,
  Loader2,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
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
}

interface MaterialInfo {
  id: number;
  title: string;
  type: string;
  blobUrl: string;
  fileName: string | null;
}

interface RecordingInfo {
  id: number;
  status: string;
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

interface ThreadRow {
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
  materials: MaterialInfo[];
  recording: RecordingInfo | null;
  initialThreads: ThreadRow[];
  currentUserId: number;
}

// ─── Design tokens (shared with DashboardScreen / NextClassTile / etc.) ───────

const INK       = '#FAF5EF';
const INK_64    = 'rgba(250,245,239,0.64)';
const INK_40    = 'rgba(250,245,239,0.40)';
const TAN       = '#D4B094';
const TAN_HOVER = '#c9a07e';
const HAIRLINE  = 'rgba(212,176,148,0.16)';
const SURFACE   = 'rgba(250,245,239,0.04)';
const GREEN     = '#7DDFA3';
const RED       = '#FF8A8F';

// ─── Status / subject labels — text-only, no filled pills ─────────────────────

function StatusLabel({ status }: { status: string }) {
  const prefersReduced = useReducedMotion();
  if (status === 'live') {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <motion.span
          animate={prefersReduced ? {} : { opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-flex w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: GREEN }}
        />
        <span className="text-xs lowercase" style={{ color: GREEN }}>live now</span>
      </div>
    );
  }
  if (status === 'completed') {
    return <span className="text-xs lowercase flex-shrink-0" style={{ color: INK_40 }}>completed</span>;
  }
  return <span className="text-xs lowercase flex-shrink-0" style={{ color: TAN }}>scheduled</span>;
}

// ─── Section marker (matches HomeworkTile / ClassHistoryTile / NextClassTile) ─

function SectionMarker({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-heading italic text-sm flex-shrink-0" style={{ color: TAN }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: HAIRLINE }} />
    </div>
  );
}

const cardV: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28, delay: i * 0.06 },
  }),
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClassDetailStudentClient({
  classSession,
  materials,
  recording,
  initialThreads,
  currentUserId,
}: Props) {
  const [threads, setThreads] = useState<ThreadRow[]>(initialThreads);
  const [questionText, setQuestionText] = useState('');
  const [postingQuestion, setPostingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const scheduledDate = new Date(classSession.scheduledAt);

  // ── Post question ─────────────────────────────────────────────────────────
  const handlePostQuestion = async () => {
    const text = questionText.trim();
    if (!text) return;
    if (text.length > 2000) {
      setQuestionError('Question must be at most 2000 characters.');
      return;
    }
    setQuestionError(null);
    setPostingQuestion(true);
    try {
      const res = await fetch(`/api/lms/classes/${classSession.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to post question');
      }
      const newQ = await res.json() as ThreadRow;
      setThreads((prev) => [...prev, { ...newQ, answers: [] }]);
      setQuestionText('');
    } catch (e) {
      setQuestionError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setPostingQuestion(false);
    }
  };

  // ── Delete question/answer ────────────────────────────────────────────────
  const handleDelete = async (questionId: number, parentId?: number) => {
    if (!confirm('Delete this question?')) return;
    setDeletingId(questionId);
    try {
      const res = await fetch(`/api/lms/questions/${questionId}`, { method: 'DELETE' });
      if (!res.ok) return;
      if (parentId !== undefined) {
        // It's an answer — remove from its thread
        setThreads((prev) =>
          prev.map((t) =>
            t.id === parentId
              ? { ...t, answers: t.answers.filter((a) => a.id !== questionId) }
              : t,
          ),
        );
      } else {
        setThreads((prev) => prev.filter((t) => t.id !== questionId));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#1A0507' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(26,5,7,0.92)', borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-8 h-8 rounded-full transition-opacity hover:opacity-70 flex-shrink-0"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: TAN }} strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading font-medium text-base leading-tight truncate" style={{ color: INK }}>
              {classSession.title}
            </h1>
            <p className="text-xs lowercase mt-0.5" style={{ color: TAN }}>{classSession.subject}</p>
          </div>
          <StatusLabel status={classSession.status} />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6 space-y-8">
        {/* ── Class info ────────────────────────────────────────────────────── */}
        <motion.section custom={0} variants={cardV} initial="hidden" animate="visible">
          <SectionMarker label="class details" />
          <div className="flex flex-col">
            <div className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <span className="text-sm" style={{ color: INK_64 }}>scheduled</span>
              <span
                className="text-sm"
                style={{ color: INK, fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatDhaka(scheduledDate, 'datetime')}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <span className="text-sm" style={{ color: INK_64 }}>duration</span>
              <span
                className="text-sm"
                style={{ color: INK, fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                {classSession.durationMinutes} min
              </span>
            </div>
            {classSession.batch && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm" style={{ color: INK_64 }}>batch</span>
                <span
                  className="text-sm"
                  style={{ color: INK, fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {classSession.batch}
                </span>
              </div>
            )}
          </div>
        </motion.section>

        {/* ── Materials ─────────────────────────────────────────────────────── */}
        {materials.length > 0 && (
          <motion.section custom={1} variants={cardV} initial="hidden" animate="visible">
            <SectionMarker label="materials" />
            <div className="flex flex-col">
              {materials.map((mat) => (
                <Link
                  key={mat.id}
                  href={mat.type === 'pdf' ? `/dashboard/materials/${mat.id}` : mat.blobUrl}
                  target={mat.type === 'pdf' ? undefined : '_blank'}
                  rel={mat.type === 'pdf' ? undefined : 'noopener noreferrer'}
                  className="flex items-center gap-2.5 py-3 min-h-[44px] transition-opacity hover:opacity-80"
                  style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                >
                  {mat.type === 'pdf' ? (
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: INK_40 }} strokeWidth={1.5} />
                  ) : (
                    <Link2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: INK_40 }} strokeWidth={1.5} />
                  )}
                  <span className="text-sm truncate flex-1" style={{ color: INK }}>
                    {mat.fileName ?? mat.title}
                  </span>
                  <span className="text-xs flex-shrink-0" style={{ color: TAN }}>
                    {mat.type === 'pdf' ? 'Open PDF' : 'Open link'}
                  </span>
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Recording link ────────────────────────────────────────────────── */}
        {recording?.status === 'available' && (
          <motion.section custom={2} variants={cardV} initial="hidden" animate="visible">
            <Link
              href={`/dashboard/classes/${classSession.id}/recording`}
              className="flex items-center justify-center gap-2 w-full font-medium rounded-md transition-opacity hover:opacity-90"
              style={{ minHeight: '44px', backgroundColor: TAN, color: '#1A0507', padding: '0 1.5rem' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = TAN_HOVER; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = TAN; }}
            >
              <PlayCircle className="w-4 h-4" strokeWidth={2} />
              Watch class recording
            </Link>
          </motion.section>
        )}

        {/* ── Q&A section ───────────────────────────────────────────────────── */}
        <motion.section
          custom={3} variants={cardV} initial="hidden" animate="visible"
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: SURFACE, border: `1px solid ${HAIRLINE}` }}
        >
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            <MessageSquare className="w-4 h-4" style={{ color: TAN }} strokeWidth={1.5} />
            <span className="font-heading italic text-sm" style={{ color: TAN }}>
              questions &amp; answers
            </span>
            {threads.length > 0 && (
              <span
                className="ml-auto text-xs"
                style={{ color: INK_64, fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                {threads.length}
              </span>
            )}
          </div>

          {/* Threads */}
          <AnimatePresence initial={false}>
            {threads.length === 0 ? (
              <div className="px-5 py-8 flex flex-col items-center gap-2">
                <BookOpen className="w-6 h-6" style={{ color: INK_40 }} strokeWidth={1.25} />
                <p className="text-sm" style={{ color: INK_64 }}>No questions yet. Be the first to ask!</p>
              </div>
            ) : (
              threads.map((thread, i) => (
                <motion.div
                  key={thread.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: i * 0.04, type: 'spring' as const, stiffness: 300, damping: 28 }}
                  className="px-5 py-4 space-y-2"
                  style={{ borderBottom: `1px solid ${HAIRLINE}` }}
                >
                  {/* Question */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: INK }}>{thread.userName}</span>
                        {thread.isStaff && (
                          <span className="text-[10px] uppercase tracking-wide" style={{ color: TAN }}>
                            instructor
                          </span>
                        )}
                        <span
                          className="text-[10px] ml-auto"
                          style={{ color: INK_40, fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatDhaka(new Date(thread.createdAt), 'time')}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: INK_64 }}>{thread.body}</p>
                    </div>
                    {thread.isOwn && (
                      <button
                        onClick={() => void handleDelete(thread.id)}
                        disabled={deletingId === thread.id}
                        className="flex-shrink-0 p-1 transition-colors disabled:opacity-40"
                        style={{ color: INK_40 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = RED; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = INK_40; }}
                        aria-label="Delete question"
                      >
                        {deletingId === thread.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Answers */}
                  {thread.answers.length > 0 && (
                    <div className="ml-4 space-y-2 pl-3" style={{ borderLeft: `1px solid ${HAIRLINE}` }}>
                      {thread.answers.map((answer) => (
                        <div key={answer.id} className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-medium" style={{ color: INK }}>{answer.userName}</span>
                            {answer.isStaff && (
                              <span className="text-[10px] uppercase tracking-wide" style={{ color: TAN }}>
                                instructor
                              </span>
                            )}
                            <span
                              className="text-[10px] ml-auto"
                              style={{ color: INK_40, fontFamily: 'var(--font-math-mono)', fontVariantNumeric: 'tabular-nums' }}
                            >
                              {formatDhaka(new Date(answer.createdAt), 'time')}
                            </span>
                            {answer.isOwn && (
                              <button
                                onClick={() => void handleDelete(answer.id, thread.id)}
                                disabled={deletingId === answer.id}
                                className="p-0.5 transition-colors disabled:opacity-40"
                                style={{ color: INK_40 }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = RED; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = INK_40; }}
                                aria-label="Delete answer"
                              >
                                {deletingId === answer.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                                ) : (
                                  <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                                )}
                              </button>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: INK_64 }}>{answer.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>

          {/* Question composer */}
          <div className="px-5 py-4 space-y-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
            <div className="flex gap-2">
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handlePostQuestion();
                  }
                }}
                placeholder="Ask a question about this class…"
                rows={2}
                maxLength={2000}
                className="flex-1 text-sm rounded-xl px-3 py-2 resize-none focus:outline-none transition-colors"
                style={{ color: INK, backgroundColor: 'rgba(250,245,239,0.03)', border: `1px solid ${HAIRLINE}` }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,176,148,0.5)'; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = HAIRLINE; }}
              />
              <motion.button
                onClick={handlePostQuestion}
                disabled={postingQuestion || !questionText.trim()}
                whileTap={!postingQuestion ? { scale: 0.93 } : {}}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed self-end transition-opacity hover:opacity-90"
                style={{ backgroundColor: TAN, color: '#1A0507' }}
                aria-label="Post question"
              >
                {postingQuestion ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Send className="w-4 h-4" strokeWidth={2} />
                )}
              </motion.button>
            </div>
            {questionError && (
              <p className="text-xs" style={{ color: RED }}>{questionError}</p>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
