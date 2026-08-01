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
  FileText,
  Upload,
  Link2,
  X as XIcon,
} from 'lucide-react';
import { formatDhaka } from '@/lib/lms/time';
import { uploadToR2 } from '@/lib/lms/upload-client';
import {
  useConfirm,
  EmptyState,
  SURFACE, SURFACE_ALT, BORDER, MUTED, BG, SLATE, INK_SOFT,
  RED, RED_HOVER, RED_DARK,
  OK, OK_BG, WARN, WARN_BG, INFO, INFO_BG,
  R_MD, R_LG, R_PILL,
  SHADOW_SM,
  FONT_HEADING,
  SPIN_CSS,
} from './lms-shared';

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
  topic: string | null;
  classNumber: number | null;
  instructorName: string | null;
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

interface MaterialInfo {
  id: number;
  title: string;
  type: string;
  fileName: string | null;
  fileSize: number | null;
  subject: string;
  createdAt: number;
}

interface Props {
  classSession: ClassSessionInfo;
  recording: RecordingInfo | null;
  attendance: AttendeeRow[];
  grants: GrantRow[];
  allUsers: UserOption[];
  initialThreads: QuestionThread[];
  currentUserId: number;
  initialMaterials: MaterialInfo[];
}

// ─── Local styles (hover / focus-visible — inline style props can't express
//     pseudo-classes, so this scoped stylesheet fills that gap using the same
//     imported tokens as everything else in this file) ────────────────────────

const LOCAL_STYLES = `
  .cdc-iconbtn { transition: background-color .15s, color .15s; }
  .cdc-iconbtn:hover:not(:disabled) { background: ${SURFACE_ALT}; }
  .cdc-iconbtn.cdc-danger:hover:not(:disabled) { background: ${RED}14; color: ${RED}; }
  .cdc-link { transition: color .15s; }
  .cdc-link:hover { color: ${RED_DARK}; }
  .cdc-btn-primary { transition: background-color .15s; }
  .cdc-btn-primary:hover:not(:disabled) { background: ${RED_HOVER}; }
  .cdc-iconbtn:focus-visible, .cdc-link:focus-visible, .cdc-btn-primary:focus-visible,
  .cdc-input:focus-visible, .cdc-pick-row:focus-visible, .cdc-back:focus-visible {
    outline: 2px solid ${RED}; outline-offset: 2px;
  }
  .cdc-back { transition: background-color .15s; }
  .cdc-back:hover { background: ${SURFACE_ALT}; }
  .cdc-pick-row { transition: background-color .15s, border-color .15s; }
  .cdc-pick-row:hover:not(:disabled) { background: ${SURFACE}; border-color: ${BORDER}; }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:     { bg: SURFACE_ALT, color: MUTED },
  scheduled: { bg: INFO_BG,     color: INFO },
  live:      { bg: OK_BG,       color: OK },
  completed: { bg: OK_BG,       color: OK },
  cancelled: { bg: `${RED}14`,  color: RED },
};

const RECORDING_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:    { bg: WARN_BG,    color: WARN },
  processing: { bg: INFO_BG,    color: INFO },
  available:  { bg: OK_BG,      color: OK },
  failed:     { bg: `${RED}14`, color: RED },
  expired:    { bg: SURFACE_ALT, color: MUTED },
};

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em',
        fontWeight: 600, padding: '2px 9px', borderRadius: R_PILL, background: bg, color,
      }}
    >
      {children}
    </span>
  );
}

function statusBadge(status: string) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return <Pill bg={s.bg} color={s.color}>{status}</Pill>;
}

function recordingStatusBadge(status: string) {
  const s = RECORDING_STATUS_STYLE[status] ?? RECORDING_STATUS_STYLE.expired;
  return <Pill bg={s.bg} color={s.color}>{status}</Pill>;
}

const sectionLabel: React.CSSProperties = {
  fontFamily: FONT_HEADING, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: MUTED, fontWeight: 600, margin: 0,
};

const cardStyle: React.CSSProperties = {
  background: SURFACE, borderRadius: R_LG, border: `1px solid ${BORDER}`, boxShadow: SHADOW_SM,
};

const inputStyle: React.CSSProperties = {
  fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: R_MD, padding: '7px 10px',
  color: SLATE, background: SURFACE, outline: 'none',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClassDetailClient({
  classSession,
  recording,
  attendance,
  grants: initialGrants,
  allUsers,
  initialThreads,
  currentUserId,
  initialMaterials,
}: Props) {
  const [grants, setGrants] = useState<GrantRow[]>(initialGrants);

  // Materials state
  const [sessionMats, setSessionMats] = useState<MaterialInfo[]>(initialMaterials);
  const [showAttachPicker, setShowAttachPicker] = useState(false);
  const [allMaterials, setAllMaterials] = useState<MaterialInfo[]>([]);
  const [loadingAllMats, setLoadingAllMats] = useState(false);
  const [attachingId, setAttachingId] = useState<number | null>(null);
  const [detachingId, setDetachingId] = useState<number | null>(null);
  const [matUploadFile, setMatUploadFile] = useState<File | null>(null);
  const [matUploadTitle, setMatUploadTitle] = useState('');
  const [matUploading, setMatUploading] = useState(false);
  const [matUploadProgress, setMatUploadProgress] = useState(0);
  const [matError, setMatError] = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState<string>('');     // '' = batch-wide
  const [grantExpiry, setGrantExpiry] = useState<string>('');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Q&A state
  const [threads, setThreads] = useState<QuestionThread[]>(initialThreads);
  const [answerText, setAnswerText] = useState<Record<number, string>>({});
  const [postingAnswer, setPostingAnswer] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const scheduledDate = new Date(classSession.scheduledAt);

  // ── Materials: load all for picker ────────────────────────────────────────
  async function openAttachPicker() {
    setShowAttachPicker(true);
    if (allMaterials.length > 0) return;
    setLoadingAllMats(true);
    try {
      const res = await fetch('/api/lms/admin/materials');
      if (res.ok) setAllMaterials(await res.json() as MaterialInfo[]);
    } finally {
      setLoadingAllMats(false);
    }
  }

  async function handleAttach(materialId: number) {
    setAttachingId(materialId);
    try {
      const res = await fetch(`/api/lms/admin/classes/${classSession.id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId }),
      });
      if (!res.ok) throw new Error('Failed to attach');
      const mat = allMaterials.find((m) => m.id === materialId);
      if (mat && !sessionMats.find((m) => m.id === materialId)) {
        setSessionMats((prev) => [...prev, mat]);
      }
      setShowAttachPicker(false);
    } catch {
      setMatError('Failed to attach material');
    } finally {
      setAttachingId(null);
    }
  }

  async function handleDetach(materialId: number) {
    setDetachingId(materialId);
    try {
      const res = await fetch(
        `/api/lms/admin/classes/${classSession.id}/materials?materialId=${materialId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to detach');
      setSessionMats((prev) => prev.filter((m) => m.id !== materialId));
    } catch {
      setMatError('Failed to detach material');
    } finally {
      setDetachingId(null);
    }
  }

  async function handleUploadMaterial() {
    if (!matUploadFile) return;
    setMatUploading(true); setMatError(null);
    try {
      const { key } = await uploadToR2({
        file: matUploadFile,
        endpoint: '/api/lms/admin/materials/upload',
        onProgress: setMatUploadProgress,
      });
      const matRes = await fetch('/api/lms/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: matUploadTitle.trim() || matUploadFile.name,
          type: 'pdf',
          blobUrl: key,
          fileName: matUploadFile.name,
          fileSize: matUploadFile.size,
          subject: classSession.subject,
          product: classSession.product,
          batch: classSession.batch ?? null,
          classSessionId: classSession.id,
        }),
      });
      if (!matRes.ok) throw new Error('Material save failed');
      const newMat = await matRes.json() as MaterialInfo;
      setSessionMats((prev) => [...prev, newMat]);
      setMatUploadFile(null);
      setMatUploadTitle('');
      setMatUploadProgress(0);
    } catch (e) {
      setMatError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setMatUploading(false);
    }
  }

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
    const ok = await confirm({
      title: 'Revoke this access grant?',
      message: 'The student will lose access immediately. You can grant access again later.',
      confirmLabel: 'Revoke',
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: 'Delete this message?',
      message: "This can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
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
    <div style={{ minHeight: '100vh', background: BG, paddingBottom: 64, colorScheme: 'light' }}>
      <style>{SPIN_CSS}{LOCAL_STYLES}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: SURFACE, borderBottom: `1px solid ${BORDER}`,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link
          href="/admin/classes"
          className="cdc-back"
          aria-label="Back to classes"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: R_PILL, flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} strokeWidth={2} style={{ color: INK_SOFT }} aria-hidden />
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{
            margin: 0, fontFamily: FONT_HEADING, fontSize: 15, fontWeight: 700, color: SLATE,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {classSession.title}
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: MUTED, textTransform: 'capitalize' }}>
            {classSession.subject} · {classSession.product}
            {classSession.batch ? ` · Batch ${classSession.batch}` : ''}
          </p>
        </div>
        {statusBadge(classSession.status)}
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Session Info ───────────────────────────────────────────────────── */}
        <section style={{ ...cardStyle, padding: 20 }}>
          <h2 style={{ ...sectionLabel, marginBottom: 12 }}>Class Info</h2>
          <dl style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 16, rowGap: 8, fontSize: 13, margin: 0,
          }}>
            <dt style={{ color: MUTED, margin: 0 }}>Scheduled</dt>
            <dd style={{ fontWeight: 500, color: SLATE, margin: 0 }}>
              {formatDhaka(scheduledDate, 'datetime')}
            </dd>
            <dt style={{ color: MUTED, margin: 0 }}>Duration</dt>
            <dd style={{ fontWeight: 500, color: SLATE, margin: 0 }}>{classSession.durationMinutes} min</dd>
            <dt style={{ color: MUTED, margin: 0 }}>Instructor</dt>
            <dd style={{ fontWeight: 500, color: SLATE, margin: 0 }}>{classSession.instructorName ?? 'Not set'}</dd>
            {classSession.topic && (
              <>
                <dt style={{ color: MUTED, margin: 0 }}>Topic</dt>
                <dd style={{ fontWeight: 500, color: SLATE, margin: 0 }}>{classSession.topic}</dd>
              </>
            )}
            {classSession.classNumber != null && (
              <>
                <dt style={{ color: MUTED, margin: 0 }}>Class #</dt>
                <dd style={{ fontWeight: 500, color: SLATE, margin: 0 }}>{classSession.classNumber}</dd>
              </>
            )}
            {classSession.meetLink && (
              <>
                <dt style={{ color: MUTED, margin: 0 }}>Meet link</dt>
                <dd style={{ margin: 0, minWidth: 0 }}>
                  <a
                    href={classSession.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cdc-link"
                    style={{
                      color: INFO, textDecoration: 'underline', fontSize: 12,
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {classSession.meetLink}
                  </a>
                </dd>
              </>
            )}
            {classSession.recallBotId && (
              <>
                <dt style={{ color: MUTED, margin: 0 }}>Bot ID</dt>
                <dd style={{
                  fontSize: 11, color: MUTED, fontFamily: 'monospace', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {classSession.recallBotId}
                </dd>
              </>
            )}
          </dl>
        </section>

        {/* ── Recording ─────────────────────────────────────────────────────── */}
        <section style={{ ...cardStyle, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Video size={15} strokeWidth={1.5} style={{ color: MUTED }} aria-hidden />
            <h2 style={sectionLabel}>Recording</h2>
          </div>

          {!recording ? (
            <EmptyState icon={Video} message="No recording for this session." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {recordingStatusBadge(recording.status)}
                {recording.durationSeconds && (
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {Math.round(recording.durationSeconds / 60)} min
                  </span>
                )}
                {recording.fileSize && (
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {(recording.fileSize / 1_000_000).toFixed(1)} MB
                  </span>
                )}
              </div>
              {recording.errorMessage && (
                <p style={{
                  margin: 0, fontSize: 12, color: RED, background: `${RED}14`,
                  borderRadius: R_MD, padding: '8px 12px',
                }}>
                  {recording.errorMessage}
                </p>
              )}

              {/* ── Grants ─────────────────────────────────────────────────── */}
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: SLATE }}>Access Grants</p>

                {grants.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: MUTED }}>No active grants.</p>
                ) : (
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                    {grants.map((g) => {
                      const isExpired = g.expiresAt <= Date.now();
                      const userName =
                        g.userId !== null
                          ? (allUsers.find((u) => u.id === g.userId)?.name ?? `User #${g.userId}`)
                          : 'Whole batch';
                      return (
                        <li
                          key={g.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                        >
                          {isExpired ? (
                            <XCircle size={14} strokeWidth={1.5} style={{ color: `${RED}99`, flexShrink: 0 }} aria-hidden />
                          ) : (
                            <CheckCircle size={14} strokeWidth={1.5} style={{ color: OK, flexShrink: 0 }} aria-hidden />
                          )}
                          <span style={{ color: isExpired ? MUTED : INK_SOFT, textDecoration: isExpired ? 'line-through' : 'none' }}>
                            {userName}
                          </span>
                          <span style={{ color: MUTED }}>until</span>
                          <span style={{ color: isExpired ? MUTED : INK_SOFT }}>
                            {formatDhaka(new Date(g.expiresAt), 'datetime')}
                          </span>
                          {!isExpired && (
                            <button
                              onClick={() => handleRevoke(g.id)}
                              className="cdc-iconbtn cdc-danger"
                              aria-label="Revoke grant"
                              style={{
                                marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, borderRadius: R_MD, border: 'none', background: 'transparent',
                                color: `${RED}99`, cursor: 'pointer', flexShrink: 0,
                              }}
                            >
                              <Trash2 size={14} strokeWidth={1.5} aria-hidden />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Grant form */}
                <form onSubmit={(e) => { void handleGrant(e); }} style={{
                  marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}`,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: SLATE, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={12} strokeWidth={2} aria-hidden /> Add Extension Grant
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <select
                        value={grantUserId}
                        onChange={(e) => setGrantUserId(e.target.value)}
                        className="cdc-input"
                        style={{ ...inputStyle, flex: '1 1 160px', minWidth: 0 }}
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
                        className="cdc-input"
                        style={{ ...inputStyle, flex: '1 1 160px', minWidth: 0 }}
                        required
                      />

                      <motion.button
                        type="submit"
                        disabled={isPending}
                        whileTap={{ scale: 0.97 }}
                        className="cdc-btn-primary"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                          background: RED, color: SURFACE, padding: '0 14px', height: 40, borderRadius: R_MD,
                          border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
                          opacity: isPending ? 0.6 : 1, whiteSpace: 'nowrap',
                        }}
                      >
                        {isPending ? (
                          <Loader2 size={13} className="animate-spin" aria-hidden />
                        ) : (
                          <Plus size={13} strokeWidth={2} aria-hidden />
                        )}
                        Grant
                      </motion.button>
                    </div>
                  </div>

                  {grantError && (
                    <p style={{ margin: 0, fontSize: 12, color: RED }}>{grantError}</p>
                  )}
                </form>
              </div>
            </div>
          )}
        </section>

        {/* ── Materials ────────────────────────────────────────────────────── */}
        <section style={{ ...cardStyle, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} strokeWidth={1.5} style={{ color: MUTED }} aria-hidden />
              <h2 style={sectionLabel}>Lecture Materials ({sessionMats.length})</h2>
            </div>
            <button
              onClick={() => void openAttachPicker()}
              className="cdc-link"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                color: INFO, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              }}
            >
              <Link2 size={13} strokeWidth={2} aria-hidden />
              Attach existing
            </button>
          </div>

          {matError && (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: RED }}>{matError}</p>
          )}

          {/* Attached materials list */}
          {sessionMats.length === 0 ? (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: MUTED }}>No PDFs attached yet.</p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '0 0 12px', padding: 0, listStyle: 'none' }}>
              {sessionMats.map((m) => (
                <li key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                  background: SURFACE_ALT, borderRadius: R_MD, padding: '8px 12px',
                }}>
                  <FileText size={14} strokeWidth={1.5} style={{ color: MUTED, flexShrink: 0 }} aria-hidden />
                  <span style={{ flex: 1, fontWeight: 500, color: SLATE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.title}
                  </span>
                  {m.fileSize && (
                    <span style={{ color: MUTED, flexShrink: 0 }}>
                      {(m.fileSize / 1_000_000).toFixed(1)} MB
                    </span>
                  )}
                  <button
                    onClick={() => void handleDetach(m.id)}
                    disabled={detachingId === m.id}
                    className="cdc-iconbtn cdc-danger"
                    aria-label="Detach"
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: R_MD, border: 'none', background: 'transparent',
                      color: MUTED, cursor: 'pointer', opacity: detachingId === m.id ? 0.4 : 1,
                    }}
                  >
                    {detachingId === m.id
                      ? <Loader2 size={14} className="animate-spin" aria-hidden />
                      : <XIcon size={14} strokeWidth={1.5} aria-hidden />
                    }
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Attach existing picker */}
          {showAttachPicker && (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: R_MD, padding: 12, marginBottom: 12, background: BG }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: SLATE }}>Pick an existing PDF</p>
              {loadingAllMats ? (
                <p style={{ margin: 0, fontSize: 12, color: MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Loader2 size={12} className="animate-spin" aria-hidden /> Loading…
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 192, overflowY: 'auto' }}>
                  {allMaterials.filter((m) => !sessionMats.find((s) => s.id === m.id)).length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: MUTED }}>No other PDFs available.</p>
                  ) : (
                    allMaterials
                      .filter((m) => !sessionMats.find((s) => s.id === m.id))
                      .map((m) => (
                        <button
                          key={m.id}
                          onClick={() => void handleAttach(m.id)}
                          disabled={attachingId === m.id}
                          className="cdc-pick-row"
                          style={{
                            width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 12, padding: '8px 10px', borderRadius: R_MD,
                            border: `1px solid transparent`, background: 'none', cursor: 'pointer',
                            opacity: attachingId === m.id ? 0.6 : 1,
                          }}
                        >
                          <FileText size={14} strokeWidth={1.5} style={{ color: MUTED, flexShrink: 0 }} aria-hidden />
                          <span style={{ flex: 1, fontWeight: 500, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.title}
                          </span>
                          {attachingId === m.id && <Loader2 size={12} className="animate-spin" style={{ color: MUTED }} aria-hidden />}
                        </button>
                      ))
                  )}
                </div>
              )}
              <button
                onClick={() => setShowAttachPicker(false)}
                className="cdc-link"
                style={{ marginTop: 8, fontSize: 12, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Upload new PDF */}
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: SLATE, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Upload size={13} strokeWidth={2} aria-hidden /> Upload new PDF
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                placeholder="PDF title (optional)"
                value={matUploadTitle}
                onChange={(e) => setMatUploadTitle(e.target.value)}
                className="cdc-input"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label style={{
                  flex: '1 1 160px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                  border: `1px dashed ${BORDER}`, borderRadius: R_MD, padding: '8px 12px', cursor: 'pointer',
                }}>
                  <FileText size={14} strokeWidth={1.5} style={{ color: MUTED, flexShrink: 0 }} aria-hidden />
                  <span style={{ color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {matUploadFile ? matUploadFile.name : 'Choose PDF file…'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
                    onChange={(e) => setMatUploadFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <motion.button
                  onClick={() => void handleUploadMaterial()}
                  disabled={!matUploadFile || matUploading}
                  whileTap={{ scale: 0.97 }}
                  className="cdc-btn-primary"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                    background: RED, color: SURFACE, height: 40, padding: '0 14px', borderRadius: R_MD,
                    border: 'none', cursor: (!matUploadFile || matUploading) ? 'not-allowed' : 'pointer',
                    opacity: (!matUploadFile || matUploading) ? 0.5 : 1, whiteSpace: 'nowrap',
                  }}
                >
                  {matUploading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                      {matUploadProgress < 100 ? `${matUploadProgress}%` : 'Saving…'}
                    </>
                  ) : (
                    <>
                      <Upload size={13} strokeWidth={2} aria-hidden />
                      Upload
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Attendance ────────────────────────────────────────────────────── */}
        <section style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={15} strokeWidth={1.5} style={{ color: MUTED }} aria-hidden />
            <h2 style={sectionLabel}>Attendance ({attendance.length})</h2>
          </div>

          {attendance.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState icon={Users} message="No attendance recorded yet." />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: SURFACE_ALT, borderBottom: `1px solid ${BORDER}` }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: MUTED }}>Student</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: MUTED, whiteSpace: 'nowrap' }}>
                      Joined (Dhaka)
                    </th>
                    {recording && (
                      <>
                        <th style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 600, color: MUTED }}>
                          Watched
                        </th>
                        <th style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 600, color: MUTED }}>
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
                      style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? 'transparent' : SURFACE_ALT }}
                    >
                      <td style={{ padding: '10px 16px' }}>
                        <p style={{ margin: 0, fontWeight: 500, color: SLATE }}>{row.name}</p>
                        <p style={{ margin: 0, color: MUTED, fontSize: 10 }}>{row.email}</p>
                      </td>
                      <td style={{ padding: '10px 16px', color: INK_SOFT, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} style={{ color: MUTED, flexShrink: 0 }} strokeWidth={1.5} aria-hidden />
                          {formatDhaka(new Date(row.joinedAt), 'time')}
                        </span>
                      </td>
                      {recording && (
                        <>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
                            {row.watchProgress
                              ? `${Math.round(row.watchProgress.secondsWatched / 60)} min`
                              : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            {row.watchProgress ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                                <div style={{ width: 64, height: 6, borderRadius: R_PILL, background: BORDER, overflow: 'hidden' }}>
                                  <div
                                    style={{ height: '100%', borderRadius: R_PILL, background: OK, width: `${row.watchProgress.completedPercent}%` }}
                                  />
                                </div>
                                <span style={{ color: INK_SOFT, width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {row.watchProgress.completedPercent}%
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: MUTED }}>—</span>
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
        <section style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={15} strokeWidth={1.5} style={{ color: MUTED }} aria-hidden />
            <h2 style={sectionLabel}>Q&amp;A ({threads.length})</h2>
          </div>

          <div>
            {threads.length === 0 ? (
              <div style={{ padding: 20 }}>
                <EmptyState icon={MessageSquare} message="No questions yet." />
              </div>
            ) : (
              threads.map((thread, i) => (
                <div key={thread.id} style={{
                  padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8,
                  borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
                }}>
                  {/* Question row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: SLATE }}>{thread.userName}</span>
                        {thread.isStaff && <Pill bg={RED} color={SURFACE}>Staff</Pill>}
                        <span style={{ fontSize: 10, color: MUTED, marginLeft: 'auto' }}>
                          {formatDhaka(new Date(thread.createdAt), 'datetime')}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: INK_SOFT, lineHeight: 1.5 }}>{thread.body}</p>
                    </div>
                    <button
                      onClick={() => void handleDeleteQA(thread.id)}
                      disabled={deletingId === thread.id}
                      className="cdc-iconbtn cdc-danger"
                      aria-label="Delete question"
                      style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: R_MD, border: 'none', background: 'transparent',
                        color: MUTED, cursor: 'pointer', opacity: deletingId === thread.id ? 0.4 : 1,
                      }}
                    >
                      {deletingId === thread.id
                        ? <Loader2 size={14} className="animate-spin" aria-hidden />
                        : <Trash2 size={14} strokeWidth={1.5} aria-hidden />
                      }
                    </button>
                  </div>

                  {/* Answers */}
                  {thread.answers.length > 0 && (
                    <div style={{ marginLeft: 16, paddingLeft: 12, borderLeft: `2px solid ${RED}33`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {thread.answers.map((ans) => (
                        <div key={ans.id} style={{
                          borderRadius: R_MD, padding: 10,
                          background: ans.isStaff ? `${RED}0D` : SURFACE_ALT,
                          border: ans.isStaff ? `1px solid ${RED}26` : 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: SLATE }}>{ans.userName}</span>
                            {ans.isStaff && <Pill bg={RED} color={SURFACE}>Staff</Pill>}
                            <span style={{ fontSize: 10, color: MUTED, marginLeft: 'auto' }}>
                              {formatDhaka(new Date(ans.createdAt), 'time')}
                            </span>
                            <button
                              onClick={() => void handleDeleteQA(ans.id, thread.id)}
                              disabled={deletingId === ans.id}
                              className="cdc-iconbtn cdc-danger"
                              aria-label="Delete answer"
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 28, height: 28, borderRadius: R_MD, border: 'none', background: 'transparent',
                                color: MUTED, cursor: 'pointer', opacity: deletingId === ans.id ? 0.4 : 1,
                              }}
                            >
                              {deletingId === ans.id
                                ? <Loader2 size={12} className="animate-spin" aria-hidden />
                                : <Trash2 size={12} strokeWidth={1.5} aria-hidden />
                              }
                            </button>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: INK_SOFT, lineHeight: 1.5 }}>{ans.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Answer composer (staff) */}
                  <div style={{ marginLeft: 16, paddingLeft: 12, borderLeft: `2px solid ${BORDER}`, display: 'flex', gap: 8, marginTop: 4 }}>
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
                      className="cdc-input"
                      style={{ ...inputStyle, flex: 1, resize: 'none' }}
                    />
                    <motion.button
                      onClick={() => void handlePostAnswer(thread.id)}
                      disabled={postingAnswer === thread.id || !(answerText[thread.id] ?? '').trim()}
                      whileTap={{ scale: 0.93 }}
                      className="cdc-btn-primary"
                      aria-label="Post answer"
                      style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 40, height: 40, borderRadius: R_MD, border: 'none', background: RED, color: SURFACE,
                        cursor: (postingAnswer === thread.id || !(answerText[thread.id] ?? '').trim()) ? 'not-allowed' : 'pointer',
                        opacity: (postingAnswer === thread.id || !(answerText[thread.id] ?? '').trim()) ? 0.5 : 1,
                        alignSelf: 'flex-end',
                      }}
                    >
                      {postingAnswer === thread.id
                        ? <Loader2 size={14} className="animate-spin" strokeWidth={2} aria-hidden />
                        : <Send size={14} strokeWidth={2} aria-hidden />
                      }
                    </motion.button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      {confirmDialog}
    </div>
  );
}
