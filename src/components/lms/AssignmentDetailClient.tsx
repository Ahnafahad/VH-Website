'use client';

/**
 * Student assignment detail + submission UI.
 * States:
 *   pending   → upload zone + note field → submit
 *   submitted → file link + note + "resubmit" option (if not reviewed)
 *   reviewed  → green feedback state + instructor comment
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import {
  ArrowLeft,
  Paperclip,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  Upload,
  Loader2,
  RotateCcw,
  BookOpen,
  Users,
  KeyRound,
} from 'lucide-react';
import Link from 'next/link';
import { uploadToR2 } from '@/lib/lms/upload-client';
import { formatDhaka } from '@/lib/lms/time';
import { trackFeature } from '@/lib/analytics/tracker';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignmentInfo {
  id: number;
  title: string;
  description: string;
  attachmentUrl: string | null;
  subject: string;
  dueAt: number;
  classSessionId: number | null;
}

export interface SubmissionInfo {
  id: number;
  status: 'submitted' | 'reviewed';
  mode: 'file' | 'offline';
  fileUrl: string | null;
  note: string | null;
  instructorComment: string | null;
  submittedAt: number;
  reviewedAt: number | null;
}

interface Props {
  assignment: AssignmentInfo;
  initialSubmission: SubmissionInfo | null;
  solutionUrl: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDueState(dueAt: number): 'overdue' | 'urgent' | 'normal' {
  const msLeft = dueAt - Date.now();
  if (msLeft < 0) return 'overdue';
  if (msLeft < 48 * 3600_000) return 'urgent';
  return 'normal';
}

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  english:    { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
  math:       { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200'},
  analytical: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200'  },
};

const cardV: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssignmentDetailClient({ assignment, initialSubmission, solutionUrl }: Props) {
  const [submission, setSubmission] = useState<SubmissionInfo | null>(initialSubmission);
  const [resubmitting, setResubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<'file' | 'offline' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const subjectStyle = SUBJECT_COLORS[assignment.subject] ?? { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200' };
  const dueState = getDueState(assignment.dueAt);

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async (mode: 'file' | 'offline') => {
    if (mode === 'file' && !selectedFile && !note.trim()) {
      setError('Please attach a file or write a note before submitting.');
      return;
    }
    setError(null);
    setUploading(true);

    let fileUrl: string | null = null;

    try {
      if (mode === 'file' && selectedFile) {
        const { key } = await uploadToR2({
          file: selectedFile,
          endpoint: '/api/lms/uploads/submission',
          onProgress: (pct) => setUploadProgress(pct),
        });
        fileUrl = key;
      }

      setUploading(false);
      setSubmitting(true);

      const res = await fetch(`/api/lms/assignments/${assignment.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl, note: note.trim() || undefined, mode }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Submission failed');
      }

      const saved = await res.json() as SubmissionInfo;
      trackFeature(resubmitting ? 'assignment_resubmitted' : 'assignment_submitted', 'lms', {
        assignmentId: assignment.id,
        hasFile: Boolean(fileUrl),
        hasNote: Boolean(note.trim()),
        mode,
      });
      setSubmission(saved);
      setResubmitting(false);
      setSelectedFile(null);
      setNote('');
      setUploadProgress(0);
      setChoice(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  const isSubmitting = uploading || submitting;
  const showUploadForm =
    submission === null ||
    (resubmitting && submission.status !== 'reviewed');

  return (
    <div className="min-h-screen bg-[#FAF5EF] pb-16 pt-24 sm:pt-28">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8DDD5] px-4 py-4 flex items-center gap-3 sticky top-24 sm:top-28 z-10">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#F5EDE3] transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4 text-[#5A0B0F]" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-[#1A0507] truncate">{assignment.title}</h1>
          <p className="text-xs text-[#A86E58] capitalize">{assignment.subject}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-5 space-y-4">
        {/* ── Assignment info ───────────────────────────────────────────────── */}
        <motion.section
          variants={cardV} initial="hidden" animate="visible"
          className="bg-white rounded-2xl border border-[#E8DDD5] p-5 space-y-3"
          style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
        >
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${subjectStyle.bg} ${subjectStyle.text} ${subjectStyle.border}`}>
              {assignment.subject}
            </span>
            {/* Due chip */}
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
              dueState === 'overdue'
                ? 'bg-red-50 text-red-600 border-red-200'
                : dueState === 'urgent'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-stone-50 text-stone-600 border-stone-200'
            }`}>
              {dueState === 'overdue' ? (
                <AlertCircle className="w-2.5 h-2.5" strokeWidth={2} />
              ) : (
                <Clock className="w-2.5 h-2.5" strokeWidth={2} />
              )}
              Due {formatDhaka(new Date(assignment.dueAt), 'datetime')}
            </span>
          </div>

          <p className="text-sm text-[#3D1517] leading-relaxed whitespace-pre-line">
            {assignment.description}
          </p>

          {assignment.attachmentUrl && (
            <a
              href={assignment.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-[#760F13] font-medium hover:underline"
            >
              <Paperclip className="w-3.5 h-3.5" strokeWidth={1.5} />
              View attached resource
            </a>
          )}
        </motion.section>

        {/* ── Submission state ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* Reviewed state */}
          {submission?.status === 'reviewed' && !resubmitting ? (
            <motion.section
              key="reviewed"
              variants={cardV} initial="hidden" animate="visible" exit={{ opacity: 0, y: -8 }}
              className="bg-white rounded-2xl border border-[#E8DDD5] p-5 space-y-3"
              style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-emerald-700">Reviewed</p>
                {submission.mode === 'offline' && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-50 text-stone-600 border border-stone-200">
                    Shown in class
                  </span>
                )}
                {submission.reviewedAt && (
                  <span className="text-xs text-[#A86E58] ml-auto">
                    {formatDhaka(new Date(submission.reviewedAt), 'datetime')}
                  </span>
                )}
              </div>

              {submission.fileUrl && (
                <a
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-[#760F13] font-medium hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Your submitted file
                </a>
              )}
              {submission.note && (
                <p className="text-xs text-[#5A0B0F] bg-[#FAF5EF] rounded-xl p-3 leading-relaxed">
                  {submission.note}
                </p>
              )}

              {submission.instructorComment && (
                <div className="border-l-2 border-[#760F13] pl-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold">
                    Instructor feedback
                  </p>
                  <p className="text-sm text-[#1A0507] leading-relaxed">
                    {submission.instructorComment}
                  </p>
                </div>
              )}
            </motion.section>
          ) : submission?.status === 'submitted' && !resubmitting ? (
            /* Submitted state */
            <motion.section
              key="submitted"
              variants={cardV} initial="hidden" animate="visible" exit={{ opacity: 0, y: -8 }}
              className="bg-white rounded-2xl border border-[#E8DDD5] p-5 space-y-3"
              style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
            >
              <div className="flex items-center gap-2">
                {submission.mode === 'offline' ? (
                  <Users className="w-5 h-5 text-[#760F13]" strokeWidth={1.5} />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#760F13]" strokeWidth={1.5} />
                )}
                <p className="text-sm font-semibold text-[#1A0507]">
                  {submission.mode === 'offline' ? "You'll show this in the next class" : 'Submitted'}
                </p>
                <span className="text-xs text-[#A86E58] ml-auto">
                  {formatDhaka(new Date(submission.submittedAt), 'datetime')}
                </span>
              </div>

              {submission.fileUrl && (
                <a
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-[#760F13] font-medium hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Your submitted file
                </a>
              )}
              {submission.note && (
                <p className="text-xs text-[#5A0B0F] bg-[#FAF5EF] rounded-xl p-3 leading-relaxed">
                  {submission.note}
                </p>
              )}

              <button
                onClick={() => setResubmitting(true)}
                className="flex items-center gap-1.5 text-xs text-[#A86E58] hover:text-[#760F13] transition-colors mt-1"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                Resubmit
              </button>
            </motion.section>
          ) : null}
        </AnimatePresence>

        {/* ── Solution unlock ───────────────────────────────────────────────── */}
        {submission && solutionUrl && (
          <motion.section
            variants={cardV} initial="hidden" animate="visible"
            className="bg-white rounded-2xl border border-[#E8DDD5] p-5"
            style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
          >
            <a
              href={solutionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-semibold text-[#760F13] hover:underline"
            >
              <KeyRound className="w-4 h-4" strokeWidth={1.5} />
              View solution
            </a>
          </motion.section>
        )}

        {/* ── Upload zone ───────────────────────────────────────────────────── */}
        {showUploadForm && (
          <motion.section
            key="upload"
            variants={cardV} initial="hidden" animate="visible"
            className="bg-white rounded-2xl border border-[#E8DDD5] p-5 space-y-4"
            style={{ boxShadow: '0 1px 3px rgba(90,11,15,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#760F13]" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-[#1A0507]">
                {resubmitting ? 'Resubmit Assignment' : 'Submit Assignment'}
              </p>
              {resubmitting && (
                <button
                  onClick={() => { setResubmitting(false); setChoice(null); }}
                  className="ml-auto text-xs text-[#A86E58] hover:text-[#760F13] transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            {choice === null ? (
              /* ── Choice: upload a file, or show it in person next class ─────── */
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => setChoice('file')}
                  whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E8DDD5] hover:border-[#D4B094] bg-[#FAF5EF]/50 p-6 transition-colors"
                >
                  <Upload className="w-6 h-6 text-[#D4B094]" strokeWidth={1.25} />
                  <p className="text-xs font-medium text-[#1A0507] text-center">Upload a file</p>
                </motion.button>
                <motion.button
                  onClick={() => setChoice('offline')}
                  whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E8DDD5] hover:border-[#D4B094] bg-[#FAF5EF]/50 p-6 transition-colors"
                >
                  <Users className="w-6 h-6 text-[#D4B094]" strokeWidth={1.25} />
                  <p className="text-xs font-medium text-[#1A0507] text-center">I&apos;ll show it in the next class</p>
                </motion.button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setChoice(null)}
                  className="flex items-center gap-1.5 text-xs text-[#A86E58] hover:text-[#760F13] transition-colors -mt-1"
                >
                  <ArrowLeft className="w-3 h-3" strokeWidth={1.5} />
                  Back
                </button>

                {choice === 'file' ? (
                  <>
                    {/* File picker */}
                    <div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setSelectedFile(file);
                          setError(null);
                        }}
                      />
                      <motion.button
                        onClick={() => fileRef.current?.click()}
                        whileTap={{ scale: 0.97 }}
                        className={`w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors ${
                          selectedFile
                            ? 'border-[#760F13]/40 bg-[#FAF5EF]'
                            : 'border-[#E8DDD5] hover:border-[#D4B094] bg-[#FAF5EF]/50'
                        }`}
                      >
                        {selectedFile ? (
                          <>
                            <FileText className="w-6 h-6 text-[#760F13]" strokeWidth={1.25} />
                            <p className="text-xs font-medium text-[#1A0507] text-center break-all">
                              {selectedFile.name}
                            </p>
                            <p className="text-[10px] text-[#A86E58]">
                              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                            </p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-[#D4B094]" strokeWidth={1.25} />
                            <p className="text-xs text-[#A86E58] text-center">
                              Tap to attach PDF or image
                            </p>
                            <p className="text-[10px] text-[#C4A08A]">Max 20 MB</p>
                          </>
                        )}
                      </motion.button>
                    </div>

                    {/* Upload progress bar */}
                    <AnimatePresence>
                      {uploading && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="w-full h-1.5 bg-[#F0E8E0] rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-[#760F13] rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                              transition={{ ease: 'easeOut' }}
                            />
                          </div>
                          <p className="text-[10px] text-[#A86E58] mt-1 text-center">
                            Uploading… {uploadProgress}%
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Note field */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold mb-1.5">
                        Note (optional)
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a note for your instructor…"
                        rows={3}
                        className="w-full text-sm text-[#1A0507] border border-[#E8DDD5] rounded-xl px-3 py-2.5 bg-[#FAF5EF]/50 focus:outline-none focus:border-[#760F13]/50 transition-colors resize-none placeholder:text-[#C4A08A]"
                      />
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        {error}
                      </div>
                    )}

                    <motion.button
                      onClick={() => void handleSubmit('file')}
                      disabled={isSubmitting}
                      whileTap={!isSubmitting ? { scale: 0.97 } : {}}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${
                        isSubmitting
                          ? 'bg-[#A86E58] text-white cursor-not-allowed opacity-70'
                          : 'bg-[#760F13] text-white hover:bg-[#5A0B0F]'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                          {uploading ? 'Uploading…' : 'Submitting…'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                          {resubmitting ? 'Resubmit' : 'Submit Assignment'}
                        </>
                      )}
                    </motion.button>
                  </>
                ) : (
                  <>
                    {/* Offline confirm panel */}
                    <p className="text-xs text-[#5A0B0F] bg-[#FAF5EF] rounded-xl p-3 leading-relaxed">
                      You&apos;ll bring your completed homework and show it to your instructor in person during the next class.
                    </p>

                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-[#A86E58] font-semibold mb-1.5">
                        Note (optional)
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a note for your instructor…"
                        rows={3}
                        className="w-full text-sm text-[#1A0507] border border-[#E8DDD5] rounded-xl px-3 py-2.5 bg-[#FAF5EF]/50 focus:outline-none focus:border-[#760F13]/50 transition-colors resize-none placeholder:text-[#C4A08A]"
                      />
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                        {error}
                      </div>
                    )}

                    <motion.button
                      onClick={() => void handleSubmit('offline')}
                      disabled={isSubmitting}
                      whileTap={!isSubmitting ? { scale: 0.97 } : {}}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${
                        isSubmitting
                          ? 'bg-[#A86E58] text-white cursor-not-allowed opacity-70'
                          : 'bg-[#760F13] text-white hover:bg-[#5A0B0F]'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                          Submitting…
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4" strokeWidth={2} />
                          I&apos;ll show it in class
                        </>
                      )}
                    </motion.button>
                  </>
                )}
              </>
            )}
          </motion.section>
        )}
      </div>
    </div>
  );
}
