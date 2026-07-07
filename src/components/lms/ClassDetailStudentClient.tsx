'use client';

/**
 * Student class detail page client component.
 * Shows class info, materials, recording link, and Q&A thread.
 */

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  live:      'bg-emerald-50 text-emerald-700',
  completed: 'bg-stone-100 text-stone-600',
};

const SUBJECT_BADGE: Record<string, string> = {
  english:    'bg-blue-50 text-blue-700',
  math:       'bg-emerald-50 text-emerald-700',
  analytical: 'bg-amber-50 text-amber-700',
};

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
    <div className="min-h-screen bg-[#FAF5EF] pb-16">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8DDD5] px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#F5EDE3] transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4 text-[#5A0B0F]" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-[#1A0507] truncate">{classSession.title}</h1>
          <p className="text-xs text-[#A86E58] capitalize">{classSession.subject}</p>
        </div>
        <span className={`inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[classSession.status] ?? 'bg-stone-100 text-stone-600'}`}>
          {classSession.status}
        </span>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-5 space-y-4">
        {/* ── Class info ────────────────────────────────────────────────────── */}
        <motion.section
          custom={0} variants={cardV} initial="hidden" animate="visible"
          className="bg-white rounded-2xl border border-[#E8DDD5] p-5 space-y-3"
          style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
        >
          <div className="flex flex-wrap gap-2">
            <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${SUBJECT_BADGE[classSession.subject] ?? 'bg-stone-50 text-stone-600'}`}>
              {classSession.subject}
            </span>
            {classSession.batch && (
              <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F5EDE3] text-[#A86E58]">
                Batch {classSession.batch}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-[#A86E58] text-xs">Scheduled</dt>
            <dd className="text-[#1A0507] text-xs font-medium">
              {formatDhaka(scheduledDate, 'datetime')}
            </dd>
            <dt className="text-[#A86E58] text-xs">Duration</dt>
            <dd className="text-[#1A0507] text-xs font-medium">{classSession.durationMinutes} min</dd>
          </dl>
        </motion.section>

        {/* ── Materials ─────────────────────────────────────────────────────── */}
        {materials.length > 0 && (
          <motion.section
            custom={1} variants={cardV} initial="hidden" animate="visible"
            className="bg-white rounded-2xl border border-[#E8DDD5] p-5 space-y-2"
            style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
          >
            <p className="text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold mb-2">
              Materials
            </p>
            {materials.map((mat) => (
              <motion.a
                key={mat.id}
                href={mat.type === 'pdf' ? `/dashboard/materials/${mat.id}` : mat.blobUrl}
                target={mat.type === 'pdf' ? undefined : '_blank'}
                rel={mat.type === 'pdf' ? undefined : 'noopener noreferrer'}
                whileHover={{ x: 2 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
                className="flex items-center gap-2 text-sm text-[#5A0B0F] hover:text-[#760F13] transition-colors group"
              >
                {mat.type === 'pdf' ? (
                  <FileText className="w-3.5 h-3.5 text-[#D4B094] flex-shrink-0" strokeWidth={1.5} />
                ) : (
                  <Link2 className="w-3.5 h-3.5 text-[#D4B094] flex-shrink-0" strokeWidth={1.5} />
                )}
                <span className="text-xs truncate group-hover:underline underline-offset-2">
                  {mat.fileName ?? mat.title}
                </span>
              </motion.a>
            ))}
          </motion.section>
        )}

        {/* ── Recording link ────────────────────────────────────────────────── */}
        {recording?.status === 'available' && (
          <motion.section
            custom={2} variants={cardV} initial="hidden" animate="visible"
          >
            <Link
              href={`/dashboard/classes/${classSession.id}/recording`}
              className="flex items-center gap-2 text-sm text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 hover:bg-emerald-100 transition-colors"
            >
              <PlayCircle className="w-4 h-4" strokeWidth={1.5} />
              Watch class recording
            </Link>
          </motion.section>
        )}

        {/* ── Q&A section ───────────────────────────────────────────────────── */}
        <motion.section
          custom={3} variants={cardV} initial="hidden" animate="visible"
          className="bg-white rounded-2xl border border-[#E8DDD5] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
        >
          <div className="px-5 py-4 border-b border-[#F0E8E0] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />
            <p className="text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold">
              Questions & Answers
            </p>
            {threads.length > 0 && (
              <span className="ml-auto text-xs font-medium text-[#760F13] bg-[#F5EDE3] px-2 py-0.5 rounded-full">
                {threads.length}
              </span>
            )}
          </div>

          {/* Threads */}
          <div className="divide-y divide-[#F0E8E0]">
            <AnimatePresence initial={false}>
              {threads.length === 0 ? (
                <div className="px-5 py-6 flex flex-col items-center gap-2">
                  <BookOpen className="w-6 h-6 text-[#D4B094]" strokeWidth={1.25} />
                  <p className="text-xs text-[#A86E58]/70">No questions yet. Be the first to ask!</p>
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
                  >
                    {/* Question */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-xs font-semibold text-[#1A0507]">{thread.userName}</span>
                          {thread.isStaff && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#760F13] text-white">
                              Instructor
                            </span>
                          )}
                          <span className="text-[10px] text-[#A86E58] ml-auto">
                            {formatDhaka(new Date(thread.createdAt), 'time')}
                          </span>
                        </div>
                        <p className="text-sm text-[#3D1517] leading-relaxed">{thread.body}</p>
                      </div>
                      {thread.isOwn && (
                        <button
                          onClick={() => void handleDelete(thread.id)}
                          disabled={deletingId === thread.id}
                          className="flex-shrink-0 p-1 text-[#C4A08A] hover:text-red-500 transition-colors disabled:opacity-40"
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
                      <div className="ml-4 space-y-2 border-l-2 border-[#760F13]/20 pl-3">
                        {thread.answers.map((answer) => (
                          <div key={answer.id} className={`rounded-xl p-3 space-y-1 ${answer.isStaff ? 'bg-[#F5EDE3] border border-[#760F13]/15' : 'bg-[#FAF5EF]'}`}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-[#1A0507]">{answer.userName}</span>
                              {answer.isStaff && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#760F13] text-white">
                                  Instructor
                                </span>
                              )}
                              <span className="text-[10px] text-[#A86E58] ml-auto">
                                {formatDhaka(new Date(answer.createdAt), 'time')}
                              </span>
                              {answer.isOwn && (
                                <button
                                  onClick={() => void handleDelete(answer.id, thread.id)}
                                  disabled={deletingId === answer.id}
                                  className="p-0.5 text-[#C4A08A] hover:text-red-500 transition-colors disabled:opacity-40"
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
                            <p className="text-xs text-[#3D1517] leading-relaxed">{answer.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Question composer */}
          <div className="px-5 py-4 border-t border-[#F0E8E0] space-y-2">
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
                className="flex-1 text-sm text-[#1A0507] border border-[#E8DDD5] rounded-xl px-3 py-2 bg-[#FAF5EF]/50 focus:outline-none focus:border-[#760F13]/50 transition-colors resize-none placeholder:text-[#C4A08A]"
              />
              <motion.button
                onClick={handlePostQuestion}
                disabled={postingQuestion || !questionText.trim()}
                whileTap={!postingQuestion ? { scale: 0.93 } : {}}
                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-[#760F13] text-white disabled:opacity-50 disabled:cursor-not-allowed self-end"
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
              <p className="text-xs text-red-600">{questionError}</p>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
